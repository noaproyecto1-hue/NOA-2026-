import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAllRecords } from '@/components/utils/fetchAllRecords';

/**
 * Hook that fetches all dashboard data directly from entities.
 * Replaces the backend getDashboardMetrics function to avoid timeout issues.
 */
export default function useDashboardData({ user, restaurantId, dateFrom, dateTo, prevDateFrom, prevDateTo, quarterDateFrom, quarterDateTo, userTimezone, enabled }) {
  const tz = userTimezone || 'America/Santiago';

  // 1. Fetch restaurants
  const { data: allRestaurants = [] } = useQuery({
    queryKey: ['dashRestaurants'],
    queryFn: () => base44.entities.Restaurant.filter({ is_active: true }),
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  // Determine accessible restaurants
  const { accessibleIds, targetIds, targetRestaurants } = useMemo(() => {
    let restaurants = [];
    if (user?.restaurant_ids?.length > 0) {
      restaurants = allRestaurants.filter(r => user.restaurant_ids.includes(r.id));
    }
    if (restaurants.length === 0 && (user?.role === 'admin' || user?.app_role === 'manager')) {
      restaurants = allRestaurants.filter(r => r.created_by === user.email);
    }
    if (restaurants.length === 0 && user?.role === 'admin') {
      restaurants = allRestaurants;
    }
    const aIds = restaurants.map(r => r.id);
    const tIds = restaurantId && restaurantId !== 'all' ? [restaurantId] : aIds;
    const tRestaurants = restaurants.filter(r => tIds.includes(r.id));
    return { accessibleIds: aIds, targetIds: tIds, targetRestaurants: tRestaurants, accessibleRestaurants: restaurants };
  }, [allRestaurants, user, restaurantId]);

  const accessibleRestaurants = useMemo(() => {
    if (user?.restaurant_ids?.length > 0) {
      return allRestaurants.filter(r => user.restaurant_ids.includes(r.id));
    }
    if (user?.role === 'admin' || user?.app_role === 'manager') {
      const owned = allRestaurants.filter(r => r.created_by === user?.email);
      if (owned.length > 0) return owned;
    }
    if (user?.role === 'admin') return allRestaurants;
    return [];
  }, [allRestaurants, user]);

  // 2. Fetch entity data per restaurant — parallel per targetId, with auto-pagination
  const fetchAllForEntity = async (entityName, extraFilter = {}, sort = '-created_date') => {
    if (targetIds.length === 0) return [];
    const promises = targetIds.map(id =>
      fetchAllRecords(entityName, { restaurant_id: id, ...extraFilter }, sort).catch(() => [])
    );
    return (await Promise.all(promises)).flat();
  };

  // Sales
  const { data: allSales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['dashSales', ...targetIds],
    queryFn: () => fetchAllForEntity('Sale'),
    enabled: enabled && targetIds.length > 0,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // SupplyCost
  const { data: allSupplyCosts = [], isLoading: supplyLoading } = useQuery({
    queryKey: ['dashSupply', ...targetIds],
    queryFn: () => fetchAllForEntity('SupplyCost'),
    enabled: enabled && targetIds.length > 0,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // OpEx
  const { data: allOpex = [], isLoading: opexLoading } = useQuery({
    queryKey: ['dashOpex', ...targetIds],
    queryFn: () => fetchAllForEntity('OpEx'),
    enabled: enabled && targetIds.length > 0,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Alerts
  const { data: alertRows = [] } = useQuery({
    queryKey: ['dashAlerts', ...targetIds],
    queryFn: () => fetchAllForEntity('Alert', { is_resolved: false }),
    enabled: enabled && targetIds.length > 0,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // SupplyItems
  const { data: allSupplyItems = [] } = useQuery({
    queryKey: ['dashSupplyItems', ...targetIds],
    queryFn: () => fetchAllForEntity('SupplyItem', { is_active: true }),
    enabled: enabled && targetIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isLoading = salesLoading || supplyLoading || opexLoading;

  // 3. Compute everything in useMemo
  const dashboardData = useMemo(() => {
    if (!enabled || targetIds.length === 0) return null;

    // Sale date helper
    const getSaleDate = (sale) => {
      if (!sale.date_time) return null;
      try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(sale.date_time));
      } catch { return null; }
    };

    // Pre-cache sale dates
    const saleDateMap = new Map();
    for (const s of allSales) {
      if (s.date_time) saleDateMap.set(s.id, getSaleDate(s));
    }

    const filterByRange = (items, from, to, dateField = 'date', isSale = false) => {
      if (!from || !to) return [];
      return items.filter(item => {
        let d;
        if (isSale) {
          d = saleDateMap.get(item.id);
        } else {
          d = item[dateField];
          if (!d) return false;
          if (d.includes('T')) d = d.substring(0, 10);
        }
        return d && d >= from && d <= to;
      });
    };

    const calcNetSales = (sales) => {
      let sum = 0;
      for (const s of sales) {
        const amount = s.total_amount || s.subtotal || 0;
        if (!amount) continue;
        if (s.applies_tax === false) { sum += amount; continue; }
        const taxRate = s.tax_rate || 19;
        sum += Math.round(amount / (1 + taxRate / 100));
      }
      return sum;
    };

    const sumField = (arr, field) => {
      let s = 0;
      for (const item of arr) s += (item[field] || 0);
      return s;
    };

    const groupSum = (arr, keyFn, valFn) => {
      const map = {};
      for (const item of arr) {
        const k = keyFn(item);
        map[k] = (map[k] || 0) + valFn(item);
      }
      return map;
    };

    // Fixed expenses
    let fixedExpenses = 0;
    targetRestaurants.forEach(r => {
      const expenses = r.config?.fixed_expenses || [];
      fixedExpenses += expenses.filter(e => e.is_active).reduce((s, e) => s + (e.amount || 0), 0);
    });

    // Filter by periods
    const curSales = filterByRange(allSales, dateFrom, dateTo, 'date_time', true).filter(s => !s.is_cancelled);
    const curSupply = filterByRange(allSupplyCosts, dateFrom, dateTo).filter(s => s.payment_status === 'pagado');
    const curOpex = filterByRange(allOpex, dateFrom, dateTo).filter(o => o.payment_status === 'pagado');
    const prevSales = filterByRange(allSales, prevDateFrom, prevDateTo, 'date_time', true).filter(s => !s.is_cancelled);
    const prevSupply = filterByRange(allSupplyCosts, prevDateFrom, prevDateTo).filter(s => s.payment_status === 'pagado');
    const prevOpex = filterByRange(allOpex, prevDateFrom, prevDateTo).filter(o => o.payment_status === 'pagado');

    // Quarter
    const quarterSalesRaw = quarterDateFrom ? filterByRange(allSales, quarterDateFrom, quarterDateTo, 'date_time', true).filter(s => !s.is_cancelled) : [];
    const quarterSupplyRaw = quarterDateFrom ? filterByRange(allSupplyCosts, quarterDateFrom, quarterDateTo).filter(s => s.payment_status === 'pagado') : [];
    const quarterOpexRaw = quarterDateFrom ? filterByRange(allOpex, quarterDateFrom, quarterDateTo).filter(o => o.payment_status === 'pagado') : [];

    const opexToCenter = {
      'payroll': 'PAYROLL/RRHH', 'rent': 'REAL STATE/RENTA', 'utilities': 'GASTOS FIJOS',
      'maintenance': 'ADMINISTRACIÓN', 'marketing': 'MARKETING',
      'insurance': 'GASTOS FIJOS', 'licenses': 'ADMINISTRACIÓN',
      'technology': 'ADMINISTRACIÓN', 'other': 'ADMINISTRACIÓN'
    };

    const quarterAnalysis = {
      totalIncome: calcNetSales(quarterSalesRaw),
      totalSupply: quarterSupplyRaw.reduce((s, c) => s + (c.total_cost || 0), 0),
      totalOpex: quarterOpexRaw.reduce((s, o) => s + (o.amount || 0), 0),
      supplyCostsByCategory: groupSum(quarterSupplyRaw, c => c.supply_category || 'General', c => c.total_cost || 0),
      opexByCenter: groupSum(quarterOpexRaw, o => o.cost_center_name || opexToCenter[o.type] || 'ADMINISTRACIÓN', o => o.amount || 0)
    };

    // Build metrics
    const buildM = (sales, supply, opex) => {
      const net = calcNetSales(sales);
      const bruto = sumField(sales, 'total_amount');
      const supplyTotal = sumField(supply, 'total_cost');
      const opexTotal = sumField(opex, 'amount') + fixedExpenses;
      const grossProfit = net - supplyTotal;
      const netProfit = grossProfit - opexTotal;
      return {
        totalSales: net, totalSalesBruto: bruto, totalSupplyCost: supplyTotal, totalOpex: opexTotal,
        fixedExpenses, grossProfit, netProfit,
        grossMargin: net > 0 ? (grossProfit / net) * 100 : 0,
        netMargin: net > 0 ? (netProfit / net) * 100 : 0,
        costPercentage: net > 0 ? (supplyTotal / net) * 100 : 0,
        opexPercentage: net > 0 ? (opexTotal / net) * 100 : 0,
        totalTransactions: sales.length,
        totalGuests: sumField(sales, 'num_guests'),
        avgTicket: sales.length > 0 ? net / sales.length : 0,
        avgGuests: sales.length > 0 ? sumField(sales, 'num_guests') / sales.length : 0,
        totalTips: sumField(sales, 'tip_amount'),
        totalDiscounts: sumField(sales, 'discount_amount'),
      };
    };

    const metrics = buildM(curSales, curSupply, curOpex);
    const previousMetrics = buildM(prevSales, prevSupply, prevOpex);

    // Alerts
    const pinnedAlerts = alertRows.filter(a => a.is_pinned).slice(0, 3);
    const alertCounts = {
      total: alertRows.length,
      unread: alertRows.filter(a => !a.is_read).length,
      red: alertRows.filter(a => a.severity === 'red' || a.severity === 'critical').length,
      yellow: alertRows.filter(a => a.severity === 'yellow' || a.severity === 'high' || a.severity === 'medium').length,
      green: alertRows.filter(a => a.severity === 'green' || a.severity === 'low').length,
    };

    // Cost breakdowns
    const supplyByCategory = groupSum(curSupply, c => c.supply_category || 'General', c => c.total_cost || 0);
    const opexByType = groupSum(curOpex, o => o.type || 'other', o => o.amount || 0);

    // Monthly trend (last 3 months)
    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fullMonthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const monthlyTrend = [];
    const now = new Date();
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = `${monthKey}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const monthEnd = `${monthKey}-${String(lastDay).padStart(2, '0')}`;

      const mSales = filterByRange(allSales, monthStart, monthEnd, 'date_time', true).filter(s => !s.is_cancelled);
      const mSupply = filterByRange(allSupplyCosts, monthStart, monthEnd).filter(s => s.payment_status === 'pagado');
      const mOpex = filterByRange(allOpex, monthStart, monthEnd).filter(o => o.payment_status === 'pagado');
      const ventas = calcNetSales(mSales);
      const costos = mSupply.reduce((s, c) => s + (c.total_cost || 0), 0);
      const opexAmt = mOpex.reduce((s, o) => s + (o.amount || 0), 0);
      const payroll = mOpex.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll')).reduce((s, o) => s + (o.amount || 0), 0);

      monthlyTrend.push({
        name: monthNames[d.getMonth()],
        fullName: `${fullMonthNames[d.getMonth()]} ${d.getFullYear()}`,
        ventas, costos, opex: opexAmt, payroll,
        utilidad: ventas - costos - opexAmt,
        foodCostPercent: ventas > 0 ? (costos / ventas) * 100 : 0,
        payrollPercent: ventas > 0 ? (payroll / ventas) * 100 : 0,
        percent: ventas > 0 ? (costos / ventas) * 100 : 0
      });
    }

    // allSalesByMonth (3 months)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
    const allSalesByMonth = {};
    for (const s of allSales) {
      if (s.is_cancelled) continue;
      const sd = saleDateMap.get(s.id);
      if (!sd || sd < threeMonthsAgo) continue;
      const mk = sd.substring(0, 7);
      allSalesByMonth[mk] = (allSalesByMonth[mk] || 0) + (s.total_amount || 0);
    }

    // Sales summary builders
    const buildSalesSummary = (salesArr) => {
      const byPM = {};
      const byDS = {};
      let deliveryCount = 0, totalBruto = 0, totalTips = 0, totalDiscounts = 0, totalGuests = 0;
      for (const s of salesArr) {
        totalBruto += (s.total_amount || 0);
        totalTips += (s.tip_amount || 0);
        totalDiscounts += (s.discount_amount || 0);
        totalGuests += (s.num_guests || 0);
        const pm = s.payment_method || 'Otro';
        byPM[pm] = (byPM[pm] || 0) + 1;
        if (s.sale_type === 'delivery') {
          deliveryCount++;
          const ds = s.delivery_source || 'Directo';
          byDS[ds] = (byDS[ds] || 0) + 1;
        }
      }
      return {
        count: salesArr.length, deliveryCount, localCount: salesArr.length - deliveryCount,
        totalBruto, totalTips, totalDiscounts, totalGuests,
        byPaymentMethod: byPM, byDeliverySource: byDS
      };
    };

    return {
      metrics, previousMetrics,
      alerts: alertRows.slice(0, 30),
      pinnedAlerts,
      alertCounts,
      monthlyTrend,
      costBreakdown: { supplyByCategory, opexByType },
      // Return the actual sale objects (already in memory)
      currentSales: curSales,
      currentSalesSummary: buildSalesSummary(curSales),
      previousSalesSummary: buildSalesSummary(prevSales),
      currentSupplyCosts: curSupply,
      previousSupplyCosts: prevSupply,
      currentOpex: curOpex,
      previousOpex: prevOpex,
      quarterAnalysis,
      allSalesByMonth,
      allSupplyCosts: [],
      allOpex: [],
      restaurants: targetRestaurants.map(r => ({
        id: r.id, name: r.name, currency: r.currency,
        proforma: r.proforma,
        config: {
          fixed_expenses: r.config?.fixed_expenses,
          cost_centers: r.config?.cost_centers,
          supply_categories: r.config?.supply_categories,
          recipe_categories: r.config?.recipe_categories,
          payment_methods: r.config?.payment_methods,
          default_tax_rate: r.config?.default_tax_rate,
          ideal_stock_percent: r.config?.ideal_stock_percent,
        },
        alert_thresholds: r.alert_thresholds, financial_health: r.financial_health
      })),
      supplyItems: allSupplyItems.map(s => ({ name: s.name, category: s.category, restaurant_id: s.restaurant_id })),
      dataStats: {
        totalSalesRecords: allSales.filter(s => !s.is_cancelled).length,
        totalSupplyCostRecords: allSupplyCosts.length,
        totalOpexRecords: allOpex.length,
        currentPeriodSales: curSales.length,
        currentPeriodCosts: curSupply.length + curOpex.length
      }
    };
  }, [allSales, allSupplyCosts, allOpex, alertRows, allSupplyItems, targetIds, targetRestaurants, dateFrom, dateTo, prevDateFrom, prevDateTo, quarterDateFrom, quarterDateTo, tz, enabled]);

  return {
    dashboardData,
    accessibleRestaurants,
    isLoading,
    isFetching: isLoading,
  };
}