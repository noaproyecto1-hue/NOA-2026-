import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { restaurantId, period, query, userTimezone } = body;
    const tz = userTimezone || 'America/Santiago';

    // 1. Get user's accessible restaurants (respecting restaurant_ids)
    let restaurants = [];
    
    // Step 1: If user has restaurant_ids assigned, use ONLY those
    if (user.restaurant_ids?.length > 0) {
      const allActive = await base44.asServiceRole.entities.Restaurant.filter({ is_active: true });
      restaurants = allActive.filter(r => user.restaurant_ids.includes(r.id));
    }
    
    // Step 2: Try restaurants created by this user
    if (restaurants.length === 0 && (user.role === 'admin' || user.app_role === 'manager')) {
      restaurants = await base44.asServiceRole.entities.Restaurant.filter({ is_active: true, created_by: user.email });
    }
    
    // Step 3: Fallback for admins — see all
    if (restaurants.length === 0 && user.role === 'admin') {
      restaurants = await base44.asServiceRole.entities.Restaurant.filter({ is_active: true });
    }
    
    if (restaurants.length === 0) {
      return Response.json({ summary: "No tienes restaurantes asignados.", data: {} });
    }

    const targetIds = restaurantId && restaurantId !== 'all'
      ? [restaurantId]
      : restaurants.map(r => r.id);

    const targetRestaurants = restaurants.filter(r => targetIds.includes(r.id));

    // 2. Calculate date ranges
    const nowUTC = new Date();
    const userNowStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(nowUTC);
    const [uyear, umonth, uday] = userNowStr.split('-').map(Number);
    const now = new Date(uyear, umonth - 1, uday);
    const { dateFrom, dateTo, prevFrom, prevTo } = getDateRange(period || 'current_month', now, body.dateFrom, body.dateTo);

    const queryType = query || 'overview';
    
    // 3. Fixed expenses
    let fixedExpenses = 0;
    targetRestaurants.forEach(r => {
      const expenses = r.config?.fixed_expenses || [];
      fixedExpenses += expenses.filter(e => e.is_active).reduce((s, e) => s + (e.amount || 0), 0);
    });

    // 4. Fetch data from Base44 entities
    const fetchForIds = async (entityName) => {
      const batches = await Promise.all(
        targetIds.map(id => base44.entities[entityName].filter({ restaurant_id: id }))
      );
      return batches.flat();
    };

    // Helper: get the local date string for a sale's date_time
    const getSaleDate = (sale) => {
      if (!sale.date_time) return null;
      try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(sale.date_time));
      } catch { return null; }
    };

    // Filter by date range
    const filterByRange = (items, from, to, dateField = 'date', useTzConvert = false) => {
      if (!from || !to) return [];
      return items.filter(item => {
        let d;
        if (useTzConvert) {
          d = getSaleDate(item);
        } else {
          d = item[dateField];
          if (!d) return false;
          if (d.includes('T')) d = d.split('T')[0];
        }
        return d && d >= from && d <= to;
      });
    };

    // Calculate net sales
    const calcNetSales = (sales) => sales.reduce((sum, s) => {
      if (s.subtotal && s.subtotal > 0 && s.subtotal !== s.total_amount) return sum + s.subtotal;
      const taxRate = s.tax_rate || 19;
      return sum + (s.total_amount ? Math.round(s.total_amount / (1 + taxRate / 100)) : 0);
    }, 0);

    // 5. Build response based on query type
    const result = {};

    // Restaurant info (always)
    result.restaurants = targetRestaurants.map(r => ({
      id: r.id, name: r.name, currency: r.currency,
      proforma: r.proforma,
      financial_health: r.financial_health,
      alert_thresholds: r.alert_thresholds,
      industry_benchmarks: r.industry_benchmarks,
      employees_count: (r.config?.employees || []).filter(e => e.is_active).length,
      cost_centers: (r.config?.cost_centers || []).map(c => c.name)
    }));
    result.period = { dateFrom, dateTo, prevFrom, prevTo };

    // === OVERVIEW / FULL P&L ===
    if (queryType === 'overview' || queryType === 'full_p_and_l') {
      const [allSales, allSupplyCosts, allOpex] = await Promise.all([
        fetchForIds('Sale'),
        fetchForIds('SupplyCost'),
        fetchForIds('OpEx')
      ]);

      const curSales = filterByRange(allSales, dateFrom, dateTo, 'date_time', true).filter(s => !s.is_cancelled);
      const curSupply = filterByRange(allSupplyCosts, dateFrom, dateTo).filter(s => s.payment_status === 'pagado');
      const curOpex = filterByRange(allOpex, dateFrom, dateTo).filter(o => o.payment_status === 'pagado');
      const prevSales = filterByRange(allSales, prevFrom, prevTo, 'date_time', true).filter(s => !s.is_cancelled);
      const prevSupply = filterByRange(allSupplyCosts, prevFrom, prevTo).filter(s => s.payment_status === 'pagado');
      const prevOpex = filterByRange(allOpex, prevFrom, prevTo).filter(o => o.payment_status === 'pagado');

      const buildMetrics = (sales, supply, opex) => {
        const net = calcNetSales(sales);
        const fc = supply.reduce((s, c) => s + (c.total_cost || 0), 0);
        const opexTotal = opex.reduce((s, o) => s + (o.amount || 0), 0) + fixedExpenses;
        const payroll = opex.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll')).reduce((s, o) => s + (o.amount || 0), 0);
        const gross = net - fc;
        const ebitda = net - fc - opexTotal;
        const txns = sales.length;
        return {
          net_sales: round(net), food_cost: round(fc),
          food_cost_pct: net > 0 ? round(fc / net * 100) : 0,
          gross_profit: round(gross), gross_margin_pct: net > 0 ? round(gross / net * 100) : 0,
          total_opex: round(opexTotal), opex_pct: net > 0 ? round(opexTotal / net * 100) : 0,
          payroll: round(payroll), payroll_pct: net > 0 ? round(payroll / net * 100) : 0,
          ebitda: round(ebitda), ebitda_pct: net > 0 ? round(ebitda / net * 100) : 0,
          transactions: txns, avg_ticket: txns > 0 ? round(net / txns) : 0,
        };
      };

      const cur = buildMetrics(curSales, curSupply, curOpex);
      const prev = buildMetrics(prevSales, prevSupply, prevOpex);
      result.current = cur;
      result.previous = prev;
      result.changes = {
        sales_change_pct: prev.net_sales > 0 ? round((cur.net_sales - prev.net_sales) / prev.net_sales * 100) : null,
        food_cost_change_pct: prev.food_cost > 0 ? round((cur.food_cost - prev.food_cost) / prev.food_cost * 100) : null,
        opex_change_pct: prev.total_opex > 0 ? round((cur.total_opex - prev.total_opex) / prev.total_opex * 100) : null,
        ebitda_change_pct: prev.ebitda !== 0 ? round((cur.ebitda - prev.ebitda) / Math.abs(prev.ebitda) * 100) : null,
      };

      // Food cost breakdown
      const curNetSales = calcNetSales(curSales);
      const byCat = {};
      curSupply.forEach(c => {
        const cat = c.supply_category || 'General';
        byCat[cat] = (byCat[cat] || 0) + (c.total_cost || 0);
      });
      const prevByCat = {};
      prevSupply.forEach(c => {
        const cat = c.supply_category || 'General';
        prevByCat[cat] = (prevByCat[cat] || 0) + (c.total_cost || 0);
      });

      result.food_cost = {
        total: round(curSupply.reduce((s, c) => s + (c.total_cost || 0), 0)),
        prev_total: round(prevSupply.reduce((s, c) => s + (c.total_cost || 0), 0)),
        pct_of_sales: curNetSales > 0 ? round(curSupply.reduce((s, c) => s + (c.total_cost || 0), 0) / curNetSales * 100) : 0,
        by_category: Object.entries(byCat).map(([name, total]) => ({
          name, total: round(total),
          pct: curNetSales > 0 ? round(total / curNetSales * 100) : 0,
          prev_total: round(prevByCat[name] || 0),
          top_items: []
        })).sort((a, b) => b.total - a.total),
        items_that_increased: [],
        items_that_decreased: [],
      };

      // Payroll
      const curPayroll = curOpex.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll'));
      const prevPayroll = prevOpex.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll'));
      const payrollTotal = curPayroll.reduce((s, o) => s + (o.amount || 0), 0);
      const prevPayrollTotal = prevPayroll.reduce((s, o) => s + (o.amount || 0), 0);
      const employeeCount = targetRestaurants.reduce((s, r) => s + (r.config?.employees || []).filter(e => e.is_active).length, 0);

      result.payroll = {
        total: round(payrollTotal),
        prev_total: round(prevPayrollTotal),
        change_pct: prevPayrollTotal > 0 ? round((payrollTotal - prevPayrollTotal) / prevPayrollTotal * 100) : null,
        pct_of_sales: curNetSales > 0 ? round(payrollTotal / curNetSales * 100) : 0,
        employee_count: employeeCount,
        sales_per_employee: employeeCount > 0 ? round(curNetSales / employeeCount) : 0,
        by_category: [],
        waiter_performance: [],
      };

      // OPEX breakdown
      const opexByCostCenter = {};
      curOpex.forEach(o => {
        const center = o.cost_center_name || o.type || 'Otros';
        if (!opexByCostCenter[center]) opexByCostCenter[center] = { total: 0, categories: [] };
        opexByCostCenter[center].total += (o.amount || 0);
      });

      result.opex = {
        total: round(curOpex.reduce((s, o) => s + (o.amount || 0), 0)),
        prev_total: round(prevOpex.reduce((s, o) => s + (o.amount || 0), 0)),
        fixed_expenses: round(fixedExpenses),
        pct_of_sales: curNetSales > 0 ? round(curOpex.reduce((s, o) => s + (o.amount || 0), 0) / curNetSales * 100) : 0,
        by_cost_center: Object.entries(opexByCostCenter).map(([name, d]) => ({
          name, total: round(d.total),
          pct: curNetSales > 0 ? round(d.total / curNetSales * 100) : 0,
          prev_total: 0, change_pct: null, categories: []
        })).sort((a, b) => b.total - a.total),
      };
    }

    // === FOOD COST DETAIL ===
    if (queryType === 'food_cost') {
      const [allSales, allSupplyCosts] = await Promise.all([fetchForIds('Sale'), fetchForIds('SupplyCost')]);
      const curSales = filterByRange(allSales, dateFrom, dateTo, 'date_time', true).filter(s => !s.is_cancelled);
      const curSupply = filterByRange(allSupplyCosts, dateFrom, dateTo).filter(s => s.payment_status === 'pagado');
      const prevSupply = filterByRange(allSupplyCosts, prevFrom, prevTo).filter(s => s.payment_status === 'pagado');
      const netSales = calcNetSales(curSales);

      const byCat = {};
      curSupply.forEach(c => {
        const cat = c.supply_category || 'General';
        if (!byCat[cat]) byCat[cat] = { total: 0, items: {} };
        byCat[cat].total += (c.total_cost || 0);
        const item = c.supply_item_name || 'Sin detalle';
        byCat[cat].items[item] = (byCat[cat].items[item] || 0) + (c.total_cost || 0);
      });
      const prevByCat = {};
      prevSupply.forEach(c => { prevByCat[c.supply_category || 'General'] = (prevByCat[c.supply_category || 'General'] || 0) + (c.total_cost || 0); });

      const totalFC = curSupply.reduce((s, c) => s + (c.total_cost || 0), 0);
      result.food_cost = {
        total: round(totalFC),
        prev_total: round(prevSupply.reduce((s, c) => s + (c.total_cost || 0), 0)),
        pct_of_sales: netSales > 0 ? round(totalFC / netSales * 100) : 0,
        by_category: Object.entries(byCat).map(([name, d]) => ({
          name, total: round(d.total),
          pct: netSales > 0 ? round(d.total / netSales * 100) : 0,
          prev_total: round(prevByCat[name] || 0),
          top_items: Object.entries(d.items).map(([n, a]) => ({ name: n, amount: round(a) })).sort((a, b) => b.amount - a.amount).slice(0, 5)
        })).sort((a, b) => b.total - a.total),
        items_that_increased: [],
        items_that_decreased: [],
      };
    }

    // === SUPPLY PRICES ===
    if (queryType === 'supply_prices') {
      const allSupplyCosts = await fetchForIds('SupplyCost');
      const curSupply = filterByRange(allSupplyCosts, dateFrom, dateTo).filter(s => s.payment_status === 'pagado');
      const prevSupply = filterByRange(allSupplyCosts, prevFrom, prevTo).filter(s => s.payment_status === 'pagado');

      const curByItem = {};
      curSupply.forEach(c => {
        const item = c.supply_item_name;
        if (!item) return;
        if (!curByItem[item]) curByItem[item] = { total: 0, qty: 0, cnt: 0 };
        curByItem[item].total += (c.total_cost || 0);
        curByItem[item].qty += (c.quantity_purchased || 0);
        curByItem[item].cnt++;
      });
      const prevByItem = {};
      prevSupply.forEach(c => {
        const item = c.supply_item_name;
        if (!item) return;
        if (!prevByItem[item]) prevByItem[item] = { total: 0, qty: 0 };
        prevByItem[item].total += (c.total_cost || 0);
        prevByItem[item].qty += (c.quantity_purchased || 0);
      });

      const priceAnalysis = Object.entries(curByItem).map(([name, d]) => {
        const avgCur = d.qty > 0 ? d.total / d.qty : null;
        const prev = prevByItem[name];
        const avgPrev = prev && prev.qty > 0 ? prev.total / prev.qty : null;
        const changePct = avgCur && avgPrev ? ((avgCur - avgPrev) / avgPrev * 100) : null;
        return {
          name, avg_unit_price_current: avgCur ? round(avgCur) : null,
          avg_unit_price_previous: avgPrev ? round(avgPrev) : null,
          price_change_pct: changePct ? round(changePct) : null,
          total_spent: round(d.total), purchases_count: d.cnt, suppliers: []
        };
      }).filter(i => i.total_spent > 0).sort((a, b) => b.total_spent - a.total_spent);

      result.supply_prices = {
        total_items: priceAnalysis.length,
        items_price_up: priceAnalysis.filter(i => i.price_change_pct > 5),
        items_price_down: priceAnalysis.filter(i => i.price_change_pct !== null && i.price_change_pct < -5),
        items_stable: priceAnalysis.filter(i => i.price_change_pct !== null && Math.abs(i.price_change_pct) <= 5),
        top_spend: priceAnalysis.slice(0, 15),
      };
    }

    // === PAYROLL ===
    if (queryType === 'payroll') {
      const [allSales, allOpex] = await Promise.all([fetchForIds('Sale'), fetchForIds('OpEx')]);
      const curSales = filterByRange(allSales, dateFrom, dateTo, 'date_time', true).filter(s => !s.is_cancelled);
      const curOpex = filterByRange(allOpex, dateFrom, dateTo).filter(o => o.payment_status === 'pagado');
      const prevOpex = filterByRange(allOpex, prevFrom, prevTo).filter(o => o.payment_status === 'pagado');
      const netSales = calcNetSales(curSales);

      const payrollFilter = (o) => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll');
      const curPayroll = curOpex.filter(payrollFilter);
      const prevPayroll = prevOpex.filter(payrollFilter);
      const payrollTotal = curPayroll.reduce((s, o) => s + (o.amount || 0), 0);
      const prevPayrollTotal = prevPayroll.reduce((s, o) => s + (o.amount || 0), 0);
      const employeeCount = targetRestaurants.reduce((s, r) => s + (r.config?.employees || []).filter(e => e.is_active).length, 0);

      // Waiter performance
      const waiterMap = {};
      curSales.forEach(s => {
        if (!s.waiter_name) return;
        if (!waiterMap[s.waiter_name]) waiterMap[s.waiter_name] = { sales: 0, txns: 0, guests: 0 };
        const net = (s.subtotal && s.subtotal > 0 && s.subtotal !== s.total_amount) ? s.subtotal : (s.total_amount / (1 + (s.tax_rate || 19) / 100));
        waiterMap[s.waiter_name].sales += net;
        waiterMap[s.waiter_name].txns++;
        waiterMap[s.waiter_name].guests += (s.num_guests || 0);
      });

      result.payroll = {
        total: round(payrollTotal),
        prev_total: round(prevPayrollTotal),
        change_pct: prevPayrollTotal > 0 ? round((payrollTotal - prevPayrollTotal) / prevPayrollTotal * 100) : null,
        pct_of_sales: netSales > 0 ? round(payrollTotal / netSales * 100) : 0,
        employee_count: employeeCount,
        sales_per_employee: employeeCount > 0 ? round(netSales / employeeCount) : 0,
        by_category: [],
        waiter_performance: Object.entries(waiterMap).map(([name, d]) => ({
          name, total_sales: round(d.sales), transactions: d.txns, guests: d.guests,
          avg_ticket: d.txns > 0 ? round(d.sales / d.txns) : 0
        })).sort((a, b) => b.total_sales - a.total_sales),
      };
    }

    // === OPEX DETAIL ===
    if (queryType === 'opex') {
      const [allSales, allOpex] = await Promise.all([fetchForIds('Sale'), fetchForIds('OpEx')]);
      const curSales = filterByRange(allSales, dateFrom, dateTo, 'date_time', true).filter(s => !s.is_cancelled);
      const curOpex = filterByRange(allOpex, dateFrom, dateTo).filter(o => o.payment_status === 'pagado');
      const prevOpex = filterByRange(allOpex, prevFrom, prevTo).filter(o => o.payment_status === 'pagado');
      const netSales = calcNetSales(curSales);

      const byCostCenter = {};
      curOpex.forEach(o => {
        const center = o.cost_center_name || o.type || 'Otros';
        if (!byCostCenter[center]) byCostCenter[center] = { total: 0, categories: {} };
        byCostCenter[center].total += (o.amount || 0);
        const cat = o.category || o.description || 'General';
        byCostCenter[center].categories[cat] = (byCostCenter[center].categories[cat] || 0) + (o.amount || 0);
      });
      const prevByCostCenter = {};
      prevOpex.forEach(o => {
        const center = o.cost_center_name || o.type || 'Otros';
        prevByCostCenter[center] = (prevByCostCenter[center] || 0) + (o.amount || 0);
      });

      const totalOpex = curOpex.reduce((s, o) => s + (o.amount || 0), 0);
      result.opex = {
        total: round(totalOpex),
        prev_total: round(prevOpex.reduce((s, o) => s + (o.amount || 0), 0)),
        fixed_expenses: round(fixedExpenses),
        pct_of_sales: netSales > 0 ? round(totalOpex / netSales * 100) : 0,
        by_cost_center: Object.entries(byCostCenter).map(([name, d]) => ({
          name, total: round(d.total),
          pct: netSales > 0 ? round(d.total / netSales * 100) : 0,
          prev_total: round(prevByCostCenter[name] || 0),
          change_pct: (prevByCostCenter[name] || 0) > 0 ? round((d.total - (prevByCostCenter[name] || 0)) / (prevByCostCenter[name] || 0) * 100) : null,
          categories: Object.entries(d.categories).map(([n, a]) => ({ name: n, amount: round(a) })).sort((a, b) => b.amount - a.amount)
        })).sort((a, b) => b.total - a.total),
      };
    }

    // === SALES DETAIL ===
    if (queryType === 'sales') {
      const allSales = await fetchForIds('Sale');
      const curSales = filterByRange(allSales, dateFrom, dateTo, 'date_time', true).filter(s => !s.is_cancelled);
      const prevSales = filterByRange(allSales, prevFrom, prevTo, 'date_time', true).filter(s => !s.is_cancelled);
      const netSales = calcNetSales(curSales);
      const prevNetSales = calcNetSales(prevSales);

      // By channel
      const byChannel = {};
      curSales.forEach(s => {
        const ch = s.sale_type === 'delivery' ? (s.delivery_source || 'Delivery') : 'Local';
        if (!byChannel[ch]) byChannel[ch] = { total: 0, cnt: 0 };
        const net = (s.subtotal && s.subtotal > 0 && s.subtotal !== s.total_amount) ? s.subtotal : (s.total_amount / (1 + (s.tax_rate || 19) / 100));
        byChannel[ch].total += net;
        byChannel[ch].cnt++;
      });

      // By day of week
      const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const byDay = {};
      curSales.forEach(s => {
        const d = new Date(s.date_time);
        const day = dayNames[d.getDay()];
        if (!byDay[day]) byDay[day] = 0;
        const net = (s.subtotal && s.subtotal > 0 && s.subtotal !== s.total_amount) ? s.subtotal : (s.total_amount / (1 + (s.tax_rate || 19) / 100));
        byDay[day] += net;
      });

      // By payment method
      const byPayment = {};
      curSales.forEach(s => {
        const pm = s.payment_method || 'otro';
        if (!byPayment[pm]) byPayment[pm] = { total: 0, cnt: 0 };
        const net = (s.subtotal && s.subtotal > 0 && s.subtotal !== s.total_amount) ? s.subtotal : (s.total_amount / (1 + (s.tax_rate || 19) / 100));
        byPayment[pm].total += net;
        byPayment[pm].cnt++;
      });

      result.sales = {
        net_sales: round(netSales),
        prev_net_sales: round(prevNetSales),
        change_pct: prevNetSales > 0 ? round((netSales - prevNetSales) / prevNetSales * 100) : null,
        transactions: curSales.length,
        prev_transactions: prevSales.length,
        avg_ticket: curSales.length > 0 ? round(netSales / curSales.length) : 0,
        total_guests: curSales.reduce((s, sale) => s + (sale.num_guests || 0), 0),
        total_tips: round(curSales.reduce((s, sale) => s + (sale.tip_amount || 0), 0)),
        total_discounts: round(curSales.reduce((s, sale) => s + (sale.discount_amount || 0), 0)),
        by_channel: Object.entries(byChannel).map(([name, d]) => ({ name, total: round(d.total), count: d.cnt })),
        by_day: Object.entries(byDay).map(([day, total]) => ({ day, total: round(total) })),
        by_payment: Object.entries(byPayment).map(([name, d]) => ({ name, total: round(d.total), count: d.cnt })),
        by_product_category: [],
      };
    }

    // === INVENTORY ===
    if (queryType === 'inventory') {
      const allSupplyItems = await fetchForIds('SupplyItem');
      const active = allSupplyItems.filter(i => i.is_active);
      const critical = active.filter(i => i.current_stock <= i.min_stock && i.min_stock > 0);
      const warning = active.filter(i => i.current_stock > i.min_stock && i.current_stock <= i.warning_stock && i.warning_stock > 0);
      const totalValue = active.reduce((s, i) => s + (i.current_stock * i.average_unit_cost), 0);

      result.inventory = {
        total_items: active.length,
        total_value: round(totalValue),
        critical_stock: critical.map(i => ({ name: i.name, category: i.category, stock: i.current_stock, min: i.min_stock, unit: i.unit_of_measure })),
        warning_stock: warning.map(i => ({ name: i.name, category: i.category, stock: i.current_stock, warning: i.warning_stock, unit: i.unit_of_measure })),
        critical_count: critical.length,
        warning_count: warning.length,
        recent_loss_value: 0,
        recent_counts_with_loss: [],
      };
    }

    // === ALERTS ===
    if (queryType === 'alerts' || queryType === 'overview') {
      let alertRows = [];
      if (targetIds.length === 1) {
        alertRows = await base44.entities.Alert.filter({ restaurant_id: targetIds[0], is_resolved: false });
      } else {
        const results = await Promise.all(targetIds.map(id => base44.entities.Alert.filter({ restaurant_id: id, is_resolved: false })));
        alertRows = results.flat();
      }

      const sevCount = (sev) => alertRows.filter(a => a.severity === sev).length;
      result.alerts = {
        total: alertRows.length,
        red: sevCount('red') + sevCount('critical'),
        yellow: sevCount('yellow') + sevCount('medium') + sevCount('high'),
        green: sevCount('green') + sevCount('low'),
        pinned: alertRows.filter(a => a.is_pinned).length,
        by_family: {
          food_cost: alertRows.filter(a => ['costo_ventas', 'inventario'].includes(a.category)).length,
          personal: alertRows.filter(a => a.type === 'payroll_spike' || a.type === 'labor_cost_high').length,
          opex: alertRows.filter(a => ['opex', 'flujo_caja', 'ventas', 'estado_resultados'].includes(a.category)).length,
        },
        top_alerts: alertRows.slice(0, 5).map(a => ({
          severity: a.severity, title: a.title, message: a.message,
          type: a.type, category: a.category, suggested_action: a.suggested_action
        })),
      };
    }

    return Response.json(result);

  } catch (error) {
    console.error('noaCopilotData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// === HELPERS ===
function round(n) { return Math.round((n || 0) * 100) / 100; }
function pad(n) { return String(n).padStart(2, '0'); }

function getDateRange(period, now, customFrom, customTo) {
  const y = now.getFullYear(), m = now.getMonth();
  let dateFrom, dateTo, prevFrom, prevTo;

  switch (period) {
    case 'current_month':
      dateFrom = `${y}-${pad(m+1)}-01`;
      dateTo = `${y}-${pad(m+1)}-${pad(new Date(y, m+1, 0).getDate())}`;
      prevFrom = `${m === 0 ? y-1 : y}-${pad(m === 0 ? 12 : m)}-01`;
      prevTo = `${m === 0 ? y-1 : y}-${pad(m === 0 ? 12 : m)}-${pad(new Date(m === 0 ? y-1 : y, m === 0 ? 12 : m, 0).getDate())}`;
      break;
    case 'previous_month':
      dateFrom = `${m === 0 ? y-1 : y}-${pad(m === 0 ? 12 : m)}-01`;
      dateTo = `${m === 0 ? y-1 : y}-${pad(m === 0 ? 12 : m)}-${pad(new Date(m === 0 ? y-1 : y, m === 0 ? 12 : m, 0).getDate())}`;
      const pm2 = m <= 1 ? (m === 0 ? 11 : 0) : m - 1;
      const py2 = m <= 1 ? y - 1 : y;
      prevFrom = `${py2}-${pad(pm2 === 0 ? 12 : pm2)}-01`;
      prevTo = `${py2}-${pad(pm2 === 0 ? 12 : pm2)}-${pad(new Date(py2, pm2 === 0 ? 12 : pm2, 0).getDate())}`;
      break;
    case 'year':
      dateFrom = `${y}-01-01`;
      dateTo = `${y}-12-31`;
      prevFrom = `${y-1}-01-01`;
      prevTo = `${y-1}-12-31`;
      break;
    case 'custom':
      dateFrom = customFrom;
      dateTo = customTo;
      if (customFrom && customTo) {
        const days = Math.ceil((new Date(customTo) - new Date(customFrom)) / 86400000);
        const pEnd = new Date(new Date(customFrom).getTime() - 86400000);
        const pStart = new Date(pEnd.getTime() - days * 86400000);
        prevFrom = pStart.toISOString().split('T')[0];
        prevTo = pEnd.toISOString().split('T')[0];
      }
      break;
    default:
      const months = period === 'last_6_months' ? 6 : 3;
      const start = new Date(y, m - months + 1, 1);
      dateFrom = `${start.getFullYear()}-${pad(start.getMonth()+1)}-01`;
      dateTo = `${y}-${pad(m+1)}-${pad(new Date(y, m+1, 0).getDate())}`;
      const prevStart = new Date(start.getFullYear(), start.getMonth() - months, 1);
      prevFrom = `${prevStart.getFullYear()}-${pad(prevStart.getMonth()+1)}-01`;
      prevTo = `${start.getFullYear()}-${pad(start.getMonth()+1)}-01`;
      break;
  }
  return { dateFrom, dateTo, prevFrom, prevTo };
}