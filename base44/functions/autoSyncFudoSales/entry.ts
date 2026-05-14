import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Auto-sync FUDO sales v6 — runs every 10 min via scheduled automation.
 * 
 * DUPLICATE PREVENTION STRATEGY:
 * Instead of reading existing Sale records (unreliable with SDK service role),
 * we persist today's imported FUDO transaction IDs directly in
 * restaurant.fudo_config.today_tx_ids (array of strings like "45153").
 * On each run we compare FUDO closed sales against this set.
 * The set resets when the date changes (new day).
 */

const FUDO_AUTH_URL = 'https://auth.fu.do/api';
const FUDO_API_BASE = 'https://api.fu.do/v1alpha1';
const PER_RESTAURANT_MS = 45000;

async function getFudoToken(apiKey, apiSecret) {
  const res = await fetch(FUDO_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret })
  });
  if (!res.ok) throw new Error(`FUDO auth failed (${res.status})`);
  return (await res.json()).token;
}

async function fetchAllPages(token, endpoint, maxPages = 20) {
  const all = [];
  let page = 1;
  while (page <= maxPages) {
    const ctrl = new AbortController();
    const tmout = setTimeout(() => ctrl.abort(), 8000);
    const url = `${FUDO_API_BASE}/${endpoint}?page[size]=500&page[number]=${page}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }, signal: ctrl.signal });
    clearTimeout(tmout);
    if (!res.ok) break;
    const json = await res.json();
    const items = json.data || [];
    if (items.length === 0) break;
    all.push(...items);
    if (items.length < 500) break;
    page++;
  }
  return all;
}

async function loadCatalogs(token) {
  const [products, paymentMethods, productCategories, tables, rooms, users, kitchens] = await Promise.all([
    fetchAllPages(token, 'products'),
    fetchAllPages(token, 'payment-methods'),
    fetchAllPages(token, 'product-categories'),
    fetchAllPages(token, 'tables'),
    fetchAllPages(token, 'rooms'),
    fetchAllPages(token, 'users'),
    fetchAllPages(token, 'kitchens'),
  ]);
  const toMap = (arr) => { const map = {}; for (const item of arr) map[item.id] = { ...item.attributes, _relationships: item.relationships || {} }; return map; };
  return { products: toMap(products), paymentMethods: toMap(paymentMethods), productCategories: toMap(productCategories), tables: toMap(tables), rooms: toMap(rooms), users: toMap(users), kitchens: toMap(kitchens) };
}

function getTodayString(timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function localDateToUTC(dateStr, time, timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const refDate = new Date(`${dateStr}T${time}:00Z`);
    const parts = formatter.formatToParts(refDate);
    const getPart = (type) => parts.find(p => p.type === type)?.value;
    const localHour = parseInt(getPart('hour'));
    const localDay = parseInt(getPart('day'));
    const inputDay = parseInt(dateStr.split('-')[2]);
    const inputHour = parseInt(time.split(':')[0]);
    let offsetHours = localHour - inputHour;
    if (localDay !== inputDay) offsetHours += (localDay > inputDay ? 24 : -24);
    const utcDate = new Date(`${dateStr}T${time}:00Z`);
    utcDate.setHours(utcDate.getHours() - offsetHours);
    return utcDate.toISOString().replace('.000Z', 'Z');
  } catch (e) { return `${dateStr}T${time === '00:00' ? '03:00' : '02:59'}:00Z`; }
}

function mapFudoSaleToNoa(sale, itemsData, paymentsData, tipsData, discountsData, catalogs, restaurantId, subitemsMap = {}) {
  const products = [];
  for (const item of itemsData) {
    const attrs = item.attributes || {};
    const productId = item.relationships?.product?.data?.id;
    const product = productId ? catalogs.products[productId] : null;
    const categoryId = product?._relationships?.productCategory?.data?.id;
    const category = categoryId ? catalogs.productCategories[categoryId] : null;
    const kitchenId = product?._relationships?.kitchen?.data?.id;
    const kitchen = kitchenId ? catalogs.kitchens[kitchenId] : null;
    const productName = product?.name || `Producto #${productId || '?'}`;
    const quantity = attrs.quantity || 1;
    const totalItemPrice = attrs.price || 0;
    const unitPrice = quantity > 0 ? Math.round(totalItemPrice / quantity) : totalItemPrice;
    const itemComment = (attrs.comment || '').trim();
    const subitemRefs = item.relationships?.subitems?.data || [];
    const hasSubitems = subitemRefs.length > 0;
    products.push({ product_name: productName, category: category?.name || '', quantity, unit_price: unitPrice, zone: kitchen?.name || '', is_cancelled: !!attrs.canceled, is_extra: false, is_combo_container: hasSubitems, ...(itemComment ? { notes: itemComment } : {}) });
    for (const ref of subitemRefs) {
      const sub = subitemsMap[ref.id]; if (!sub) continue;
      const subAttrs = sub.attributes || {};
      const subProductId = sub.relationships?.product?.data?.id;
      const subProduct = subProductId ? catalogs.products[subProductId] : null;
      const subCategoryId = subProduct?._relationships?.productCategory?.data?.id;
      const subCategory = subCategoryId ? catalogs.productCategories[subCategoryId] : null;
      const subName = subProduct?.name || `Subitem #${ref.id}`;
      const subQty = subAttrs.quantity || 1;
      const subPrice = subAttrs.price || 0;
      const subUnitPrice = subQty > 0 ? Math.round(subPrice / subQty) : subPrice;
      products.push({ product_name: subName, category: subCategory?.name || category?.name || '', quantity: subQty, unit_price: subUnitPrice, zone: kitchen?.name || '', is_cancelled: !!subAttrs.canceled || !!attrs.canceled, is_extra: true, parent_product: productName });
    }
  }

  let paymentMethod = 'otro'; let deliverySource = ''; const paymentMethodNames = [];
  if (paymentsData.length > 0) {
    for (const payment of paymentsData) { const pmId = payment.relationships?.paymentMethod?.data?.id; const pm = pmId ? catalogs.paymentMethods[pmId] : null; if (pm?.name) paymentMethodNames.push(pm.name); }
    const uniqueMethods = new Set(paymentMethodNames.map(n => n.toLowerCase()));
    paymentMethod = uniqueMethods.size > 1 ? 'mixto' : (paymentMethodNames[0] || 'otro');
    for (const pmName of paymentMethodNames) {
      const pmLower = pmName.toLowerCase();
      if (pmLower.includes('uber')) { deliverySource = 'Uber Eats'; break; }
      if (pmLower.includes('peya') || pmLower.includes('pedidosya') || pmLower.includes('pedidos ya')) { deliverySource = 'PedidosYa'; break; }
      if (pmLower.includes('rappi')) { deliverySource = 'Rappi'; break; }
      if (pmLower.includes('didi')) { deliverySource = 'DiDi Food'; break; }
      if (pmLower.includes('cornershop')) { deliverySource = 'Cornershop'; break; }
      if (pmLower.includes('justo')) { deliverySource = 'Justo'; break; }
    }
  }

  const tableId = sale._relationships?.table?.data?.id; const table = tableId ? catalogs.tables[tableId] : null;
  const roomId = table?._relationships?.room?.data?.id; const room = roomId ? catalogs.rooms[roomId] : null;
  const waiterId = sale._relationships?.waiter?.data?.id; const waiter = waiterId ? catalogs.users[waiterId] : null;
  let customerName = sale.customerName || ''; if (!customerName && sale.anonymousCustomer?.name) customerName = sale.anonymousCustomer.name;
  let saleType = 'local'; const fudoSaleType = (sale.saleType || '').toUpperCase();
  if (fudoSaleType.includes('DELIVERY') || fudoSaleType.includes('TAKE_AWAY') || fudoSaleType.includes('TAKEAWAY')) saleType = 'delivery';
  if (deliverySource && saleType === 'local') saleType = 'delivery';
  let tipAmount = 0; for (const tip of tipsData) tipAmount += (tip.attributes?.amount || tip.amount || 0);
  let discountAmount = 0; let discountPercentage = 0;
  for (const disc of discountsData) { const da = disc.attributes || {}; if (da.amount) discountAmount += da.amount; if (da.percentage) discountPercentage = da.percentage; }

  return {
    restaurant_id: restaurantId, transaction_id: `FUDO-${sale.id}`,
    date_time: sale.closedAt || sale.createdAt || new Date().toISOString(),
    customer_name: customerName, table_number: table?.name || '', room: room?.name || '',
    num_guests: sale.people || 0, waiter_name: waiter?.name || '', payment_method: paymentMethod,
    sale_type: saleType, delivery_source: deliverySource, products,
    subtotal: sale.total || 0, discount_amount: discountAmount, discount_percentage: discountPercentage,
    applies_tax: true, tax_rate: 19, tax_amount: 0, tip_amount: tipAmount, total_amount: sale.total || 0,
    is_cancelled: sale.saleState === 'CANCELED',
    notes: `Importado desde FUDO (auto-sync) | ID: ${sale.id}`
  };
}

