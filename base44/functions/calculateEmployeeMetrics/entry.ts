import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

function pad(n) { return String(n).padStart(2, '0'); }

function getLocalDate(isoString, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(isoString));
  } catch (e) { return null; }
}

async function withRetry(fn, label) {
  for (var attempt = 0; attempt < 4; attempt++) {
    try { return await fn(); } catch (err) {
      var msg = (err.message || '').toLowerCase();
      if ((msg.indexOf('rate limit') >= 0 || msg.indexOf('decompress') >= 0 || msg.indexOf('network') >= 0) && attempt < 3) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

Deno.serve(async function(req) {
  var startTime = Date.now();
  console.log('[EmployeeMetrics] Handler started');

  try {
    var base44 = createClientFromRequest(req);

    var isAuthorized = false;
    try {
      var user = await base44.auth.me();
      if (user && user.role === 'admin') isAuthorized = true;
    } catch (e) {}
    if (!isAuthorized) {
      try { await base44.asServiceRole.entities.Restaurant.list('-created_date', 1); isAuthorized = true; }
      catch (e) { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
    }

    var restaurants = await base44.asServiceRole.entities.Restaurant.filter({ is_active: true });
    console.log('[EmployeeMetrics] Found ' + restaurants.length + ' restaurants');

    var now = new Date();
    var curKey = now.getFullYear() + '-' + pad(now.getMonth() + 1);
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var prevKey = prev.getFullYear() + '-' + pad(prev.getMonth() + 1);
    var yearKey = String(now.getFullYear());

    var totalCreated = 0, totalUpdated = 0;
    var results = [];

    for (var ri = 0; ri < restaurants.length; ri++) {
      if (Date.now() - startTime > 50000) {
        console.warn('[EmployeeMetrics] Timeout, stopping');
        break;
      }

      var rest = restaurants[ri];
      var rid = rest.id;
      var tz = rest.timezone || 'America/Santiago';

      try {
        console.log('[EmployeeMetrics] Processing ' + rest.name);

        var rawSales = await withRetry(function() {
          return base44.asServiceRole.entities.Sale.filter({ restaurant_id: rid, is_cancelled: false }, '-created_date', 500);
        }, 'Sale');
        var sales = Array.isArray(rawSales) ? rawSales : [];
        console.log('[EmployeeMetrics] ' + rest.name + ': ' + sales.length + ' sales');

        // Annotate with local date
        for (var si = 0; si < sales.length; si++) {
          var s = sales[si];
          if (s.date_time) {
            var ld = getLocalDate(s.date_time, tz);
            s._ym = ld ? ld.substring(0, 7) : null;
            s._yr = ld ? ld.substring(0, 4) : null;
          }
        }

        var periodKeys = [
          { key: curKey, type: 'monthly' },
          { key: prevKey, type: 'monthly' },
          { key: yearKey, type: 'cumulative' }
        ];

        var restCreated = 0, restUpdated = 0;

        for (var pi = 0; pi < periodKeys.length; pi++) {
          var period = periodKeys[pi];
          var pSales = [];
          for (var j = 0; j < sales.length; j++) {
            if (period.type === 'monthly' && sales[j]._ym === period.key) pSales.push(sales[j]);
            else if (period.type === 'cumulative' && sales[j]._yr === period.key) pSales.push(sales[j]);
          }

          // Group by waiter
          var byWaiter = {};
          for (var k = 0; k < pSales.length; k++) {
            var sale = pSales[k];
            var wn = (sale.waiter_name || '').trim();
            if (!wn || wn === 'Sin asignar') continue;
            var wk = wn.toLowerCase();
            if (!byWaiter[wk]) byWaiter[wk] = { name: wn, sales: 0, tips: 0, tx: 0, guests: 0 };
            byWaiter[wk].sales += (sale.total_amount || 0);
            byWaiter[wk].tips += (sale.tip_amount || 0);
            byWaiter[wk].tx += 1;
            byWaiter[wk].guests += (sale.num_guests || 0);
          }

          var ranked = Object.values(byWaiter).sort(function(a, b) { return b.sales - a.sales; });

          for (var wi = 0; wi < ranked.length; wi++) {
            var w = ranked[wi];
            if (w.sales <= 0 && w.tx <= 0) continue;

            var data = {
              restaurant_id: rid,
              period: period.key,
              period_type: period.type,
              waiter_name: w.name,
              total_sales: Math.round(w.sales * 100) / 100,
              total_tips: Math.round(w.tips * 100) / 100,
              transactions: w.tx,
              guests: w.guests,
              avg_ticket: w.tx > 0 ? Math.round(w.sales / w.tx) : 0,
              tip_pct: w.sales > 0 ? Math.round((w.tips / w.sales) * 1000) / 10 : 0,
              rank_position: wi + 1,
              calculated_at: now.toISOString()
            };

            var query = { restaurant_id: rid, period: period.key, waiter_name: w.name };
            var existing = await withRetry(function() {
              return base44.asServiceRole.entities.EmployeeMetrics.filter(query);
            }, 'EM.filter');
            var arr = Array.isArray(existing) ? existing : [];

            if (arr.length > 0) {
              var uid = arr[0].id;
              var ud = data;
              await withRetry(function() { return base44.asServiceRole.entities.EmployeeMetrics.update(uid, ud); }, 'EM.update');
              restUpdated++;
            } else {
              var cd = data;
              await withRetry(function() { return base44.asServiceRole.entities.EmployeeMetrics.create(cd); }, 'EM.create');
              restCreated++;
            }

            if (wi % 5 === 4) await sleep(100);
          }
        }

        totalCreated += restCreated;
        totalUpdated += restUpdated;
        results.push({ restaurant: rest.name, created: restCreated, updated: restUpdated });
        console.log('[EmployeeMetrics] ' + rest.name + ': ' + restCreated + ' created, ' + restUpdated + ' updated');

      } catch (err) {
        console.error('[EmployeeMetrics] Error ' + rest.name + ': ' + err.message);
        results.push({ restaurant: rest.name, error: err.message });
      }

      if (ri < restaurants.length - 1) await sleep(300);
    }

    return Response.json({
      success: true,
      duration_ms: Date.now() - startTime,
      restaurantsProcessed: results.length,
      metricsCreated: totalCreated,
      metricsUpdated: totalUpdated,
      results: results
    });

  } catch (error) {
    console.error('[calculateEmployeeMetrics] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});