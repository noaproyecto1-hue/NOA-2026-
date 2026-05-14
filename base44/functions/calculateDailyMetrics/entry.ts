import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MAX_RUNTIME_MS = 45000;

function getLocalDate(isoString, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(isoString));
  } catch (e) { return null; }
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function fetchAllPaginated(entityRef, filter, sort, pageSize) {
  if (!pageSize) pageSize = 500;
  var all = [];
  var skip = 0;
  while (true) {
    var batch = await withRetry(function() {
      return entityRef.filter(filter, sort, pageSize, skip);
    }, 'fetchAllPaginated');
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
    await sleep(150);
  }
  return all;
}

async function withRetry(operation, label, retries) {
  if (!retries) retries = 4;
  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      var msg = (error && error.message ? error.message : '').toLowerCase();
      var isRetryable = msg.indexOf('rate limit') >= 0 || msg.indexOf('too many') >= 0
        || msg.indexOf('decompress') >= 0 || msg.indexOf('network') >= 0;
      if (!isRetryable || attempt === retries) throw error;
      var delay = 500 * (attempt + 1) + Math.floor(Math.random() * 400);
      console.warn('[DailyMetrics] Retryable error on ' + label + ': ' + error.message + ', retry ' + (attempt + 1) + ' in ' + delay + 'ms');
      await sleep(delay);
    }
  }
}

function calcNetSales(sales) {
  var sum = 0;
  for (var i = 0; i < sales.length; i++) {
    var s = sales[i];
    var amount = s.total_amount || s.subtotal || 0;
    if (!amount) continue;
    if (s.applies_tax === false) { sum += amount; continue; }
    var taxRate = s.tax_rate || 19;
    sum += Math.round(amount / (1 + taxRate / 100));
  }
  return sum;
}

function buildDayMetrics(rid, dateStr, daySales, cancelledCount, daySupply, dayOpex) {
  var netSales = calcNetSales(daySales);
  var grossSales = 0, guests = 0, tips = 0, discounts = 0, deliveryCount = 0, localCount = 0;
  var salesByPayment = {}, salesByCategory = {}, salesByDeliverySource = {};

  for (var i = 0; i < daySales.length; i++) {
    var s = daySales[i];
    grossSales += (s.total_amount || 0);
    guests += (s.num_guests || 0);
    tips += (s.tip_amount || 0);
    discounts += (s.discount_amount || 0);

    if (s.sale_type === 'delivery') {
      deliveryCount++;
      var src = s.delivery_source || 'Directo';
      salesByDeliverySource[src] = (salesByDeliverySource[src] || 0) + 1;
    } else {
      localCount++;
    }

    var pm = s.payment_method || 'Otro';
    salesByPayment[pm] = (salesByPayment[pm] || 0) + (s.total_amount || 0);

    if (s.products) {
      for (var j = 0; j < s.products.length; j++) {
        var p = s.products[j];
        if (p.is_cancelled) continue;
        var cat = p.category || 'Sin categoria';
        salesByCategory[cat] = (salesByCategory[cat] || 0) + ((p.unit_price || 0) * (p.quantity || 1));
      }
    }
  }

  var foodCostTotal = 0;
  var foodCostByCategory = {};
  for (var i = 0; i < daySupply.length; i++) {
    var c = daySupply[i];
    var cost = c.total_cost || c.subtotal || 0;
    foodCostTotal += cost;
    var scat = c.supply_category || 'General';
    foodCostByCategory[scat] = (foodCostByCategory[scat] || 0) + cost;
  }

  var opexTotal = 0;
  var opexByCenter = {};
  var payrollTotal = 0;
  for (var i = 0; i < dayOpex.length; i++) {
    var o = dayOpex[i];
    opexTotal += (o.amount || 0);
    var cc = o.cost_center_name || o.type || 'Otros';
    opexByCenter[cc] = (opexByCenter[cc] || 0) + (o.amount || 0);
    if (o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().indexOf('payroll') >= 0) {
      payrollTotal += (o.amount || 0);
    }
  }

  var grossProfit = netSales - foodCostTotal;
  var netProfit = grossProfit - opexTotal;
  var txCount = daySales.length;

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
    net_margin_percent: netSales > 0 ? Math.round((netProfit / netSales) * 1000) / 10 : 0
  };
}