// ─── Stock deduction (consolidated) ────────────────────────────────────

function calculateStockDeductions(mappedSales, recipesByName, supplyItemsByName, supplyItemsById, comboProductsList) {
  // Build a set of sub-recipe names to exclude from direct supply matching
  const subRecipeNames = new Set();
  for (const key of Object.keys(recipesByName)) {
    const r = recipesByName[key];
    if (r.is_sub_recipe) subRecipeNames.add(key);
  }

  // Helper: recursively expand a recipe's ingredients into supply deductions
  function expandRecipe(recipe, multiplier, rawName, stockDeductions, depth) {
    if (depth > 5) return; // safety limit
    const servings = recipe.servings || 1;

    // Direct ingredients
    for (const ing of (recipe.ingredients || [])) {
      let si = ing.supply_id ? supplyItemsById[ing.supply_id] : null;
      if (!si && ing.supply_name) si = supplyItemsByName[ing.supply_name.toLowerCase().trim()];
      if (!si) continue;
      // If this "supply" is actually a sub-recipe, expand it instead
      const ingLower = ing.supply_name?.toLowerCase().trim();
      if (ingLower && recipesByName[ingLower] && recipesByName[ingLower].is_sub_recipe) {
        const subRecipe = recipesByName[ingLower];
        const subMultiplier = multiplier * (ing.quantity || 0) / servings;
        expandRecipe(subRecipe, subMultiplier, rawName, stockDeductions, depth + 1);
        continue;
      }
      const deductQty = parseFloat(((ing.quantity || 0) / servings * multiplier).toFixed(6));
      if (deductQty <= 0) continue;
      if (!stockDeductions[si.id]) stockDeductions[si.id] = { item: si, totalDeduct: 0, sources: [] };
      stockDeductions[si.id].totalDeduct += deductQty;
      stockDeductions[si.id].sources.push(`${rawName} x${multiplier}`);
    }

    // Sub-recipes referenced in recipe.sub_recipes
    for (const subRef of (recipe.sub_recipes || [])) {
      let subRecipe = subRef.recipe_id ? Object.values(recipesByName).find(r => r.id === subRef.recipe_id) : null;
      if (!subRecipe && subRef.recipe_name) subRecipe = recipesByName[subRef.recipe_name.toLowerCase().trim()];
      if (!subRecipe) continue;
      const subQtyNeeded = (subRef.quantity || 1) * multiplier / servings;
      expandRecipe(subRecipe, subQtyNeeded, rawName, stockDeductions, depth + 1);
    }
  }

  const stockDeductions = {};
  for (const sale of mappedSales) {
    if (sale.is_cancelled) continue;
    for (const product of (sale.products || [])) {
      if (product.is_cancelled) continue;
      const rawName = (product.product_name || '').trim();
      if (!rawName) continue;
      const qty = product.quantity || 1;
      if (comboProductsList.includes(rawName.toLowerCase().trim())) continue;
      const namesToProcess = rawName.includes('+') ? rawName.split('+').map(s => s.trim()).filter(Boolean) : [rawName];
      for (const name of namesToProcess) {
        const lowerName = name.toLowerCase().trim();
        const recipe = recipesByName[lowerName];
        if (!recipe) {
          // Skip if this is a sub-recipe name (shouldn't be deducted as direct supply)
          if (subRecipeNames.has(lowerName)) continue;
          const directSupply = supplyItemsByName[lowerName];
          if (directSupply) {
            if (!stockDeductions[directSupply.id]) stockDeductions[directSupply.id] = { item: directSupply, totalDeduct: 0, sources: [] };
            stockDeductions[directSupply.id].totalDeduct += qty;
            stockDeductions[directSupply.id].sources.push(`${rawName} x${qty}`);
          }
          continue;
        }
        expandRecipe(recipe, qty, rawName, stockDeductions, 0);
      }
    }
  }
  return stockDeductions;
}

