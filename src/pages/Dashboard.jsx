import React, { useState, useMemo, useEffect, useCallback } from 'react';
// Dashboard data fetched directly from entities via useDashboardData hook
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, CalendarDays, Calendar, LayoutDashboard, TrendingUp, DollarSign, BarChart3, Settings, AlertTriangle, ShieldAlert, Clock, RefreshCw, ShoppingBag, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfWeek, endOfWeek, subWeeks, format, isWithinInterval, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCurrentDateInUserTz, formatDateInUserTz, getUserTimezone } from '@/components/utils/timezoneHelper';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';

import RestaurantSelector from '@/components/dashboard/RestaurantSelector';
import PeriodDropdown from '@/components/dashboard/PeriodDropdown';
import AlertTrafficLight from '@/components/dashboard/AlertTrafficLight';
import { getSelectedCurrency, formatCurrency } from '@/components/utils/currencyHelper';
import useDashboardData from '@/components/dashboard/useDashboardData';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import PageHeader from '@/components/ui/PageHeader';
import CostCenterBreakdown from '@/components/dashboard/CostCenterBreakdown';
import IncomeStatementTab from '@/components/dashboard/IncomeStatementTab';
import CostTrendChart from '@/components/dashboard/CostTrendChart';
import AlertsViewTab from '@/components/dashboard/AlertsViewTab';
import RestaurantPickerOnEntry from '@/components/dialogs/RestaurantPickerOnEntry';



