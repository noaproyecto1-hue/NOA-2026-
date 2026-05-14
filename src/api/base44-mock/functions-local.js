// Implementaciones locales de las cloud functions originales de Base44.
// Versiones adaptadas (no son port literal, conservan la lógica de negocio).
// Operan directo sobre el store local (localStorage).

import { store } from './store.js';

// ───────────────────────── helpers compartidos ─────────────────────────

function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLocalDate(isoString, tz = 'America/Santiago') {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(isoString));
  } catch { return null; }
}

function todayLocal(tz = 'America/Santiago') {
  return getLocalDate(new Date().toISOString(), tz);
}

// ───────────────────────── findEntityByName ─────────────────────────

function matchScore(queryNorm, candidateNorm) {
  if (!queryNorm || !candidateNorm) return 0;
  if (queryNorm === candidateNorm) return 100;
  if (candidateNorm.includes(queryNorm)) return 90;
  if (queryNorm.includes(candidateNorm)) return 85;
  const qTokens = queryNorm.split(' ').filter(Boolean);
  const cTokens = candidateNorm.split(' ').filter(Boolean);
  if (!qTokens.length || !cTokens.length) return 0;
  const matched = qTokens.filter((t) => cTokens.some((c) => c.includes(t) || t.includes(c)));
  return Math.round((matched.length / qTokens.length) * 70);
}