async function applyStockDeductions(base44, restaurantId, stockDeductions, importedCount, today, freshSupplyItems) {
  const deductionEntries = Object.entries(stockDeductions);
  if (deductionEntries.length === 0) return 0;
  
  const freshStockMap = {};
  for (const si of freshSupplyItems) freshStockMap[si.id] = si.current_stock || 0;
  
  const movements = [];
  for (let di = 0; di < deductionEntries.length; di += 10) {
    const batch = deductionEntries.slice(di, di + 10);
    await Promise.all(batch.map(async ([supplyItemId, info]) => {
      const { item, totalDeduct, sources } = info;
      const previousStock = freshStockMap[supplyItemId] ?? (item.current_stock || 0);
      const newStock = parseFloat(Math.max(0, previousStock - totalDeduct).toFixed(3));
      await base44.asServiceRole.entities.SupplyItem.update(supplyItemId, { current_stock: newStock });
      movements.push({
        restaurant_id: restaurantId, product_name: item.name, product_id: supplyItemId,
        item_type: 'supply', movement_type: 'sale', quantity: -totalDeduct,
        previous_stock: previousStock, new_stock: newStock,
        transaction_date: new Date().toISOString(),
        reference_id: `FUDO-SYNC-${today}`,
        reference_name: sources.slice(0, 5).join(', ') + (sources.length > 5 ? ` (+${sources.length - 5} más)` : ''),
        notes: `Descuento consolidado FUDO sync (${importedCount} ventas)`
      });
    }));
  }
  if (movements.length > 0) await base44.asServiceRole.entities.StockMovement.bulkCreate(movements);
  return movements.length;
}