export default function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [viewMode, setViewMode] = useState('monthly'); // weekly, monthly, annual
  const [visualMode, setVisualMode] = useState(() => {
    // Permite deep-link desde el menú: Dashboard?tab=incomeStatement|cashflow|costs|alerts
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (['overview', 'costs', 'incomeStatement', 'cashflow', 'alerts'].includes(t)) return t;
    } catch {}
    return 'overview';
  }); // overview, costs, incomeStatement, cashflow, alerts, vsTargets
  // El dateRange se inicializa con la fecha actual, pero se actualiza cuando el user carga
  const [dateRange, setDateRange] = useState(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  }));
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear());

  // PRIMERO: Obtener usuario
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  // Obtener fecha actual en zona horaria del usuario
  const userNow = useMemo(() => {
    return user ? getCurrentDateInUserTz(user) : new Date();
  }, [user]);

  // Actualizar dateRange cuando el usuario cargue (para usar su zona horaria)
  useEffect(() => {
    if (user) {
      const now = getCurrentDateInUserTz(user);
      setDateRange({
        from: startOfMonth(now),
        to: endOfMonth(now)
      });
    }
  }, [user?.timezone]);

  const weeklyRange = useMemo(() => ({
    from: startOfWeek(userNow, { weekStartsOn: 1 }),
    to: endOfWeek(userNow, { weekStartsOn: 1 })
  }), [userNow]);

  const annualRange = useMemo(() => {
    const yearDate = new Date(annualYear, 0, 1);
    return {
      from: startOfYear(yearDate),
      to: endOfYear(yearDate)
    };
  }, [annualYear]);

  const activeRange = viewMode === 'annual' ? annualRange : viewMode === 'weekly' ? weeklyRange : dateRange;

  // Comparación proporcional: mismos días del mes anterior
  // Si estamos en el día 12 del mes actual, comparamos con los días 1-12 del mes anterior
  const previousPeriod = useMemo(() => {
    if (viewMode === 'annual') {
      const prevYearDate = new Date(annualYear - 1, 0, 1);
      return {
        from: startOfYear(prevYearDate),
        to: endOfYear(prevYearDate)
      };
    }
    if (viewMode === 'weekly') {
      return {
        from: startOfWeek(subWeeks(userNow, 1), { weekStartsOn: 1 }),
        to: endOfWeek(subWeeks(userNow, 1), { weekStartsOn: 1 })
      };
    }
    // Monthly: proporcional — comparar hasta el mismo día del mes anterior
    const prevMonthStart = startOfMonth(subMonths(dateRange.from, 1));
    const today = userNow;
    const currentDay = today.getDate();
    const prevMonthEnd = endOfMonth(subMonths(dateRange.from, 1));
    const maxDayPrevMonth = prevMonthEnd.getDate();
    const proportionalDay = Math.min(currentDay, maxDayPrevMonth);
    const proportionalEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), proportionalDay);
    
    // Si el rango seleccionado es un mes pasado (no el actual), usar el mes completo
    const isCurrentMonth = dateRange.from.getMonth() === today.getMonth() && dateRange.from.getFullYear() === today.getFullYear();
    
    return {
      from: prevMonthStart,
      to: isCurrentMonth ? proportionalEnd : endOfMonth(subMonths(dateRange.from, 1))
    };
  }, [viewMode, userNow, dateRange.from]);

  // Format date as YYYY-MM-DD
  const toDateStr = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Track when dateRange has been initialized from user timezone
  const [dateRangeReady, setDateRangeReady] = useState(false);
  useEffect(() => {
    if (user) setDateRangeReady(true);
  }, [user]);

  // Quarter range
  const quarterEnd = useMemo(() => toDateStr(endOfMonth(subMonths(dateRange.from, 1))), [dateRange.from]);
  const quarterStart = useMemo(() => toDateStr(startOfMonth(subMonths(dateRange.from, 3))), [dateRange.from]);

  // Frontend-powered dashboard data — fetches entities directly, no backend function
  const { dashboardData, accessibleRestaurants: hookRestaurants, isLoading: isDashboardLoading, isFetching: isDashboardFetching } = useDashboardData({
    user,
    restaurantId: selectedRestaurant,
    dateFrom: toDateStr(activeRange.from),
    dateTo: toDateStr(activeRange.to),
    prevDateFrom: toDateStr(previousPeriod.from),
    prevDateTo: toDateStr(previousPeriod.to),
    quarterDateFrom: quarterStart,
    quarterDateTo: quarterEnd,
    userTimezone: getUserTimezone(user),
    enabled: !!user?.email && dateRangeReady,
  });

  // Extract data from hook response — data is already in full object form (no compression)
  const accessibleRestaurants = dashboardData?.restaurants || hookRestaurants?.map(r => ({
    id: r.id, name: r.name, currency: r.currency,
    targets: r.targets, proforma: r.proforma,
    config: r.config, alert_thresholds: r.alert_thresholds, financial_health: r.financial_health
  })) || [];
  const alerts = dashboardData?.alerts || [];
  const backendMetrics = dashboardData?.metrics || {};
  const backendPrevMetrics = dashboardData?.previousMetrics || {};
  const monthlyData = dashboardData?.monthlyTrend || [];

  // Data already comes as full entity objects from frontend queries
  const sales = dashboardData?.currentSales || [];
  const supplyCosts = dashboardData?.currentSupplyCosts || [];
  const opex = dashboardData?.currentOpex || [];

  const previousSalesSummary = dashboardData?.previousSalesSummary || { count: 0, totalBruto: 0, deliveryCount: 0, totalTips: 0, totalDiscounts: 0 };
  const previousSupplyCostsData = dashboardData?.previousSupplyCosts || [];
  const previousOpexData = dashboardData?.previousOpex || [];

  const supplyItemsData = dashboardData?.supplyItems || [];
  const allSupplyCostsData = dashboardData?.allSupplyCosts || [];
  const allOpexData = dashboardData?.allOpex || [];
  const allSalesData = dashboardData?.allSalesByMonth || {};


  // Refresh handler
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashSales'] }),
      queryClient.invalidateQueries({ queryKey: ['dashSupply'] }),
      queryClient.invalidateQueries({ queryKey: ['dashOpex'] }),
      queryClient.invalidateQueries({ queryKey: ['dashAlerts'] }),
      queryClient.invalidateQueries({ queryKey: ['dashRestaurants'] }),
      queryClient.invalidateQueries({ queryKey: ['dashSupplyItems'] }),
    ]);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Dashboard actualizado con todos los datos');
    }, 500);
  }, [queryClient]);

  // Alertas pineadas para mostrar en vista general
  const pinnedAlerts = useMemo(() => {
    return alerts.filter(a => a.is_pinned && !a.is_resolved).slice(0, 3);
  }, [alerts]);

  const resolveAlertMutation = useMutation({
    mutationFn: (alertId) => base44.entities.Alert.delete(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    }
  });

  const getRestaurantName = (restaurantId) => {
    const restaurant = accessibleRestaurants.find(r => r.id === restaurantId);
    return restaurant?.name || 'Desconocido';
  };

  // === ALL METRICS NOW COME FROM BACKEND ===
  const totalSales = backendMetrics.totalSales || 0;
  const prevTotalSales = backendPrevMetrics.totalSales || 0;
  const totalSupplyCost = backendMetrics.totalSupplyCost || 0;
  const prevTotalSupplyCost = backendPrevMetrics.totalSupplyCost || 0;
  const totalOpex = backendMetrics.totalOpex || 0;
  const prevTotalOpex = backendPrevMetrics.totalOpex || 0;
  const netProfit = backendMetrics.netProfit || 0;
  const netMargin = backendMetrics.netMargin || 0;
  const grossMargin = backendMetrics.grossMargin || 0;


  const daysElapsed = differenceInDays(userNow < activeRange.to ? userNow : activeRange.to, activeRange.from) + 1;
  const daysInPeriod = differenceInDays(activeRange.to, activeRange.from) + 1;
  const projectionFactor = daysInPeriod / daysElapsed;
  
  const projectedCashFlow = netProfit * projectionFactor;

  const selectedRestaurantData = useMemo(() => {
    if (selectedRestaurant === 'all') {
      return accessibleRestaurants[0];
    }
    return accessibleRestaurants.find(r => r.id === selectedRestaurant);
  }, [selectedRestaurant, accessibleRestaurants]);

  const targets = selectedRestaurantData?.targets || {};

  // monthlyData comes from backend (dashboardData.monthlyTrend)

  const selectedCurrency = getSelectedCurrency(selectedRestaurant, accessibleRestaurants);

  const selectedPeriodLabel = viewMode === 'annual' 
    ? `Año ${annualYear}`
    : viewMode === 'weekly'
    ? `Semana del ${format(weeklyRange.from, "d MMM", { locale: es })} al ${format(weeklyRange.to, "d MMM", { locale: es })}`
    : dateRange?.from ? format(dateRange.from, "MMMM yyyy", { locale: es }) : '';

  const handleAnnualYearChange = (year) => {
    setAnnualYear(year);
  };

  // Calculate payroll from opex data
  const payrollTotal = useMemo(() => {
    return opex.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll'))
      .reduce((s, o) => s + (o.amount || 0), 0);
  }, [opex]);

  const prevPayrollTotal = useMemo(() => {
    return previousOpexData.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll'))
      .reduce((s, o) => s + (o.amount || 0), 0);
  }, [previousOpexData]);

  // Calculate rent total from opex data
  const rentTotal = useMemo(() => {
    return opex.filter(o => {
      const ccn = (o.cost_center_name || '').toLowerCase();
      return ccn.includes('real state') || ccn.includes('renta') || ccn.includes('arriendo') || o.type === 'rent';
    }).reduce((s, o) => s + (o.amount || 0), 0);
  }, [opex]);

  // Breakdowns for auto alerts
  const supplyCostsByCategory = useMemo(() => {
    const map = {};
    supplyCosts.forEach(c => {
      const cat = c.supply_category || 'Sin categoría';
      map[cat] = (map[cat] || 0) + (c.total_cost || c.subtotal || 0);
    });
    return map;
  }, [supplyCosts]);

  const payrollByCategory = useMemo(() => {
    const map = {};
    opex.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll'))
      .forEach(o => {
        const cat = o.category || o.description || 'General';
        map[cat] = (map[cat] || 0) + (o.amount || 0);
      });
    return map;
  }, [opex]);

  // Detailed breakdown: category → items with descriptions
  const payrollByItem = useMemo(() => {
    const map = {};
    opex.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll'))
      .forEach(o => {
        const cat = o.category || o.description || 'General';
        if (!map[cat]) map[cat] = [];
        const desc = o.description || '';
        const existing = map[cat].find(i => i.description === desc);
        if (existing) {
          existing.amount += (o.amount || 0);
        } else {
          map[cat].push({ description: desc, amount: o.amount || 0 });
        }
      });
    return map;
  }, [opex]);

  const opexByCostCenter = useMemo(() => {
    const map = {};
    opex.forEach(o => {
      const cc = o.cost_center_name || o.type || 'Otros';
      map[cc] = (map[cc] || 0) + (o.amount || 0);
    });
    return map;
  }, [opex]);

  const opexByItem = useMemo(() => {
    const map = {};
    opex.forEach(o => {
      const cc = o.cost_center_name || o.type || 'Otros';
      if (!map[cc]) map[cc] = [];
      const cat = o.category || o.description || 'General';
      const existing = map[cc].find(i => i.category === cat);
      if (existing) {
        existing.amount += (o.amount || 0);
      } else {
        map[cc].push({ category: cat, amount: o.amount || 0 });
      }
    });
    return map;
  }, [opex]);

  const supplyCostsByItem = useMemo(() => {
    const map = {};
    supplyCosts.forEach(c => {
      const cat = c.supply_category || 'Sin categoría';
      if (!map[cat]) map[cat] = [];
      const item = c.supply_item_name || c.notes || 'General';
      const existing = map[cat].find(i => i.item === item);
      if (existing) {
        existing.amount += (c.total_cost || c.subtotal || 0);
      } else {
        map[cat].push({ item, amount: c.total_cost || c.subtotal || 0 });
      }
    });
    return map;
  }, [supplyCosts]);

  const currentMetrics = {
    totalSales,
    totalSupplyCost,
    totalOpex,
    netProfit,
    netMargin,
    grossMargin,
    projectedCashFlow,
    costPercentage: totalSales > 0 ? (totalSupplyCost / totalSales) * 100 : 0,
    payrollTotal,
    rentTotal,
    supplyCostsByCategory,
    payrollByCategory,
    payrollByItem,
    opexByCostCenter,
    opexByItem,
    supplyCostsByItem,
    currentSupplyCosts: supplyCosts,
    previousSupplyCosts: previousSupplyCostsData,
    allSupplyCosts: allSupplyCostsData,
  };

  const previousMetrics = {
    prevTotalSales,
    prevTotalSupplyCost,
    prevTotalOpex,
    prevPayrollTotal
  };

  const alertRestaurantId = selectedRestaurant !== "all" 
    ? selectedRestaurant 
    : accessibleRestaurants[0]?.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      {/* Hero Header */}
      <PageHeader
        title="Copiloto Gastronómico"
        subtitle={`Análisis • ${selectedPeriodLabel}`}
        icon={LayoutDashboard}
        imageKey="dashboard"
        gradient="from-indigo-900/90 via-purple-900/80 to-slate-900/70"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewMode} onValueChange={setViewMode} className="bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/20">
            <TabsList className="bg-transparent">
              <TabsTrigger 
                value="monthly" 
                className="data-[state=active]:bg-white data-[state=active]:text-gray-900 text-white/80 px-3 rounded-lg text-xs sm:text-sm"
              >
                <Calendar className="w-4 h-4 mr-1.5 hidden sm:block" />
                Mensual
              </TabsTrigger>
              <TabsTrigger 
                value="annual" 
                className="data-[state=active]:bg-white data-[state=active]:text-gray-900 text-white/80 px-3 rounded-lg text-xs sm:text-sm"
              >
                <CalendarDays className="w-4 h-4 mr-1.5 hidden sm:block" />
                Anual
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <PeriodDropdown 
            viewMode={viewMode}
            dateRange={dateRange}
            onDateChange={setDateRange}
            annualYear={annualYear}
            onAnnualYearChange={handleAnnualYearChange}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RestaurantSelector 
            restaurants={accessibleRestaurants}
            selectedId={selectedRestaurant}
            onChange={setSelectedRestaurant}
            className="bg-white/95 backdrop-blur-sm border-white/50 shadow-xl"
          />
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isDashboardFetching}
            className="bg-white/95 backdrop-blur-sm text-gray-800 hover:bg-white shadow-lg border-0 rounded-xl gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${(isRefreshing || isDashboardFetching) ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
        {/* Loading / Error state */}
        {isDashboardLoading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-gray-500 text-sm">Cargando datos del dashboard...</span>
          </div>
        )}
        {!isDashboardLoading && !dashboardData && dateRangeReady && !!user?.email && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">No se pudieron cargar los datos</p>
              <p className="text-xs text-amber-600">Haz click en "Actualizar" para reintentar.</p>
            </div>
          </div>
        )}

        {/* Visual Mode Selector - Simétrico */}
        <div className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[
              { id: 'overview', label: 'Dashboard Principal', icon: LayoutDashboard, color: 'indigo' },
              { id: 'costs', label: 'Gastos Generales', icon: ShoppingBag, color: 'orange' },
              { id: 'incomeStatement', label: 'Estado de Resultados', icon: BarChart3, color: 'violet' },
              { id: 'cashflow', label: 'Flujo de Caja', icon: Wallet, color: 'emerald', badge: 'Próximamente' },
              { id: 'alerts', label: 'Alertas', icon: ShieldAlert, color: 'red', count: alerts.filter(a => !a.is_read).length, highlight: true },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = visualMode === tab.id;
              const colorMap = {
                indigo: { active: 'bg-indigo-600 text-white', inactive: 'bg-indigo-50 text-indigo-600' },
                orange: { active: 'bg-orange-600 text-white', inactive: 'bg-orange-50 text-orange-600' },
                violet: { active: 'bg-violet-600 text-white', inactive: 'bg-violet-50 text-violet-600' },
                emerald: { active: 'bg-emerald-600 text-white', inactive: 'bg-emerald-50 text-emerald-600' },
                red: { active: 'bg-red-600 text-white', inactive: 'bg-red-50 text-red-600' },
              };
              const colors = colorMap[tab.color];

              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setVisualMode(tab.id)}
                  className={`
                    flex items-center justify-center gap-2 px-3 py-3 rounded-xl transition-all duration-200 
                    ${isActive 
                      ? `${colors.active} shadow-lg` 
                      : tab.highlight && !isActive
                        ? `bg-white hover:bg-red-50 text-gray-600 shadow-md border-2 border-red-200 ring-1 ring-red-100`
                        : `bg-white hover:bg-gray-50 text-gray-600 shadow-sm border border-gray-100`
                    }
                  `}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white/20' : colors.inactive}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-sm truncate">{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                      {tab.badge}
                    </span>
                  )}
                  {tab.count > 0 && (
                    <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white text-red-600' : 'bg-red-500 text-white'}`}>
                      {tab.count > 9 ? '9+' : tab.count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
        {/* VISTA: OVERVIEW */}
        <AnimatePresence mode="wait">
          {visualMode === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <DashboardOverview
                sales={sales}
                supplyCosts={supplyCosts}
                opex={opex}
                opexByType={dashboardData?.costBreakdown?.opexByType || {}}
                restaurantId={selectedRestaurant !== 'all' ? selectedRestaurant : (dashboardData?.restaurants?.[0]?.id)}
              />
            </motion.div>
          )}

          {/* VISTA: COSTOS DE VENTA */}
          {visualMode === 'costs' && (
            <motion.div
              key="costs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Componente de desglose */}
              <CostCenterBreakdown 
                supplyCosts={supplyCosts}
                opex={opex}
                allSupplyCosts={allSupplyCostsData}
                allOpex={allOpexData}
                allSales={allSalesData}
                restaurantConfig={selectedRestaurantData}
                currency={selectedCurrency}
                viewMode={viewMode}
                totalSales={totalSales}
              />
            </motion.div>
          )}

          {/* VISTA: ESTADO DE RESULTADOS */}
          {visualMode === 'incomeStatement' && (
            <motion.div
              key="incomeStatement"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <IncomeStatementTab
                sales={sales}
                supplyCosts={supplyCosts}
                opex={opex}
                previousSales={[]}
                previousSupplyCosts={previousSupplyCostsData}
                previousOpex={previousOpexData}
                quarterAnalysis={dashboardData?.quarterAnalysis}
                restaurant={selectedRestaurantData}
                currency={selectedCurrency}
                dateRange={activeRange}
                onDateChange={setDateRange}
                dataPrefiltered={true}
                dashboardViewMode={viewMode}
                supplyItems={supplyItemsData}

              />
            </motion.div>
          )}

          {/* VISTA: FLUJO DE CAJA (Próximamente) */}
          {visualMode === 'cashflow' && (
            <motion.div
              key="cashflow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Coming Soon Card */}
              <Card className="bg-white border-0 shadow-xl">
                <CardContent className="py-16 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <Clock className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Próximamente</h3>
                  <p className="text-gray-500 max-w-sm mx-auto text-sm">
                    Pronto podrás ver proyecciones de flujo de caja, análisis de liquidez y recomendaciones financieras.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* VISTA: ALERTAS */}
          {visualMode === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AlertsViewTab
                alerts={alerts}
                restaurantId={alertRestaurantId}
                restaurantConfig={{
                  alert_thresholds: selectedRestaurantData?.alert_thresholds,
                  financial_health: selectedRestaurantData?.financial_health
                }}
                currentMetrics={currentMetrics}
                previousMetrics={previousMetrics}
                currency={selectedCurrency}
                selectedRestaurant={selectedRestaurant}
                getRestaurantName={getRestaurantName}
                restaurants={accessibleRestaurants}
              />
            </motion.div>
          )}


        </AnimatePresence>

        {/* Restaurant Picker al entrar */}
        <RestaurantPickerOnEntry
          restaurants={accessibleRestaurants}
          selectedRestaurant={selectedRestaurant}
          onSelect={setSelectedRestaurant}
          pageName="el Dashboard"
          isLoading={isDashboardLoading}
        />

        {/* Alert generation handled by backend: runScheduledAlertAnalysis (every 3h) + manual button in AlertsViewTab */}
      </div>
    </div>
  );
}