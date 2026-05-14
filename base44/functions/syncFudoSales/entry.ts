import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FUDO_AUTH_URL = 'https://auth.fu.do/api';
const FUDO_API_BASE = 'https://api.fu.do/v1alpha1';
const SAFETY_TIMEOUT_MS = 55000; // 55s safety limit

async function getFudoToken(apiKey, apiSecret) {
  const res = await fetch(FUDO_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret })
  });
  if (!res.ok) throw new Error(`FUDO auth failed (${res.status}): ${await res.text()}`);
  return (await res.json()).token;
}

async function fetchAllPages(token, endpoint, maxPages = 20) {
  const all = [];
  let page = 1;
  while (page <= maxPages) {
    const res = await fetch(`${FUDO_API_BASE}/${endpoint}?page[size]=500&page[number]=${page}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
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
  const toMap = (arr) => {
    const map = {};
    for (const item of arr) map[item.id] = { ...item.attributes, _relationships: item.relationships || {} };
    return map;
  };
  return { products: toMap(products), paymentMethods: toMap(paymentMethods), productCategories: toMap(productCategories), tables: toMap(tables), rooms: toMap(rooms), users: toMap(users), kitchens: toMap(kitchens) };
}

function localDateToUTC(dateStr, time, timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
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
  } catch (e) {
    return `${dateStr}T${time === '00:00' ? '03:00' : '02:59'}:00Z`;
  }
}

function getLocalDateString(isoString, timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoString));
  } catch { return isoString.slice(0, 10); }
}

// Fetch sales list (lightweight, no details)
async function fetchAllFudoSales(token, dateFrom, dateTo, timezone) {
  const allSales = [];
  let page = 1;
  const utcFrom = dateFrom ? localDateToUTC(dateFrom, '00:00', timezone) : null;
  const utcTo = dateTo ? localDateToUTC(dateTo, '23:59', timezone) : null;
  console.log(`Date filter: local ${dateFrom} to ${dateTo} (${timezone}) → UTC ${utcFrom} to ${utcTo}`);

  while (true) {
    let url = `${FUDO_API_BASE}/sales?page[size]=500&page[number]=${page}`;
    if (utcFrom && utcTo) url += `&filter[createdAt]=and(gte.${utcFrom},lte.${utcTo})`;
    else if (utcFrom) url += `&filter[createdAt]=gte.${utcFrom}`;
    else if (utcTo) url += `&filter[createdAt]=lte.${utcTo}`;

    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`FUDO sales fetch failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const salesData = json.data || [];
    if (salesData.length === 0) break;
    for (const entry of salesData) allSales.push({ id: entry.id, ...entry.attributes, _relationships: entry.relationships || {} });
    if (salesData.length < 500) break;
    page++;
  }

  const closedSales = allSales.filter(s => { const state = (s.saleState || '').toUpperCase(); return state === 'CLOSED' || state === 'CANCELED'; });
  console.log(`FUDO: ${allSales.length} total → ${closedSales.length} CLOSED/CANCELED`);

  if (dateFrom && dateTo) {
    return closedSales.filter(sale => {
      const saleDate = sale.closedAt || sale.createdAt;
      if (!saleDate) return true;
      return getLocalDateString(saleDate, timezone) >= dateFrom && getLocalDateString(saleDate, timezone) <= dateTo;
    });
  }
  return closedSales;
}

/**
 * OPTIMIZED: Fetch full sale details using ?include=items,payments,discounts,tips,items.subitems
 * This is a SINGLE API call per sale instead of 10+ individual calls.
 */
async function fetchSaleDetails(token, saleId) {
  const res = await fetch(`${FUDO_API_BASE}/sales/${saleId}?include=items,payments,discounts,tips,items.subitems`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  });
  if (!res.ok) return null;
  const json = await res.json();
  const included = json.included || [];
  
  const items = [], payments = [], tips = [], discounts = [], subitems = {};
  for (const inc of included) {
    if (inc.type === 'Item') items.push(inc);
    else if (inc.type === 'Payment') payments.push(inc);
    else if (inc.type === 'Tip') tips.push(inc);
    else if (inc.type === 'Discount') discounts.push(inc);
    else if (inc.type === 'Subitem') subitems[inc.id] = inc;
  }
  return { items, payments, tips, discounts, subitems };
}