// ─── Process one restaurant ────────────────────────────────────────────

async function processOneRestaurant(base44, restaurant) {
  const startTime = Date.now();
  const isTimeout = () => (Date.now() - startTime) > PER_RESTAURANT_MS;
  const restaurantId = restaurant.id;
  const fudoConfig = restaurant.fudo_config;
  const timezone = restaurant.timezone || 'America/Santiago';
  const today = getTodayString(timezone);
  const CHUNK_SIZE = 10;

  let syncLog = null;
  try { syncLog = await base44.asServiceRole.entities.SyncLog.create({ restaurant_id: restaurantId, restaurant_name: restaurant.name, sync_type: 'fudo_sales', status: 'in_progress' }); } catch {}

  const token = await getFudoToken(fudoConfig.api_key, fudoConfig.api_secret);

  // Fetch today's FUDO sales
  const utcFrom = localDateToUTC(today, '00:00', timezone);
  const utcTo = localDateToUTC(today, '23:59', timezone);
  const url = `${FUDO_API_BASE}/sales?page[size]=500&page[number]=1&filter[createdAt]=and(gte.${utcFrom},lte.${utcTo})`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`FUDO sales fetch failed: ${res.status}`);
  const json = await res.json();
  const allSales = (json.data || []).map(entry => ({ id: entry.id, ...entry.attributes, _relationships: entry.relationships || {} }));
  const closedSales = allSales.filter(s => { const state = (s.saleState || '').toUpperCase(); return state === 'CLOSED' || state === 'CANCELED'; });

  console.log(`[Sync] ${restaurant.name}: ${allSales.length} total, ${closedSales.length} closed`);

  if (closedSales.length === 0) {
    if (syncLog?.id) try { await base44.asServiceRole.entities.SyncLog.update(syncLog.id, { status: 'success', records_imported: 0, records_skipped: 0, duration_ms: Date.now() - startTime, details: 'Sin ventas cerradas hoy' }); } catch {}
    return { imported: 0, skipped: 0, stock_deducted: 0, message: 'Sin ventas cerradas' };
  }

  // ─── DUPLICATE DETECTION via persisted tx IDs ───────────────────────
  // Read today_tx_ids from fudo_config. Reset if date changed.
  const savedDate = fudoConfig.today_tx_date || '';
  let knownTxIds = new Set();
  if (savedDate === today && Array.isArray(fudoConfig.today_tx_ids)) {
    knownTxIds = new Set(fudoConfig.today_tx_ids);
  }
  console.log(`[Sync] ${restaurant.name}: ${knownTxIds.size} known tx IDs for today (${today})`);

  const newSales = closedSales.filter(s => !knownTxIds.has(String(s.id)));
  const skippedCount = closedSales.length - newSales.length;

  if (newSales.length === 0) {
    const dur = Date.now() - startTime;
    if (syncLog?.id) try { await base44.asServiceRole.entities.SyncLog.update(syncLog.id, { status: 'success', records_imported: 0, records_skipped: skippedCount, duration_ms: dur, details: 'Todas ya importadas' }); } catch {}
    return { imported: 0, skipped: skippedCount, stock_deducted: 0, message: 'Todas ya importadas' };
  }

  console.log(`[Sync] ${restaurant.name}: ${newSales.length} new, ${skippedCount} existing`);

  const catalogs = await loadCatalogs(token);

  // Load recipes and supply items for stock deduction
  const recipesByName = {};
  const supplyItemsByName = {};
  const supplyItemsById = {};
  const comboProductsList = (restaurant.combo_products || []).map(n => n.toLowerCase().trim());

  let allRecipesRaw, allSupplyItemsRaw;
  try {
    [allRecipesRaw, allSupplyItemsRaw] = await Promise.all([
      base44.asServiceRole.entities.Recipe.list('-created_date', 200),
      base44.asServiceRole.entities.SupplyItem.list('-created_date', 200),
    ]);
  } catch (e) {
    console.log(`[Sync] Warning: list() failed for recipes/supplies: ${e.message}`);
    allRecipesRaw = []; allSupplyItemsRaw = [];
  }
  const allRecipes = Array.isArray(allRecipesRaw) ? allRecipesRaw : [];
  const allSupplyItemsList = Array.isArray(allSupplyItemsRaw) ? allSupplyItemsRaw : [];
  const recipes = allRecipes.filter(r => r.restaurant_id === restaurantId);
  const supplyItems = allSupplyItemsList.filter(s => s.restaurant_id === restaurantId);
  console.log(`[Sync] ${restaurant.name}: ${recipes.length} recipes, ${supplyItems.length} supply items`);
  for (const r of recipes) { if (r.dish_name) recipesByName[r.dish_name.toLowerCase().trim()] = r; }
  for (const s of supplyItems) {
    if (s.name) supplyItemsByName[s.name.toLowerCase().trim()] = s;
    if (s.id) supplyItemsById[s.id] = s;
  }

  // Process sales in chunks
  let imported = 0;
  let skippedNoProducts = 0;
  const allMappedForStock = [];
  const newlyImportedTxIds = [];

  for (let ci = 0; ci < newSales.length; ci += CHUNK_SIZE) {
    if (isTimeout()) { console.log(`[Sync] ⏱️ ${restaurant.name} timeout at chunk ${ci}/${newSales.length}`); break; }
    const chunk = newSales.slice(ci, ci + CHUNK_SIZE);

    const mappedSales = [];
    for (const sale of chunk) {
      if (isTimeout()) break;

      // Single API call to get all details
      let details = null;
      try {
        const ctrl = new AbortController();
        const tmout = setTimeout(() => ctrl.abort(), 8000);
        const detailRes = await fetch(`${FUDO_API_BASE}/sales/${sale.id}?include=items,payments,discounts,tips,items.subitems`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
          signal: ctrl.signal
        });
        clearTimeout(tmout);
        if (detailRes.ok) {
          const detailJson = await detailRes.json();
          const included = detailJson.included || [];
          const items = [], payments = [], tips = [], discounts = [];
          const subitemsMap = {};
          for (const inc of included) {
            if (inc.type === 'Item') items.push(inc);
            else if (inc.type === 'Payment') payments.push(inc);
            else if (inc.type === 'Tip') tips.push(inc);
            else if (inc.type === 'Discount') discounts.push(inc);
            else if (inc.type === 'Subitem') subitemsMap[inc.id] = inc;
          }
          details = { items, payments, tips, discounts, subitemsMap };
        }
      } catch {}

      const itemRefs = sale._relationships?.items?.data || [];
      if (!details || (itemRefs.length > 0 && details.items.length === 0)) {
        console.log(`❌ Sale FUDO-${sale.id}: SKIPPING — no products could be fetched`);
        skippedNoProducts++;
        continue;
      }

      mappedSales.push(mapFudoSaleToNoa(sale, details.items, details.payments, details.tips, details.discounts, catalogs, restaurantId, details.subitemsMap));
      newlyImportedTxIds.push(String(sale.id));
    }

    if (mappedSales.length > 0) {
      await base44.asServiceRole.entities.Sale.bulkCreate(mappedSales);
      imported += mappedSales.length;
      allMappedForStock.push(...mappedSales);
    }

    if (ci + CHUNK_SIZE < newSales.length) await new Promise(r => setTimeout(r, 50));
  }

  // ─── Persist newly imported tx IDs ──────────────────────────────────
  const updatedTxIds = [...knownTxIds, ...newlyImportedTxIds];
  const updatedFudoConfig = {
    ...fudoConfig,
    last_sync: new Date().toISOString(),
    today_tx_date: today,
    today_tx_ids: updatedTxIds,
  };

  // Consolidated stock deduction
  let stockDeducted = 0;
  if (allMappedForStock.length > 0 && !isTimeout()) {
    try {
      const allFreshRaw = await base44.asServiceRole.entities.SupplyItem.list('-created_date', 200);
      const allFreshArr = Array.isArray(allFreshRaw) ? allFreshRaw : [];
      const freshSupplyItems = allFreshArr.filter(s => s.restaurant_id === restaurantId);
      for (const s of freshSupplyItems) {
        if (s.name) supplyItemsByName[s.name.toLowerCase().trim()] = s;
        if (s.id) supplyItemsById[s.id] = s;
      }
      const deductions = calculateStockDeductions(allMappedForStock, recipesByName, supplyItemsByName, supplyItemsById, comboProductsList);
      stockDeducted = await applyStockDeductions(base44, restaurantId, deductions, imported, today, freshSupplyItems);
      if (stockDeducted > 0) console.log(`[Sync] ${restaurant.name}: ${stockDeducted} supplies deducted from ${imported} sales`);
    } catch (stockErr) { console.error(`[Sync] Stock error: ${stockErr.message}`); }
  }

  await base44.asServiceRole.entities.Restaurant.update(restaurantId, { fudo_config: updatedFudoConfig });

  const duration = Date.now() - startTime;
  const message = `${imported} nuevas, ${skippedCount} ya existían, ${stockDeducted} insumos descontados${skippedNoProducts > 0 ? `, ${skippedNoProducts} omitidas (sin productos)` : ''}`;
  console.log(`[Sync] ✅ ${restaurant.name}: ${message} (${duration}ms)`);
  if (syncLog?.id) try { await base44.asServiceRole.entities.SyncLog.update(syncLog.id, { status: 'success', records_imported: imported, records_skipped: skippedCount, duration_ms: duration, details: message }); } catch {}

  return { imported, skipped: skippedCount, skipped_no_products: skippedNoProducts, stock_deducted: stockDeducted, message, duration_ms: duration };
}

