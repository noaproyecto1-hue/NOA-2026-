import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * recalcSingleDayMetrics v3 — Triggered by entity automations
 * 
 * Called when Sale, SupplyCost, or OpEx is created/updated/deleted.
 * Recalculates DailyMetrics for the affected date(s).
 * 
 * OPTIMIZED: Uses single filter() calls with native index instead of
 * downloading ALL records and filtering in memory.
 */

function getLocalDate(isoString, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(isoString));
  } catch { return null; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimitError(error) {
  const message = error?.message || '';
  return message.toLowerCase().includes('rate limit');
}

async function withRateLimitRetry(operation, label, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRateLimitError(error) || attempt === retries) {
        throw error;
      }
      const delay = 300 * (attempt + 1) + Math.floor(Math.random() * 250);
      console.warn(`[recalcSingleDay] Rate limit on ${label}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
      await sleep(delay);
    }
  }
}

function calcNetSales(sales) {
  let sum = 0;
  for (const s of sales) {
    const amount = s.total_amount || s.subtotal || 0;
    if (!amount) continue;
    if (s.applies_tax === false) { sum += amount; continue; }
    const taxRate = s.tax_rate || 19;
    sum += Math.round(amount / (1 + taxRate / 100));
  }
  return sum;
}

function buildDayMetrics(rid, dateStr, daySales, cancelledCount, daySupply, dayOpex) {
  const netSales = calcNetSales(daySales);
  const grossSales = daySales.reduce((s, sale) => s + (sale.total_amount || 0), 0);
  const txCount = daySales.length;
  const guests = daySales.reduce((s, sale) => s + (sale.num_guests || 0), 0);
  const tips = daySales.reduce((s, sale) => s + (sale.tip_amount || 0), 0);
  const discounts = daySales.reduce((s, sale) => s + (sale.discount_amount || 0), 0);
  const deliveries = daySales.filter(s => s.sale_type === 'delivery');
  const locals = daySales.filter(s => s.sale_type !== 'delivery');

  const salesByPayment = {};
  for (const s of daySales) {
    const pm = s.payment_method || 'Otro';
    salesByPayment[pm] = (salesByPayment[pm] || 0) + (s.total_amount || 0);
  }

  const salesByCategory = {};
  for (const s of daySales) {
    if (s.products) {
      for (const p of s.products) {
        if (p.is_cancelled) continue;
        const cat = p.category || 'Sin categoría';
        salesByCategory[cat] = (salesByCategory[cat] || 0) + ((p.unit_price || 0) * (p.quantity || 1));
      }
    }
  }

  const salesByDeliverySource = {};
  for (const s of deliveries) {
    const src = s.delivery_source || 'Directo';
    salesByDeliverySource[src] = (salesByDeliverySource[src] || 0) + 1;
  }

  const foodCostTotal = daySupply.reduce((s, c) => s + (c.total_cost || c.subtotal || 0), 0);
  const foodCostByCategory = {};
  for (const c of daySupply) {
    const cat = c.supply_category || 'General';
    foodCostByCategory[cat] = (foodCostByCategory[cat] || 0) + (c.total_cost || c.subtotal || 0);
  }

  const opexTotal = dayOpex.reduce((s, o) => s + (o.amount || 0), 0);
  const opexByCenter = {};
  for (const o of dayOpex) {
    const cc = o.cost_center_name || o.type || 'Otros';
    opexByCenter[cc] = (opexByCenter[cc] || 0) + (o.amount || 0);
  }

  const payrollTotal = dayOpex
    .filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll'))
    .reduce((s, o) => s + (o.amount || 0), 0);

  const grossProfit = netSales - foodCostTotal;
  const netProfit = grossProfit - opexTotal;

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
    delivery_count: deliveries.length,
    local_count: locals.length,
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

function extractDateStr(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    if (dateVal.includes('T')) return dateVal.split('T')[0];
    return dateVal;
  }
  return null;
}

async function recalcDay(base44, restaurantId, dateStr, tz) {
  console.log(`[recalcSingleDay] Recalculating ${restaurantId} for ${dateStr}`);

  // Spread bursty entity automations a bit to reduce contention during imports/syncs
  await sleep(Math.floor(Math.random() * 250));

  // Efficient: single filter() calls with native index, filter by date in memory for sales
  const [recentSales, daySupplyAll, dayOpexAll] = await Promise.all([
    withRateLimitRetry(() => base44.asServiceRole.entities.Sale.filter({ restaurant_id: restaurantId }, '-created_date', 2000), 'Sale.filter'),
    withRateLimitRetry(() => base44.asServiceRole.entities.SupplyCost.filter({ restaurant_id: restaurantId, date: dateStr }, '-created_date', 500), 'SupplyCost.filter'),
    withRateLimitRetry(() => base44.asServiceRole.entities.OpEx.filter({ restaurant_id: restaurantId, date: dateStr }, '-created_date', 500), 'OpEx.filter'),
  ]);

  // Filter sales by timezone-aware date
  const daySales = [];
  let cancelledCount = 0;
  for (const s of recentSales) {
    if (!s.date_time) continue;
    const saleDate = getLocalDate(s.date_time, tz);
    if (saleDate !== dateStr) continue;
    if (s.is_cancelled) { cancelledCount++; continue; }
    daySales.push(s);
  }

  const daySupply = daySupplyAll.filter(c => c.payment_status === 'pagado');
  const dayOpex = dayOpexAll.filter(o => o.payment_status === 'pagado');

  console.log(`[recalcSingleDay] ${dateStr}: ${daySales.length} sales, ${daySupply.length} supplies, ${dayOpex.length} opex`);

  const metricsData = buildDayMetrics(restaurantId, dateStr, daySales, cancelledCount, daySupply, dayOpex);

  // Skip saving records where everything is 0 (no activity that day)
  const hasActivity = metricsData.net_sales > 0 || metricsData.gross_sales > 0 || 
    metricsData.transactions_count > 0 || metricsData.food_cost_total > 0 || 
    metricsData.opex_total > 0 || metricsData.tips_total > 0;

  const existing = await withRateLimitRetry(() => base44.asServiceRole.entities.DailyMetrics.filter({
    restaurant_id: restaurantId,
    date: dateStr
  }), 'DailyMetrics.filter');

  if (!hasActivity) {
    // If existing record also has no activity, delete it
    if (existing.length > 0) {
      const ex = existing[0];
      const existingHasActivity = (ex.net_sales || 0) > 0 || (ex.gross_sales || 0) > 0 || 
        (ex.transactions_count || 0) > 0 || (ex.food_cost_total || 0) > 0 || 
        (ex.opex_total || 0) > 0 || (ex.tips_total || 0) > 0;
      if (!existingHasActivity) {
        await withRateLimitRetry(() => base44.asServiceRole.entities.DailyMetrics.delete(ex.id), 'DailyMetrics.delete');
        return { action: 'deleted_empty', date: dateStr };
      }
    }
    console.log(`[recalcSingleDay] ${dateStr}: skipped (no activity)`);
    return { action: 'skipped_empty', date: dateStr };
  }

  if (existing.length > 0) {
    await withRateLimitRetry(() => base44.asServiceRole.entities.DailyMetrics.update(existing[0].id, metricsData), 'DailyMetrics.update');
    return { action: 'updated', date: dateStr };
  } else {
    await withRateLimitRetry(() => base44.asServiceRole.entities.DailyMetrics.create(metricsData), 'DailyMetrics.create');
    return { action: 'created', date: dateStr };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // --- Called from entity automation ---
    if (body.event) {
      const entityName = body.event.entity_name;
      const data = body.data || {};
      const oldData = body.old_data || {};

      const restaurantId = data.restaurant_id || oldData.restaurant_id;
      if (!restaurantId) {
        console.log('[recalcSingleDay] No restaurant_id found, skipping');
        return Response.json({ skipped: true, reason: 'no_restaurant_id' });
      }

      // Get restaurant timezone (single lightweight call)
      const restaurants = await withRateLimitRetry(() => base44.asServiceRole.entities.Restaurant.filter({ id: restaurantId }), 'Restaurant.filter');
      const restaurant = restaurants[0];
      if (!restaurant) {
        return Response.json({ skipped: true, reason: 'restaurant_not_found' });
      }
      const tz = restaurant.timezone || 'America/Santiago';

      // Determine which date(s) to recalculate
      const datesToRecalc = new Set();

      if (entityName === 'Sale') {
        for (const dt of [data.date_time, oldData.date_time]) {
          if (!dt) continue;
          const d = getLocalDate(dt, tz);
          if (d) datesToRecalc.add(d);
        }
      } else {
        for (const d of [extractDateStr(data.date), extractDateStr(oldData.date)]) {
          if (d) datesToRecalc.add(d);
        }
      }

      if (datesToRecalc.size === 0) {
        return Response.json({ skipped: true, reason: 'no_date' });
      }

      const results = [];
      for (const dateStr of datesToRecalc) {
        const result = await recalcDay(base44, restaurantId, dateStr, tz);
        results.push(result);
      }

      return Response.json({ success: true, results });
    }

    // --- Called manually ---
    const { restaurant_id, date } = body;
    if (!restaurant_id || !date) {
      return Response.json({ error: 'restaurant_id and date are required' }, { status: 400 });
    }

    const restaurants = await withRateLimitRetry(() => base44.asServiceRole.entities.Restaurant.filter({ id: restaurant_id }), 'Restaurant.filter');
    const tz = restaurants[0]?.timezone || 'America/Santiago';

    const result = await recalcDay(base44, restaurant_id, date, tz);
    return Response.json({ success: true, ...result });

  } catch (error) {
    console.error('[recalcSingleDay] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});