export async function findEntityByName({ entityType, query, restaurantId, limit = 5 } = {}) {
  if (!entityType || !query) return { matches: [], total_found: 0 };
  const all = await store.list(entityType);
  const filtered = restaurantId ? all.filter((it) => it.restaurant_id === restaurantId) : all;
  const qNorm = normalize(query);
  const scored = filtered
    .map((it) => ({ ...it, score: matchScore(qNorm, normalize(it.name || it.full_name || '')) }))
    .filter((it) => it.score > 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return { matches: scored, total_found: scored.length };
}

// ───────────────────────── stock functions ─────────────────────────

export async function deductStockOnSale({ saleId } = {}) {
  if (!saleId) return { ok: false, message: 'saleId requerido' };
  const sale = await store.get('Sale', saleId);
  if (!sale) return { ok: false, message: 'Venta no encontrada' };
  if (!sale.products || !sale.products.length) return { ok: true, deducted: 0 };

  let deductedCount = 0;
  const movements = [];

  for (const prod of sale.products) {
    if (prod.is_cancelled) continue;
    // Buscar receta por nombre
    const recipes = await store.filter('Recipe', { restaurant_id: sale.restaurant_id });
    const recipe = recipes.find((r) => normalize(r.name) === normalize(prod.name));
    if (!recipe || !recipe.ingredients) continue;

    for (const ing of recipe.ingredients) {
      const supply = await store.get('SupplyItem', ing.supply_item_id);
      if (!supply) continue;
      const qtyToDeduct = (ing.quantity || 0) * (prod.quantity || 1);
      const newStock = Math.max(0, (supply.stock || 0) - qtyToDeduct);
      await store.update('SupplyItem', supply.id, { stock: newStock });
      movements.push({
        supply_item_id: supply.id,
        type: 'out',
        quantity: qtyToDeduct,
        reason: 'sale',
        sale_id: saleId,
        restaurant_id: sale.restaurant_id,
      });
      deductedCount++;
    }
  }

  if (movements.length) await store.bulkCreate('StockMovement', movements);
  return { ok: true, deducted: deductedCount };
}

export async function reverseStockOnSaleChange({ saleId } = {}) {
  if (!saleId) return { ok: false, message: 'saleId requerido' };
  const movements = await store.filter('StockMovement', { sale_id: saleId, type: 'out' });
  let reversedCount = 0;
  for (const mov of movements) {
    const supply = await store.get('SupplyItem', mov.supply_item_id);
    if (!supply) continue;
    await store.update('SupplyItem', supply.id, { stock: (supply.stock || 0) + (mov.quantity || 0) });
    await store.delete('StockMovement', mov.id);
    reversedCount++;
  }
  return { ok: true, reversed: reversedCount };
}

export async function reverseStockOnPurchaseDelete({ supplyCostId } = {}) {
  if (!supplyCostId) return { ok: false, message: 'supplyCostId requerido' };
  const cost = await store.get('SupplyCost', supplyCostId);
  if (!cost || !cost.supply_item_id) return { ok: true, reversed: 0 };
  const supply = await store.get('SupplyItem', cost.supply_item_id);
  if (!supply) return { ok: true, reversed: 0 };
  await store.update('SupplyItem', supply.id, {
    stock: Math.max(0, (supply.stock || 0) - (cost.quantity || 0)),
  });
  return { ok: true, reversed: 1 };
}

// ───────────────────────── métricas diarias ─────────────────────────

function buildDayMetrics(rid, dateStr, daySales, cancelledCount, daySupply, dayOpex) {
  let netSales = 0, grossSales = 0, tips = 0, discounts = 0;
  let deliveryCount = 0, localCount = 0, guests = 0;
  const salesByPayment = {}, salesByCategory = {}, salesByDeliverySource = {};

  for (const s of daySales) {
    const saleNet = s.total_amount || 0;
    const saleGross = (s.subtotal_amount ?? saleNet) + (s.discount_total || 0);
    netSales += saleNet;
    grossSales += saleGross;
    tips += s.tip_total || 0;
    discounts += s.discount_total || 0;
    if (s.guests_count) guests += s.guests_count;
    if (s.is_delivery) {
      deliveryCount++;
      const src = s.delivery_source || 'Otros';
      salesByDeliverySource[src] = (salesByDeliverySource[src] || 0) + saleNet;
    } else localCount++;
    const pay = s.payment_method || 'Otros';
    salesByPayment[pay] = (salesByPayment[pay] || 0) + saleNet;
    if (s.products) {
      for (const p of s.products) {
        if (p.is_cancelled) continue;
        const cat = p.category || 'Sin categoría';
        salesByCategory[cat] = (salesByCategory[cat] || 0) + ((p.unit_price || 0) * (p.quantity || 1));
      }
    }
  }

  let foodCostTotal = 0;
  const foodCostByCategory = {};
  for (const c of daySupply) {
    const cost = c.total_cost || c.subtotal || 0;
    foodCostTotal += cost;
    const cat = c.supply_category || 'General';
    foodCostByCategory[cat] = (foodCostByCategory[cat] || 0) + cost;
  }

  let opexTotal = 0, payrollTotal = 0;
  const opexByCenter = {};
  for (const o of dayOpex) {
    opexTotal += (o.amount || 0);
    const cc = o.cost_center_name || o.type || 'Otros';
    opexByCenter[cc] = (opexByCenter[cc] || 0) + (o.amount || 0);
    if (o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll')) {
      payrollTotal += (o.amount || 0);
    }
  }

  const grossProfit = netSales - foodCostTotal;
  const netProfit = grossProfit - opexTotal;
  const txCount = daySales.length;

  return {
    restaurant_id: rid,
    date: dateStr,
    net_sales: netSales,
    gross_sales: grossSales,
    transactions_count: txCount,
    guests_count: guests,
    avg_ticket: txCount > 0 ? Math.round(netSales / txCount) : 0,
    tips_total: tips,
    discounts_total: discounts,
    cancelled_count: cancelledCount,
    delivery_count: deliveryCount,
    local_count: localCount,
    sales_by_payment: salesByPayment,
    sales_by_category: salesByCategory,
    sales_by_delivery_source: salesByDeliverySource,
    food_cost_total: foodCostTotal,
    food_cost_by_category: foodCostByCategory,
    opex_total: opexTotal,
    opex_by_center: opexByCenter,
    payroll_total: payrollTotal,
    gross_profit: grossProfit,
    net_profit: netProfit,
    food_cost_percent: netSales > 0 ? Math.round((foodCostTotal / netSales) * 1000) / 10 : 0,
    opex_percent: netSales > 0 ? Math.round((opexTotal / netSales) * 1000) / 10 : 0,
    net_margin_percent: netSales > 0 ? Math.round((netProfit / netSales) * 1000) / 10 : 0,
  };
}

async function processOneDate(rid, dateStr, tz) {
  const allSales = await store.filter('Sale', { restaurant_id: rid });
  const allSupply = await store.filter('SupplyCost', { restaurant_id: rid, date: dateStr });
  const allOpex = await store.filter('OpEx', { restaurant_id: rid, date: dateStr });

  const daySales = [];
  let cancelledCount = 0;
  for (const s of allSales) {
    if (!s.date_time) continue;
    if (getLocalDate(s.date_time, tz) !== dateStr) continue;
    if (s.is_cancelled) { cancelledCount++; continue; }
    daySales.push(s);
  }

  const daySupply = allSupply.filter((c) => c.payment_status === 'pagado');
  const dayOpex = allOpex.filter((o) => o.payment_status === 'pagado');

  const metrics = buildDayMetrics(rid, dateStr, daySales, cancelledCount, daySupply, dayOpex);
  const hasActivity = metrics.net_sales > 0 || metrics.transactions_count > 0 ||
    metrics.food_cost_total > 0 || metrics.opex_total > 0;

  const existing = await store.filter('DailyMetrics', { restaurant_id: rid, date: dateStr });
  if (!hasActivity) {
    if (existing.length > 0) {
      await store.delete('DailyMetrics', existing[0].id);
      return { date: dateStr, action: 'deleted_empty' };
    }
    return { date: dateStr, action: 'skipped_empty' };
  }

  if (existing.length > 0) {
    await store.update('DailyMetrics', existing[0].id, metrics);
    return { date: dateStr, action: 'updated', metrics };
  }
  await store.create('DailyMetrics', metrics);
  return { date: dateStr, action: 'created', metrics };
}

export async function calculateDailyMetrics({ restaurant_id, restaurantId, date, dates, tz = 'America/Santiago' } = {}) {
  const rid = restaurant_id || restaurantId;
  if (!rid) return { ok: false, message: 'restaurant_id requerido' };
  const list = dates && dates.length ? dates : (date ? [date] : [todayLocal(tz)]);
  const results = [];
  for (const d of list) {
    try { results.push(await processOneDate(rid, d, tz)); }
    catch (err) { results.push({ date: d, action: 'error', error: err.message }); }
  }
  return { ok: true, processed: results.length, results };
}

export async function recalcSingleDayMetrics({ restaurant_id, restaurantId, date, tz = 'America/Santiago' } = {}) {
  return calculateDailyMetrics({ restaurant_id: restaurant_id || restaurantId, date, tz });
}

export async function calculateEmployeeMetrics({ restaurant_id, restaurantId, date, tz = 'America/Santiago' } = {}) {
  const rid = restaurant_id || restaurantId;
  if (!rid) return { ok: false, message: 'restaurant_id requerido' };
  const dateStr = date || todayLocal(tz);

  const sales = await store.filter('Sale', { restaurant_id: rid });
  const daySales = sales.filter((s) => s.date_time && getLocalDate(s.date_time, tz) === dateStr && !s.is_cancelled);

  const byEmployee = {};
  for (const s of daySales) {
    const empId = s.employee_id || 'sin_asignar';
    if (!byEmployee[empId]) byEmployee[empId] = { employee_id: empId, sales_count: 0, sales_total: 0, tips_total: 0 };
    byEmployee[empId].sales_count++;
    byEmployee[empId].sales_total += (s.total_amount || 0);
    byEmployee[empId].tips_total += (s.tip_total || 0);
  }

  const records = [];
  for (const empId of Object.keys(byEmployee)) {
    const data = { ...byEmployee[empId], restaurant_id: rid, date: dateStr };
    const existing = await store.filter('EmployeeMetrics', { restaurant_id: rid, date: dateStr, employee_id: empId });
    if (existing.length > 0) records.push(await store.update('EmployeeMetrics', existing[0].id, data));
    else records.push(await store.create('EmployeeMetrics', data));
  }
  return { ok: true, processed: records.length, records };
}

// ───────────────────────── alerts ─────────────────────────

export async function runScheduledAlertAnalysis({ restaurant_id, restaurantId } = {}) {
  const rid = restaurant_id || restaurantId;
  if (!rid) return { ok: false, message: 'restaurant_id requerido' };

  const supplies = await store.filter('SupplyItem', { restaurant_id: rid });
  const lowStock = supplies.filter((s) => (s.stock || 0) < (s.min_stock || 0));

  const now = new Date().toISOString();
  let created = 0;
  for (const item of lowStock) {
    // Evitar duplicados: verificar si ya existe alerta no resuelta para el mismo item
    const existing = await store.filter('Alert', {
      restaurant_id: rid, alert_type: 'low_stock', source_id: item.id, is_resolved: false,
    });
    if (existing.length > 0) continue;

    await store.create('Alert', {
      restaurant_id: rid,
      alert_type: 'low_stock',
      severity: (item.stock || 0) === 0 ? 'critical' : 'warning',
      title: `Stock bajo: ${item.name}`,
      message: `${item.name} tiene ${item.stock || 0} ${item.unit || 'u'} (mínimo: ${item.min_stock || 0})`,
      source_id: item.id,
      is_resolved: false,
      is_read: false,
      created_at: now,
    });
    created++;
  }
  return { ok: true, alerts_created: created, low_stock_items: lowStock.length };
}

export async function triggerAlertOnDataChange({ entityType, action, data } = {}) {
  // Solo alerta para eventos importantes de bajo stock al actualizar SupplyItem
  if (entityType === 'SupplyItem' && action === 'update' && data?.id) {
    const item = await store.get('SupplyItem', data.id);
    if (item && (item.stock || 0) < (item.min_stock || 0)) {
      return runScheduledAlertAnalysis({ restaurant_id: item.restaurant_id });
    }
  }
  return { ok: true };
}

// ───────────────────────── bulk delete / copilot data ─────────────────────────

export async function bulkDeleteData({ entityType, ids } = {}) {
  if (!entityType || !Array.isArray(ids)) return { ok: false, message: 'entityType e ids[] requeridos' };
  let deleted = 0;
  for (const id of ids) {
    try { await store.delete(entityType, id); deleted++; } catch { /* ignore */ }
  }
  return { ok: true, deleted };
}

export async function deleteIaRestaurantData({ restaurant_id, restaurantId } = {}) {
  const rid = restaurant_id || restaurantId;
  if (!rid) return { ok: false, message: 'restaurant_id requerido' };
  const entities = ['Sale', 'SupplyCost', 'OpEx', 'Alert', 'DailyMetrics', 'EmployeeMetrics', 'StockMovement'];
  let total = 0;
  for (const ent of entities) {
    const items = await store.filter(ent, { restaurant_id: rid });
    for (const it of items) { await store.delete(ent, it.id); total++; }
  }
  return { ok: true, deleted: total };
}

export async function noaCopilotData({ restaurant_id, restaurantId } = {}) {
  const rid = restaurant_id || restaurantId;
  if (!rid) return { ok: false, message: 'restaurant_id requerido' };

  const [restaurant, supplies, recipes, sales, suppliers, alerts] = await Promise.all([
    store.get('Restaurant', rid),
    store.filter('SupplyItem', { restaurant_id: rid }),
    store.filter('Recipe', { restaurant_id: rid }),
    store.filter('Sale', { restaurant_id: rid }),
    store.filter('Supplier', { restaurant_id: rid }),
    store.filter('Alert', { restaurant_id: rid, is_resolved: false }),
  ]);

  const today = todayLocal();
  const todaySales = sales.filter((s) => s.date_time && getLocalDate(s.date_time) === today && !s.is_cancelled);
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const lowStock = supplies.filter((s) => (s.stock || 0) < (s.min_stock || 0));

  return {
    ok: true,
    data: {
      restaurant: restaurant ? { id: restaurant.id, name: restaurant.name, currency: restaurant.currency } : null,
      counts: {
        supplies: supplies.length,
        recipes: recipes.length,
        suppliers: suppliers.length,
        active_alerts: alerts.length,
        low_stock_items: lowStock.length,
      },
      today: {
        date: today,
        sales_count: todaySales.length,
        revenue: todayRevenue,
      },
      low_stock_items: lowStock.slice(0, 10).map((s) => ({ name: s.name, stock: s.stock, min_stock: s.min_stock, unit: s.unit })),
      recent_alerts: alerts.slice(0, 5).map((a) => ({ title: a.title, severity: a.severity, created_at: a.created_at })),
    },
  };
}

// ───────────────────────── Fudo & E-Bill (proxied) ─────────────────────────

import { loadIntegrations } from '@/lib/integrations';

export async function syncFudoSales({ restaurant_id, restaurantId, dateFrom, dateTo } = {}) {
  const rid = restaurant_id || restaurantId;
  if (!rid) return { ok: false, message: 'restaurant_id requerido' };
  const cfg = loadIntegrations().fudo;
  if (!cfg.apiKey || !cfg.apiSecret) {
    return { ok: false, message: 'Fudo no configurado (Settings → Integraciones)' };
  }

  const res = await fetch('/__fudo/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...cfg, dateFrom, dateTo }),
  });
  const fudoData = await res.json();
  if (!res.ok) return { ok: false, message: fudoData.error || 'Error consultando Fudo' };

  const fudoSales = fudoData.data || [];
  const created = [];
  for (const fs of fudoSales) {
    const attrs = fs.attributes || fs;
    created.push({
      restaurant_id: rid,
      external_id: fs.id,
      external_source: 'fudo',
      date_time: attrs.createdAt || attrs.date,
      total_amount: Number(attrs.total) || 0,
      subtotal_amount: Number(attrs.subtotal) || 0,
      payment_method: attrs.paymentMethod || 'Otros',
      products: attrs.items || [],
    });
  }
  if (created.length) await store.bulkCreate('Sale', created);
  await store.create('SyncLog', {
    restaurant_id: rid, source: 'fudo', synced_at: new Date().toISOString(),
    count: created.length, status: 'ok',
  });
  return { ok: true, synced: created.length };
}