// Map FUDO sale to NOA format
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

    products.push({
      product_name: productName, category: category?.name || '', quantity, unit_price: unitPrice,
      zone: kitchen?.name || '', is_cancelled: !!attrs.canceled, is_extra: false,
      is_combo_container: subitemRefs.length > 0,
      ...(itemComment ? { notes: itemComment } : {})
    });

    for (const ref of subitemRefs) {
      const sub = subitemsMap[ref.id]; if (!sub) continue;
      const subAttrs = sub.attributes || {};
      const subProductId = sub.relationships?.product?.data?.id;
      const subProduct = subProductId ? catalogs.products[subProductId] : null;
      const subCategoryId = subProduct?._relationships?.productCategory?.data?.id;
      const subCategory = subCategoryId ? catalogs.productCategories[subCategoryId] : null;
      const subQty = subAttrs.quantity || 1;
      const subPrice = subAttrs.price || 0;
      products.push({
        product_name: subProduct?.name || `Subitem #${ref.id}`,
        category: subCategory?.name || category?.name || '',
        quantity: subQty, unit_price: subQty > 0 ? Math.round(subPrice / subQty) : subPrice,
        zone: kitchen?.name || '', is_cancelled: !!subAttrs.canceled || !!attrs.canceled,
        is_extra: true, parent_product: productName
      });
    }
  }

  let paymentMethod = 'otro', deliverySource = '';
  const pmNames = [];
  for (const p of paymentsData) {
    const pmId = p.relationships?.paymentMethod?.data?.id;
    const pm = pmId ? catalogs.paymentMethods[pmId] : null;
    if (pm?.name) pmNames.push(pm.name);
  }
  if (pmNames.length > 0) {
    const uniq = new Set(pmNames.map(n => n.toLowerCase()));
    paymentMethod = uniq.size > 1 ? 'mixto' : pmNames[0];
    for (const n of pmNames) {
      const l = n.toLowerCase();
      if (l.includes('uber')) { deliverySource = 'Uber Eats'; break; }
      if (l.includes('peya') || l.includes('pedidosya')) { deliverySource = 'PedidosYa'; break; }
      if (l.includes('rappi')) { deliverySource = 'Rappi'; break; }
      if (l.includes('didi')) { deliverySource = 'DiDi Food'; break; }
    }
  }

  const tableId = sale._relationships?.table?.data?.id;
  const table = tableId ? catalogs.tables[tableId] : null;
  const roomId = table?._relationships?.room?.data?.id;
  const room = roomId ? catalogs.rooms[roomId] : null;
  const waiterId = sale._relationships?.waiter?.data?.id;
  const waiter = waiterId ? catalogs.users[waiterId] : null;
  let customerName = sale.customerName || '';
  if (!customerName && sale.anonymousCustomer?.name) customerName = sale.anonymousCustomer.name;
  let saleType = 'local';
  const ft = (sale.saleType || '').toUpperCase();
  if (ft.includes('DELIVERY') || ft.includes('TAKE_AWAY') || ft.includes('TAKEAWAY')) saleType = 'delivery';
  if (deliverySource && saleType === 'local') saleType = 'delivery';

  let tipAmount = 0;
  for (const tip of tipsData) tipAmount += (tip.attributes?.amount || tip.amount || 0);
  let discountAmount = 0, discountPercentage = 0;
  for (const d of discountsData) { const da = d.attributes || {}; if (da.amount) discountAmount += da.amount; if (da.percentage) discountPercentage = da.percentage; }

  return {
    restaurant_id: restaurantId, transaction_id: `FUDO-${sale.id}`,
    date_time: sale.closedAt || sale.createdAt || new Date().toISOString(),
    customer_name: customerName, table_number: table?.name || '', room: room?.name || '',
    num_guests: sale.people || 0, waiter_name: waiter?.name || '',
    payment_method: paymentMethod, sale_type: saleType, delivery_source: deliverySource,
    products, subtotal: sale.total || 0,
    discount_amount: discountAmount, discount_percentage: discountPercentage,
    applies_tax: true, tax_rate: 19, tax_amount: 0, tip_amount: tipAmount,
    total_amount: sale.total || 0, is_cancelled: sale.saleState === 'CANCELED',
    notes: `Importado desde FUDO | ID: ${sale.id}`
  };
}

/**
 * Load existing transaction IDs for duplicate detection.
 * Fetches in pages of 500 to avoid payload crashes.
 */
