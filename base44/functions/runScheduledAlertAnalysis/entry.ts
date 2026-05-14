import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Orchestrator v3: resilient version with retries, reduced limits, sequential fetches
// Fixes 502 UNCAUGHT_EXCEPTION caused by Brotli decompression on large payloads

const MAX_RUNTIME_MS = 50000;

const DEFAULT_THRESHOLDS = {
  cost_spike: { red: 20, yellow: 15, green: 10 },
  food_cost_percent: { red: 40, yellow: 35, green: 30 },
  labor_cost_spike: { red: 25, yellow: 15, green: 10 },
  labor_cost_percent: { red: 30, yellow: 25, green: 20 },
  opex_spike: { red: 30, yellow: 22, green: 15 },
  sales_drop: { red: 15, yellow: 10, green: 5 },
  ebitda_margin: { red: 3, yellow: 5, green: 10 },
  supply_price_change: { green: 5, yellow: 10, red: 15 },
};

const getSev = (value, th) => {
  if (!th) return 'yellow';
  if (value >= th.red) return 'red';
  if (value >= th.yellow) return 'yellow';
  return 'green';
};

function pad(n) { return String(n).padStart(2, '0'); }

function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

async function withRetry(operation, label, retries) {
  if (!retries) retries = 3;
  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      var msg = (error && error.message ? error.message : '').toLowerCase();
      var isRetryable = msg.indexOf('rate limit') >= 0 || msg.indexOf('too many') >= 0
        || msg.indexOf('decompress') >= 0 || msg.indexOf('network') >= 0
        || msg.indexOf('fetch failed') >= 0;
      if (!isRetryable || attempt === retries) throw error;
      var delay = 500 * (attempt + 1) + Math.floor(Math.random() * 400);
      console.warn('[Alert] Retryable error on ' + label + ': ' + error.message + ', retry ' + (attempt + 1));
      await sleep(delay);
    }
  }
}