// ─── Main handler ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role === 'admin') isAuthorized = true;
    } catch (_) {}
    if (!isAuthorized) {
      try { await base44.asServiceRole.entities.Restaurant.list('-created_date', 1); isAuthorized = true; }
      catch (_) { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
    }

    const allRestaurants = await base44.asServiceRole.entities.Restaurant.list('-created_date', 100);
    const fudoRestaurants = allRestaurants.filter(r =>
      r.fudo_config?.api_key && r.fudo_config?.api_secret && r.fudo_config?.is_connected
    );

    if (fudoRestaurants.length === 0) {
      return Response.json({ success: true, message: 'No hay restaurantes con FUDO configurado', results: [] });
    }

    console.log(`[AutoSync] ${fudoRestaurants.length} restaurant(s): ${fudoRestaurants.map(r => r.name).join(', ')}`);

    const results = [];
    for (const restaurant of fudoRestaurants) {
      try {
        const r = await processOneRestaurant(base44, restaurant);
        results.push({ restaurant: restaurant.name, restaurant_id: restaurant.id, status: 'success', ...r });
      } catch (err) {
        console.error(`[AutoSync] ❌ ${restaurant.name}: ${err.message}`);
        try {
          await base44.asServiceRole.entities.SyncLog.create({
            restaurant_id: restaurant.id, restaurant_name: restaurant.name,
            sync_type: 'fudo_sales', status: 'failed', error_message: err.message
          });
        } catch {}
        results.push({ restaurant: restaurant.name, restaurant_id: restaurant.id, status: 'failed', error: err.message });
      }
    }

    const totalImported = results.reduce((s, r) => s + (r.imported || 0), 0);
    console.log(`[AutoSync] Done — ${results.filter(r => r.status === 'success').length} ok, ${totalImported} imported`);

    return Response.json({
      success: true,
      total_restaurants: fudoRestaurants.length,
      results,
      total_imported: totalImported
    });

  } catch (error) {
    console.error('[AutoSync] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});