export async function autoSyncFudoSales(args) {
  return syncFudoSales(args);
}

export async function testFudoConnection() {
  const cfg = loadIntegrations().fudo;
  if (!cfg.apiKey || !cfg.apiSecret) {
    return { ok: false, message: 'Fudo no configurado (Settings → Integraciones)' };
  }
  const res = await fetch('/__fudo/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, message: data.error };
  return data;
}

export async function testEbillConnection() {
  return { ok: false, message: 'E-Bill no implementado en modo local (requiere credenciales y endpoints específicos)' };
}

// ───────────────────────── dispatcher ─────────────────────────

const REGISTRY = {
  findEntityByName,
  deductStockOnSale,
  reverseStockOnSaleChange,
  reverseStockOnPurchaseDelete,
  calculateDailyMetrics,
  recalcSingleDayMetrics,
  calculateEmployeeMetrics,
  runScheduledAlertAnalysis,
  triggerAlertOnDataChange,
  bulkDeleteData,
  deleteIaRestaurantData,
  noaCopilotData,
  syncFudoSales,
  autoSyncFudoSales,
  testFudoConnection,
  testEbillConnection,
};

export async function invokeFunction(name, args = {}) {
  const fn = REGISTRY[name];
  if (!fn) {
    console.warn(`[b44-mock] función no implementada: ${name}`);
    return { ok: true, mock: true, message: `Función '${name}' no implementada en local` };
  }
  try {
    return await fn(args || {});
  } catch (err) {
    console.error(`[b44-mock] ${name} falló:`, err);
    return { ok: false, error: err.message };
  }
}