async function processRestaurant(base44, restaurant) {
  var rid = restaurant.id;
  var tz = restaurant.timezone || 'America/Santiago';

  var nowStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  var parts = nowStr.split('-');
  var y = parseInt(parts[0]), m = parseInt(parts[1]) - 1, day = parseInt(parts[2]);

  var curFrom = y + '-' + pad(m + 1) + '-01';
  var curTo = y + '-' + pad(m + 1) + '-' + pad(day);
  var pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
  var maxPD = new Date(py, pm + 1, 0).getDate();
  var prevFrom = py + '-' + pad(pm + 1) + '-01';
  var prevTo = py + '-' + pad(pm + 1) + '-' + pad(Math.min(day, maxPD));
  var comp = '(días 1-' + day + ' vs mes anterior)';

  // Use DailyMetrics instead of raw Sales to avoid massive payload crashes
  // DailyMetrics already has pre-aggregated net_sales, food_cost, opex, etc.
  var rawMetrics = await withRetry(function() {
    return base44.asServiceRole.entities.DailyMetrics.filter({ restaurant_id: rid }, '-date', 200);
  }, restaurant.name + '.DailyMetrics');
  var allMetrics = Array.isArray(rawMetrics) ? rawMetrics : [];

  await sleep(100);

  // Still need SupplyCost for price analysis (but with reduced limit)
  var rawSupply = await withRetry(function() {
    return base44.asServiceRole.entities.SupplyCost.filter({ restaurant_id: rid }, '-created_date', 500);
  }, restaurant.name + '.SupplyCost');
  var allSupply = Array.isArray(rawSupply) ? rawSupply : [];

  await sleep(100);

  // Lighter entities — safe in parallel
  var parallelResults = await Promise.all([
    withRetry(function() { return base44.asServiceRole.entities.Alert.filter({ restaurant_id: rid }, '-created_date', 500); }, restaurant.name + '.Alert'),
    withRetry(function() { return base44.asServiceRole.entities.SupplyItem.filter({ restaurant_id: rid }, '-created_date', 1000); }, restaurant.name + '.SupplyItem'),
  ]);
  var allAlerts = Array.isArray(parallelResults[0]) ? parallelResults[0] : [];
  var items = Array.isArray(parallelResults[1]) ? parallelResults[1] : [];

  console.log('[Alert] ' + restaurant.name + ': ' + allMetrics.length + ' metrics, ' + allSupply.length + ' supply, ' + items.length + ' items');

  // Use DailyMetrics for aggregated financial data (already pre-calculated)
  var inRangeMetrics = function(metrics, from, to) {
    return metrics.filter(function(m) { return m.date && m.date >= from && m.date <= to; });
  };

  var inRange = function(list, from, to) {
    return list.filter(function(item) {
      var d = item.date;
      if (!d) return false;
      if (d.indexOf('T') >= 0) d = d.split('T')[0];
      return d >= from && d <= to;
    });
  };

  // Cleanup old resolved alerts (batch with delays)
  var cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  var toDelete = allAlerts.filter(function(a) { return a.is_resolved && a.created_date < cutoff; });
  for (var di = 0; di < toDelete.length; di++) {
    await withRetry(function() { return base44.asServiceRole.entities.Alert.delete(toDelete[di].id); }, 'Alert.delete');
    if (di % 5 === 4) await sleep(100); // throttle deletions
  }

  var existing = allAlerts.filter(function(a) { return !a.is_resolved && !toDelete.some(function(d) { return d.id === a.id; }); });
  var hasType = function(type) { return existing.some(function(a) { return a.type === type; }); };
  var hasStock = function(type, id, name) {
    return existing.some(function(a) {
      return a.type === type && ((id && a.related_item_id === id) || (name && a.related_item_name === name));
    });
  };

  // Aggregate from DailyMetrics (already has net_sales, food_cost, opex, payroll)
  var cMetrics = inRangeMetrics(allMetrics, curFrom, curTo);
  var pMetrics = inRangeMetrics(allMetrics, prevFrom, prevTo);

  var totSales = cMetrics.reduce(function(s, m) { return s + (m.net_sales || 0); }, 0);
  var prevSalesTotal = pMetrics.reduce(function(s, m) { return s + (m.net_sales || 0); }, 0);
  var totSup = cMetrics.reduce(function(s, m) { return s + (m.food_cost_total || 0); }, 0);
  var totOp = cMetrics.reduce(function(s, m) { return s + (m.opex_total || 0); }, 0);
  var prevOp = pMetrics.reduce(function(s, m) { return s + (m.opex_total || 0); }, 0);
  var payroll = cMetrics.reduce(function(s, m) { return s + (m.payroll_total || 0); }, 0);
  var prevPay = pMetrics.reduce(function(s, m) { return s + (m.payroll_total || 0); }, 0);

  // Still need raw supply data for price analysis
  var cSup = inRange(allSupply, curFrom, curTo).filter(function(s) { return s.payment_status === 'pagado'; });
  var pSup = inRange(allSupply, prevFrom, prevTo).filter(function(s) { return s.payment_status === 'pagado'; });

  var fixedExpenses = (restaurant.config && restaurant.config.fixed_expenses || []).filter(function(e) { return e.is_active; });
  var fixed = fixedExpenses.reduce(function(sum, e) { return sum + (e.amount || 0); }, 0);
  fixed = fixed * (day / 30);
  var ebitda = totSales - totSup - totOp - fixed;
  var ebitdaPct = totSales > 0 ? (ebitda / totSales) * 100 : 0;

  var th = Object.assign({}, DEFAULT_THRESHOLDS, restaurant.alert_thresholds);
  var getTh = function(k) {
    var t = th[k];
    return (t && typeof t === 'object' && 'red' in t) ? t : DEFAULT_THRESHOLDS[k] || { green: 5, yellow: 10, red: 15 };
  };

  var newAlerts = [];

  if (totSales > 0) {
    var pct = (totSup / totSales) * 100;
    var t = getTh('food_cost_percent');
    if (pct >= t.green && !hasType('cost_increase'))
      newAlerts.push({ restaurant_id: rid, type: 'cost_increase', category: 'costo_ventas', severity: getSev(pct, t), title: 'Costo de Ventas Elevado', message: 'Food cost: ' + pct.toFixed(1) + '% sobre ventas.', suggested_action: 'Revisar porciones, reducir desperdicio.' });
  }

  if (prevSalesTotal > 0) {
    var dec = ((prevSalesTotal - totSales) / prevSalesTotal) * 100;
    var t2 = getTh('sales_drop');
    if (dec >= t2.green && !hasType('sales_decline'))
      newAlerts.push({ restaurant_id: rid, type: 'sales_decline', category: 'ebitda', severity: getSev(dec, t2), title: 'Caída en Ventas', message: 'Ventas -' + dec.toFixed(1) + '% ' + comp + '.', suggested_action: 'Implementar promociones.' });
  }

  if (prevOp > 0) {
    var spike = ((totOp - prevOp) / prevOp) * 100;
    var t3 = getTh('opex_spike');
    if (spike >= t3.green && !hasType('opex_spike'))
      newAlerts.push({ restaurant_id: rid, type: 'opex_spike', category: 'opex', severity: getSev(spike, t3), title: 'Incremento Gastos Operativos', message: 'OPEX +' + spike.toFixed(1) + '% ' + comp + '.', suggested_action: 'Revisar contratos y turnos.' });
  }

  if (prevPay > 0) {
    var inc = ((payroll - prevPay) / prevPay) * 100;
    var t4 = getTh('labor_cost_spike');
    if (inc >= t4.green && !hasType('payroll_spike'))
      newAlerts.push({ restaurant_id: rid, type: 'payroll_spike', category: 'opex', severity: getSev(inc, t4), title: 'Incremento en Nómina', message: 'Nómina +' + inc.toFixed(1) + '% ' + comp + '.', suggested_action: 'Revisar horas extras.' });
  }

  if (totSales > 0 && payroll > 0) {
    var pctL = (payroll / totSales) * 100;
    var t5 = getTh('labor_cost_percent');
    if (pctL >= t5.green && !hasType('labor_cost_high'))
      newAlerts.push({ restaurant_id: rid, type: 'labor_cost_high', category: 'opex', severity: getSev(pctL, t5), title: 'Costo Personal Elevado', message: 'Nómina: ' + pctL.toFixed(1) + '% sobre ventas.', suggested_action: 'Optimizar turnos.' });
  }

  if (totSales > 0) {
    var t6 = getTh('ebitda_margin');
    var sev = ebitdaPct <= t6.red ? 'red' : ebitdaPct <= t6.yellow ? 'yellow' : ebitdaPct <= t6.green ? 'green' : null;
    if (sev && !hasType('ebitda_low'))
      newAlerts.push({ restaurant_id: rid, type: 'ebitda_low', category: 'ebitda', severity: sev, title: 'Margen EBITDA Bajo', message: 'EBITDA: ' + ebitdaPct.toFixed(1) + '%.', suggested_action: 'Revisar precios y costos.' });
  }

  // Supply price changes
  var spTh = (restaurant.alert_thresholds && restaurant.alert_thresholds.supply_price_change) || { green: 5, yellow: 10, red: 15 };
  var avgItemsFn = function(list) {
    var mm = {};
    for (var k = 0; k < list.length; k++) {
      var c = list[k];
      var n = (c.supply_item_name || '').trim();
      if (!n) continue;
      if (!mm[n]) mm[n] = { t: 0, c: 0 };
      mm[n].t += (c.total_cost || 0);
      mm[n].c++;
    }
    var r = {};
    Object.keys(mm).forEach(function(key) { r[key] = mm[key].c > 0 ? mm[key].t / mm[key].c : 0; });
    return r;
  };
  var curAvg = avgItemsFn(cSup), prevAvgMap = avgItemsFn(pSup);
  var priceUp = [], priceDown = [];
  Object.keys(curAvg).forEach(function(item) {
    if (prevAvgMap[item] > 0) {
      var ch = ((curAvg[item] - prevAvgMap[item]) / prevAvgMap[item]) * 100;
      if (ch >= spTh.green) priceUp.push({ item: item, ch: ch });
      else if (ch <= -spTh.green) priceDown.push({ item: item, ch: ch });
    }
  });
  if (priceUp.length > 0 && !hasType('supply_price_increase')) {
    var top = priceUp.sort(function(a, b) { return b.ch - a.ch; }).slice(0, 5);
    newAlerts.push({ restaurant_id: rid, type: 'supply_price_increase', category: 'costo_ventas', severity: top[0].ch >= spTh.yellow ? 'red' : 'yellow', title: 'Subida Precios: ' + priceUp.length + ' insumo' + (priceUp.length > 1 ? 's' : ''), message: top.map(function(p) { return p.item + ' +' + p.ch.toFixed(1) + '%'; }).join(', '), suggested_action: 'Negociar con proveedores.' });
  }
  if (priceDown.length > 0 && !hasType('supply_price_decrease')) {
    var topD = priceDown.sort(function(a, b) { return a.ch - b.ch; }).slice(0, 5);
    newAlerts.push({ restaurant_id: rid, type: 'supply_price_decrease', category: 'costo_ventas', severity: 'green', title: 'Baja Precios: ' + priceDown.length + ' insumo' + (priceDown.length > 1 ? 's' : ''), message: topD.map(function(p) { return p.item + ' ' + p.ch.toFixed(1) + '%'; }).join(', '), suggested_action: 'Aprovechar precios bajos.' });
  }

  // Supplier trends
  var avgSupFn = function(list) {
    var mm = {};
    for (var k = 0; k < list.length; k++) {
      var c = list[k];
      var n = (c.supplier || '').trim();
      if (!n) continue;
      if (!mm[n]) mm[n] = { t: 0, c: 0 };
      mm[n].t += (c.total_cost || 0);
      mm[n].c++;
    }
    return mm;
  };
  var cSupM = avgSupFn(cSup), pSupM = avgSupFn(pSup);
  var rising = [];
  Object.keys(cSupM).forEach(function(n) {
    if (pSupM[n] && pSupM[n].c > 0) {
      var ch = ((cSupM[n].t / cSupM[n].c - pSupM[n].t / pSupM[n].c) / (pSupM[n].t / pSupM[n].c)) * 100;
      if (ch >= spTh.green) rising.push({ name: n, ch: ch });
    }
  });
  rising.sort(function(a, b) { return b.ch - a.ch; });
  if (rising.length > 0 && !hasType('supplier_price_trend'))
    newAlerts.push({ restaurant_id: rid, type: 'supplier_price_trend', category: 'costo_ventas', severity: 'yellow', title: 'Tendencia Alcista: ' + rising.length + ' proveedor' + (rising.length > 1 ? 'es' : ''), message: rising.slice(0, 3).map(function(s) { return s.name + ' +' + s.ch.toFixed(1) + '%'; }).join(', '), suggested_action: 'Evaluar alternativas.' });

  // === PROFORMA DEVIATION ALERTS ===
  var proforma = restaurant.proforma;
  if (proforma && totSales > 0) {
    // 1. Food Cost % vs proforma direct_cost_percent
    if (proforma.direct_cost_percent > 0) {
      var actualFcPct = (totSup / totSales) * 100;
      var idealFcPct = proforma.direct_cost_percent;
      var fcDeviation = actualFcPct - idealFcPct;
      if (fcDeviation > 2 && !hasType('proforma_deviation')) {
        var fcDevSev = fcDeviation > 10 ? 'red' : fcDeviation > 5 ? 'yellow' : 'green';
        newAlerts.push({
          restaurant_id: rid, type: 'proforma_deviation', category: 'costo_ventas',
          severity: fcDevSev,
          title: 'Food Cost sobre Proforma',
          message: 'Food Cost real: ' + actualFcPct.toFixed(1) + '% vs ideal: ' + idealFcPct.toFixed(1) + '% (+' + fcDeviation.toFixed(1) + ' pts).',
          suggested_action: 'Revisar porciones, mermas y precios de insumos.',
          metadata: { proforma_item: 'FOOD_COST_PCT', actual: actualFcPct, ideal: idealFcPct, deviation: fcDeviation }
        });
      }
    }

    // 2. Cost center budgets vs actual
    if (proforma.cost_centers_budget && proforma.cost_centers_budget.length > 0 && proforma.monthly_income > 0) {
      // Build actual spend by cost center from DailyMetrics opex_by_center
      var actualByCenter = {};
      for (var mi = 0; mi < cMetrics.length; mi++) {
        var obc = cMetrics[mi].opex_by_center;
        if (obc && typeof obc === 'object') {
          Object.keys(obc).forEach(function(cc) { actualByCenter[cc] = (actualByCenter[cc] || 0) + (obc[cc] || 0); });
        }
      }
      // Also aggregate payroll from DailyMetrics
      var actualPayroll = payroll; // already calculated above

      for (var ci = 0; ci < proforma.cost_centers_budget.length; ci++) {
        var ccBudget = proforma.cost_centers_budget[ci];
        if (!ccBudget.name || !ccBudget.percent) continue;

        // Proportional budget for days elapsed
        var monthlyBudgetAmt = proforma.monthly_income * (ccBudget.percent / 100);
        var proportionalBudget = monthlyBudgetAmt * (day / 30);

        // Find actual spend: check both opex_by_center and payroll
        var ccName = ccBudget.name.toUpperCase();
        var actualSpend = 0;
        if (ccName.includes('PAYROLL') || ccName.includes('RRHH') || ccName.includes('PERSONAL')) {
          actualSpend = actualPayroll;
        } else {
          // Sum all matching cost center keys
          Object.keys(actualByCenter).forEach(function(k) {
            if (k.toUpperCase().includes(ccName) || ccName.includes(k.toUpperCase())) {
              actualSpend += actualByCenter[k];
            }
          });
          // Also try exact match
          if (actualSpend === 0 && actualByCenter[ccBudget.name]) {
            actualSpend = actualByCenter[ccBudget.name];
          }
        }

        if (proportionalBudget > 0 && actualSpend > proportionalBudget) {
          var ccDeviationPct = ((actualSpend - proportionalBudget) / proportionalBudget) * 100;
          if (ccDeviationPct > 5) {
            var ccSev = ccDeviationPct > 25 ? 'red' : ccDeviationPct > 10 ? 'yellow' : 'green';
            var proformaItem = ccName.includes('PAYROLL') || ccName.includes('RRHH') ? 'LABOR_COST_PCT' : ccBudget.name;
            // Check if we already have a proforma_deviation for this specific center
            var hasCcAlert = existing.some(function(a) {
              return a.type === 'proforma_deviation' && a.metadata && a.metadata.proforma_item === proformaItem;
            });
            if (!hasCcAlert) {
              newAlerts.push({
                restaurant_id: rid, type: 'proforma_deviation',
                category: ccName.includes('PAYROLL') || ccName.includes('RRHH') ? 'opex' : 'opex',
                severity: ccSev,
                title: ccBudget.name + ' sobre Proforma',
                message: ccBudget.name + ' real: $' + Math.round(actualSpend).toLocaleString() + ' vs presupuesto proporcional: $' + Math.round(proportionalBudget).toLocaleString() + ' (+' + ccDeviationPct.toFixed(0) + '%).',
                suggested_action: 'Revisar gastos de ' + ccBudget.name + ' y ajustar si es necesario.',
                metadata: { proforma_item: proformaItem, actual: actualSpend, budget: proportionalBudget, deviation_pct: ccDeviationPct }
              });
            }
          }
        }
      }
    }

    // 3. EBITDA vs target
    if (proforma.target_ebitda_percent > 0) {
      var targetEbitda = proforma.target_ebitda_percent;
      if (ebitdaPct < targetEbitda) {
        var ebitdaDev = targetEbitda - ebitdaPct;
        var ebitdaDevSev = ebitdaDev > 10 ? 'red' : ebitdaDev > 5 ? 'yellow' : 'green';
        var hasEbitdaProforma = existing.some(function(a) {
          return a.type === 'proforma_deviation' && a.metadata && a.metadata.proforma_item === 'EBITDA';
        });
        if (!hasEbitdaProforma) {
          newAlerts.push({
            restaurant_id: rid, type: 'proforma_deviation', category: 'ebitda',
            severity: ebitdaDevSev,
            title: 'EBITDA bajo Objetivo',
            message: 'EBITDA real: ' + ebitdaPct.toFixed(1) + '% vs objetivo: ' + targetEbitda.toFixed(1) + '% (-' + ebitdaDev.toFixed(1) + ' pts).',
            suggested_action: 'Analizar qué centros de costo están desviados.',
            metadata: { proforma_item: 'EBITDA', actual: ebitdaPct, target: targetEbitda, deviation: ebitdaDev }
          });
        }
      }
    }
  }

  // Stock alerts
  var activeItems = items.filter(function(s) { return s.is_active !== false; });
  for (var si = 0; si < activeItems.length; si++) {
    var item = activeItems[si];
    var cur = item.current_stock || 0;
    var min = item.min_stock || 0;
    var warn = item.warning_stock || 0;
    if (min > 0 && cur <= min && !hasStock('low_stock_supply', item.id, item.name))
      newAlerts.push({ restaurant_id: rid, type: 'low_stock_supply', severity: 'red', title: 'Insumo Crítico: ' + item.name, message: '"' + item.name + '": ' + cur + ' ' + (item.unit_of_measure || 'u') + '. Min: ' + min + '.', suggested_action: 'Contactar proveedor.', related_item_id: item.id, related_item_name: item.name, category: 'inventario' });
    else if (warn > 0 && cur <= warn && !hasStock('low_stock_supply', item.id, item.name))
      newAlerts.push({ restaurant_id: rid, type: 'low_stock_supply', severity: 'yellow', title: 'Insumo Bajo: ' + item.name, message: '"' + item.name + '": ' + cur + ' ' + (item.unit_of_measure || 'u') + '. Advertencia: ' + warn + '.', suggested_action: 'Incluir en próximo pedido.', related_item_id: item.id, related_item_name: item.name, category: 'inventario' });
  }

  // Create alerts with throttling
  for (var ai = 0; ai < newAlerts.length; ai++) {
    await withRetry(function() { return base44.asServiceRole.entities.Alert.create(newAlerts[ai]); }, 'Alert.create');
    if (ai % 3 === 2) await sleep(100);
  }

  console.log('[Alert] ' + restaurant.name + ': ' + newAlerts.length + ' created, ' + toDelete.length + ' cleaned');
  return { alertsCreated: newAlerts.length, alertsCleaned: toDelete.length, stockChecked: activeItems.length };
}