async function processOneDate(base44, rid, dateStr, tz) {
  // Fetch ALL sales with pagination to avoid missing older records
  var recentSales = await fetchAllPaginated(
    base44.asServiceRole.entities.Sale,
    { restaurant_id: rid },
    '-created_date',
    500
  );

  var daySupplyAll = await withRetry(function() {
    return base44.asServiceRole.entities.SupplyCost.filter({ restaurant_id: rid, date: dateStr }, '-created_date', 500);
  }, 'SupplyCost.filter');
  var dayOpexAll = await withRetry(function() {
    return base44.asServiceRole.entities.OpEx.filter({ restaurant_id: rid, date: dateStr }, '-created_date', 500);
  }, 'OpEx.filter');

  var daySales = [];
  var cancelledCount = 0;
  for (var i = 0; i < recentSales.length; i++) {
    var s = recentSales[i];
    if (!s.date_time) continue;
    var saleDate = getLocalDate(s.date_time, tz);
    if (saleDate !== dateStr) continue;
    if (s.is_cancelled) { cancelledCount++; continue; }
    daySales.push(s);
  }

  var daySupply = daySupplyAll.filter(function(c) { return c.payment_status === 'pagado'; });
  var dayOpex = dayOpexAll.filter(function(o) { return o.payment_status === 'pagado'; });

  console.log('[DailyMetrics] ' + dateStr + ': ' + daySales.length + ' sales, ' + daySupply.length + ' supplies, ' + dayOpex.length + ' opex');

  var metricsData = buildDayMetrics(rid, dateStr, daySales, cancelledCount, daySupply, dayOpex);

  var hasActivity = metricsData.net_sales > 0 || metricsData.gross_sales > 0 ||
    metricsData.transactions_count > 0 || metricsData.food_cost_total > 0 ||
    metricsData.opex_total > 0 || metricsData.tips_total > 0;

  var existing = await withRetry(function() {
    return base44.asServiceRole.entities.DailyMetrics.filter({ restaurant_id: rid, date: dateStr });
  }, 'DailyMetrics.filter');

  if (!hasActivity) {
    if (existing.length > 0) {
      var ex = existing[0];
      var exHas = (ex.net_sales || 0) > 0 || (ex.gross_sales || 0) > 0 ||
        (ex.transactions_count || 0) > 0 || (ex.food_cost_total || 0) > 0 ||
        (ex.opex_total || 0) > 0 || (ex.tips_total || 0) > 0;
      if (!exHas) {
        await withRetry(function() { return base44.asServiceRole.entities.DailyMetrics.delete(ex.id); }, 'DailyMetrics.delete');
        return { date: dateStr, action: 'deleted_empty' };
      }
    }
    return { date: dateStr, action: 'skipped_empty' };
  }

  if (existing.length > 0) {
    await withRetry(function() { return base44.asServiceRole.entities.DailyMetrics.update(existing[0].id, metricsData); }, 'DailyMetrics.update');
    return { date: dateStr, action: 'updated' };
  } else {
    await withRetry(function() { return base44.asServiceRole.entities.DailyMetrics.create(metricsData); }, 'DailyMetrics.create');
    return { date: dateStr, action: 'created' };
  }
}

Deno.serve(async function(req) {
  var startTime = Date.now();

  try {
    var base44 = createClientFromRequest(req);

    var isAuthorized = false;
    try {
      var user = await base44.auth.me();
      if (user && user.role === 'admin') isAuthorized = true;
    } catch (e) {}
    if (!isAuthorized) {
      try {
        await base44.asServiceRole.entities.Restaurant.list('-created_date', 1);
        isAuthorized = true;
      } catch (e) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    var body = {};
    try { body = await req.json(); } catch (e) {}
    var backfillDays = body.backfill_days || 1;
    var specificDate = body.date;
    var specificRestaurantId = body.restaurant_id;

    var restaurants;
    if (specificRestaurantId) {
      restaurants = await withRetry(function() { return base44.asServiceRole.entities.Restaurant.filter({ id: specificRestaurantId }); }, 'Restaurant.filter');
    } else {
      restaurants = await withRetry(function() { return base44.asServiceRole.entities.Restaurant.filter({ is_active: true }); }, 'Restaurant.filter');
    }

    console.log('[DailyMetrics] Processing ' + restaurants.length + ' restaurants, ' + backfillDays + ' day(s)');

    var allResults = [];
    var timedOut = false;

    for (var ri = 0; ri < restaurants.length; ri++) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.warn('[DailyMetrics] Safety timeout after ' + ri + '/' + restaurants.length + ' restaurants');
        timedOut = true;
        break;
      }

      var restaurant = restaurants[ri];
      var tz = restaurant.timezone || 'America/Santiago';

      var dates = [];
      if (specificDate) {
        dates.push(specificDate);
      } else {
        for (var d = 1; d <= backfillDays; d++) {
          var target = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
          var dateStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
          }).format(target);
          dates.push(dateStr);
        }
      }

      var dateResults = [];
      for (var di = 0; di < dates.length; di++) {
        try {
          var result = await processOneDate(base44, restaurant.id, dates[di], tz);
          dateResults.push(result);
          console.log('[DailyMetrics] ' + restaurant.name + ' ' + dates[di] + ': ' + result.action);
        } catch (err) {
          console.error('[DailyMetrics] Error ' + restaurant.name + ' ' + dates[di] + ':', err.message);
          dateResults.push({ date: dates[di], error: err.message });
        }
      }

      allResults.push({ restaurant: restaurant.name, dates: dateResults });

      if (ri < restaurants.length - 1) {
        await sleep(200 + Math.floor(Math.random() * 200));
      }
    }

    return Response.json({
      success: true,
      restaurantsProcessed: allResults.length,
      totalRestaurants: restaurants.length,
      timedOut: timedOut,
      duration_ms: Date.now() - startTime,
      results: allResults
    });

  } catch (error) {
    console.error('[calculateDailyMetrics] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});