async function loadExistingTransactionIds(base44, restaurantId) {
  const existingTxIds = new Set();
  const existingSaleMap = {};
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const batch = await base44.asServiceRole.entities.Sale.filter({ restaurant_id: restaurantId }, '-created_date', 500, offset);
    if (!batch || batch.length === 0) break;
    for (const s of batch) {
      if (s.transaction_id) { existingTxIds.add(s.transaction_id); existingSaleMap[s.transaction_id] = s; }
    }
    if (batch.length < 500) break;
    offset += 500;
  }
  console.log(`Loaded ${existingTxIds.size} existing transaction IDs`);
  return { existingTxIds, existingSaleMap };
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, restaurant_id, date_from, date_to, timezone } = body;
    const userTimezone = timezone || 'America/Santiago';

    if (!restaurant_id) return Response.json({ error: 'restaurant_id is required' }, { status: 400 });

    const restaurants = await base44.entities.Restaurant.filter({ id: restaurant_id });
    const restaurant = restaurants?.[0];
    if (!restaurant) return Response.json({ error: 'Restaurant not found' }, { status: 404 });
    const fudoConfig = restaurant.fudo_config;

    // test_connection
    if (action === 'test_connection') {
      if (!body.api_key || !body.api_secret) return Response.json({ error: 'api_key and api_secret required' }, { status: 400 });
      await getFudoToken(body.api_key, body.api_secret);
      return Response.json({ success: true, message: 'Conexión exitosa con FUDO' });
    }

    if (!fudoConfig?.api_key || !fudoConfig?.api_secret) return Response.json({ error: 'FUDO no está configurado.' }, { status: 400 });

    // preview_sales
    if (action === 'preview_sales') {
      const token = await getFudoToken(fudoConfig.api_key, fudoConfig.api_secret);
      const fudoSales = await fetchAllFudoSales(token, date_from, date_to, userTimezone);
      const { existingTxIds } = await loadExistingTransactionIds(base44, restaurant_id);
      const newFudoSales = fudoSales.filter(s => !existingTxIds.has(`FUDO-${s.id}`));
      const catalogs = await loadCatalogs(token);

      const previewSlice = newFudoSales.slice(0, 10);
      const previewMapped = [];
      for (const sale of previewSlice) {
        const details = await fetchSaleDetails(token, sale.id);
        if (!details || details.items.length === 0) continue;
        previewMapped.push(mapFudoSaleToNoa(sale, details.items, details.payments, details.tips, details.discounts, catalogs, restaurant_id, details.subitems));
      }

      return Response.json({
        success: true,
        total: fudoSales.length,
        new_count: newFudoSales.length,
        duplicate_count: fudoSales.length - newFudoSales.length,
        preview: previewMapped
      });
    }

    // sync_sales — OPTIMIZED: uses ?include= for each sale (1 call per sale instead of 10+)
    if (action === 'sync_sales') {
      const token = await getFudoToken(fudoConfig.api_key, fudoConfig.api_secret);
      const fudoSales = await fetchAllFudoSales(token, date_from, date_to, userTimezone);

      if (fudoSales.length === 0) {
        return Response.json({ success: true, imported: 0, skipped: 0, message: 'No se encontraron ventas en FUDO' });
      }

      const { existingTxIds, existingSaleMap } = await loadExistingTransactionIds(base44, restaurant_id);
      const newFudoSales = fudoSales.filter(s => !existingTxIds.has(`FUDO-${s.id}`));
      const existingToResync = fudoSales.filter(s => existingTxIds.has(`FUDO-${s.id}`));
      const allToProcess = [...newFudoSales, ...existingToResync];

      if (allToProcess.length === 0) {
        return Response.json({ success: true, imported: 0, updated: 0, skipped: 0, message: 'No hay ventas para procesar' });
      }

      const catalogs = await loadCatalogs(token);

      let imported = 0, updated = 0;
      const failedSales = [];
      const BATCH_SIZE = 10; // batch for bulkCreate
      let createBatch = [];

      for (let i = 0; i < allToProcess.length; i++) {
        // Safety timeout
        if (Date.now() - startTime > SAFETY_TIMEOUT_MS) {
          console.warn(`⏱️ Safety timeout after ${i}/${allToProcess.length} sales`);
          break;
        }

        const sale = allToProcess[i];
        
        // Fetch all details in ONE call using ?include=
        const details = await fetchSaleDetails(token, sale.id);
        
        if (!details) {
          console.log(`❌ Sale ${sale.id}: fetch failed, skipping`);
          failedSales.push(sale.id);
          continue;
        }

        // CRITICAL: Never create a sale without products
        const itemRefs = sale._relationships?.items?.data || [];
        if (itemRefs.length > 0 && details.items.length === 0) {
          console.log(`❌ Sale ${sale.id}: expected ${itemRefs.length} items but got 0, skipping`);
          failedSales.push(sale.id);
          continue;
        }

        const mapped = mapFudoSaleToNoa(sale, details.items, details.payments, details.tips, details.discounts, catalogs, restaurant_id, details.subitems);

        const existing = existingSaleMap[mapped.transaction_id];
        if (!existing) {
          createBatch.push(mapped);
          if (createBatch.length >= BATCH_SIZE) {
            await base44.asServiceRole.entities.Sale.bulkCreate(createBatch);
            imported += createBatch.length;
            createBatch = [];
          }
        } else {
          // Update existing — never overwrite with fewer products
          if ((mapped.products || []).length < (existing.products || []).length) {
            mapped.products = existing.products;
          }
          const changed = existing.tip_amount !== mapped.tip_amount ||
            existing.total_amount !== mapped.total_amount ||
            existing.payment_method !== mapped.payment_method ||
            existing.is_cancelled !== mapped.is_cancelled ||
            (existing.products || []).length !== (mapped.products || []).length;
          if (changed) {
            await base44.asServiceRole.entities.Sale.update(existing.id, mapped);
            updated++;
          }
        }

        // Small delay every 5 sales to avoid overwhelming FUDO API
        if (i % 5 === 4) await new Promise(r => setTimeout(r, 50));
      }

      // Flush remaining batch
      if (createBatch.length > 0) {
        await base44.asServiceRole.entities.Sale.bulkCreate(createBatch);
        imported += createBatch.length;
      }

      // Update last sync AND today_tx_ids to stay in sync with autoSyncFudoSales
      const userTimezoneForDate = timezone || restaurant.timezone || 'America/Santiago';
      const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezoneForDate, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const savedDate = fudoConfig.today_tx_date || '';
      let existingTxIdsList = (savedDate === todayLocal && Array.isArray(fudoConfig.today_tx_ids)) ? [...fudoConfig.today_tx_ids] : [];
      // Add all newly imported FUDO IDs (extract numeric ID from 'FUDO-XXXXX')
      const allImportedFudoIds = fudoSales.filter(s => existingTxIds.has(`FUDO-${s.id}`) || !existingTxIds.has(`FUDO-${s.id}`)).map(s => String(s.id));
      const mergedTxIds = [...new Set([...existingTxIdsList, ...allImportedFudoIds])];
      await base44.asServiceRole.entities.Restaurant.update(restaurant_id, {
        fudo_config: { ...fudoConfig, last_sync: new Date().toISOString(), today_tx_date: todayLocal, today_tx_ids: mergedTxIds }
      });

      const skipped = existingToResync.length - updated;
      return Response.json({
        success: true, imported, updated, skipped, total_fudo: fudoSales.length,
        failed_sales: failedSales,
        duration_ms: Date.now() - startTime,
        message: `${imported} nuevas importadas, ${updated} actualizadas${skipped > 0 ? `, ${skipped} sin cambios` : ''}${failedSales.length > 0 ? ` ⚠️ ${failedSales.length} ventas omitidas (sin productos)` : ''}`
      });
    }

    // debug_states
    if (action === 'debug_states') {
      const token = await getFudoToken(fudoConfig.api_key, fudoConfig.api_secret);
      const utcFrom = localDateToUTC(date_from, '00:00', userTimezone);
      const utcTo = localDateToUTC(date_to, '23:59', userTimezone);
      const allSales = [];
      let page = 1;
      while (true) {
        const res = await fetch(`${FUDO_API_BASE}/sales?page[size]=500&page[number]=${page}&filter[createdAt]=and(gte.${utcFrom},lte.${utcTo})`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!res.ok) break;
        const json = await res.json();
        const items = json.data || [];
        if (items.length === 0) break;
        allSales.push(...items);
        if (items.length < 500) break;
        page++;
      }
      const stateCounts = {};
      const stateDetails = allSales.map(s => {
        const st = s.attributes?.saleState || 'NULL';
        stateCounts[st] = (stateCounts[st] || 0) + 1;
        return { id: s.id, saleState: st, total: s.attributes?.total, createdAt: s.attributes?.createdAt, closedAt: s.attributes?.closedAt };
      });
      return Response.json({ total_sales: allSales.length, state_counts: stateCounts, sales: stateDetails });
    }

    // debug_sale
    if (action === 'debug_sale') {
      const token = await getFudoToken(fudoConfig.api_key, fudoConfig.api_secret);
      const { sale_id } = body;
      if (!sale_id) return Response.json({ error: 'sale_id required' }, { status: 400 });
      const details = await fetchSaleDetails(token, sale_id);
      if (!details) return Response.json({ error: `Sale ${sale_id} not found` }, { status: 404 });
      return Response.json({ sale_id, items: details.items.length, payments: details.payments.length, tips: details.tips.length, discounts: details.discounts.length, subitems: Object.keys(details.subitems).length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('FUDO sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});