Deno.serve(async function(req) {
  var startTime = Date.now();

  try {
    var base44 = createClientFromRequest(req);

    // Parse optional body — manual analysis can pass { restaurant_id } to process only one
    var body = {};
    try { body = await req.json(); } catch (e) {}
    var targetRestaurantId = body.restaurant_id || null;

    var isAuthorized = false;
    try {
      var user = await base44.auth.me();
      if (user && user.role === 'admin') isAuthorized = true;
    } catch (e) {}
    if (!isAuthorized) {
      try { await base44.asServiceRole.entities.Restaurant.list('-created_date', 1); isAuthorized = true; }
      catch (e) { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
    }

    var allRestaurants = await withRetry(function() {
      return base44.asServiceRole.entities.Restaurant.filter({ is_active: true });
    }, 'Restaurant.list');

    // If a specific restaurant_id was passed (manual analysis), only process that one
    var restaurants = targetRestaurantId
      ? allRestaurants.filter(function(r) { return r.id === targetRestaurantId; })
      : allRestaurants;

    console.log('[Alert] Processing ' + restaurants.length + ' restaurant(s)' + (targetRestaurantId ? ' (manual: ' + targetRestaurantId + ')' : ' (scheduled)'));
    var results = [];
    var timedOut = false;

    for (var ri = 0; ri < restaurants.length; ri++) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.warn('[Alert] Safety timeout after ' + ri + '/' + restaurants.length + ' restaurants');
        timedOut = true;
        break;
      }

      try {
        var r = await processRestaurant(base44, restaurants[ri]);
        results.push({ restaurant: restaurants[ri].name, ...r });
      } catch (err) {
        console.error('[Alert] Error ' + restaurants[ri].name + ':', err.message);
        results.push({ restaurant: restaurants[ri].name, error: err.message, alertsCreated: 0, alertsCleaned: 0 });
      }

      // Delay between restaurants to reduce API pressure
      if (ri < restaurants.length - 1) {
        await sleep(300 + Math.floor(Math.random() * 200));
      }
    }

    return Response.json({
      success: true,
      restaurantsProcessed: results.length,
      totalRestaurants: allRestaurants.length,
      timedOut: timedOut,
      duration_ms: Date.now() - startTime,
      totalAlertsCreated: results.reduce(function(s, r) { return s + (r.alertsCreated || 0); }, 0),
      totalAlertsCleaned: results.reduce(function(s, r) { return s + (r.alertsCleaned || 0); }, 0),
      results: results
    });

  } catch (error) {
    console.error('[runScheduledAlertAnalysis] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});