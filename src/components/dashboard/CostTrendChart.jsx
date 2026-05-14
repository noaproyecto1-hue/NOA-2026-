import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, ComposedChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Minus, ShoppingBag, Users, Settings, BarChart3, Activity, Sun, Moon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/components/utils/currencyHelper';
import { motion } from 'framer-motion';

// === SPARKLINE ===
const Sparkline = ({ data, dataKey, color, width = 60, height = 24 }) => {
  if (!data || data.length < 2) return null;
  const values = data.map(d => d[dataKey] || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {values.length > 0 && (() => {
        const lastX = width;
        const lastY = height - ((values[values.length - 1] - min) / range) * (height - 4) - 2;
        return <circle cx={lastX} cy={lastY} r="2.5" fill={color} opacity="0.9" />;
      })()}
    </svg>
  );
};

// === TOOLTIP ===
const CustomTooltip = ({ active, payload, currency }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  const items = [
    { label: 'Costo de Venta', value: data?.foodCost, percent: data?.foodCostPercent, color: '#f59e0b' },
    { label: 'Costo Personal', value: data?.payroll, percent: data?.payrollPercent, color: '#a78bfa' },
    { label: 'OPEX', value: data?.opexAmount, percent: data?.opexPercent, color: '#22d3ee' },
  ];
  return (
    <div className="bg-slate-950/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/[0.08] min-w-[260px]">
      <p className="font-bold text-white text-sm mb-3 capitalize border-b border-white/[0.06] pb-2 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-white/40" />
        {data?.fullName}
      </p>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}40` }} />
              <span className="text-white/50 text-xs font-medium">{item.label}</span>
            </div>
            <div className="text-right flex items-baseline gap-2">
              <span className="font-bold text-white text-sm">{formatCurrency(item.value, currency, { compact: true })}</span>
              <span className="text-[10px] font-semibold" style={{ color: item.color }}>{item.percent?.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06] pt-2.5 mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-white/30 font-medium">Ventas Netas</span>
          <span className="font-bold text-white/60">{formatCurrency(data?.totalSales, currency, { compact: true })}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-white/30 font-medium">Costo Total</span>
          <span className="font-bold text-emerald-400/80">
            {data?.totalSales > 0 ? `${(((data?.foodCost + data?.payroll + data?.opexAmount) / data?.totalSales) * 100).toFixed(1)}%` : '0%'}
          </span>
        </div>
      </div>
    </div>
  );
};

// === ROUNDED BAR ===
const RoundedBar = (props) => {
  const { x, y, width, height, fill } = props;
  if (height <= 0) return null;
  const radius = Math.min(6, width / 2, height / 2);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={radius} ry={radius} fill={fill} opacity={0.85} />
      <rect x={x} y={y} width={width} height={Math.min(height, 3)} rx={radius} ry={radius} fill="white" opacity={0.15} />
    </g>
  );
};

export default function CostTrendChart({ sales = [], supplyCosts = [], opex = [], currency = 'USD', precomputedData = null }) {
  const [activeMetric, setActiveMetric] = useState('all');
  const [viewMode, setViewMode] = useState('percent');
  const [chartType, setChartType] = useState('area');
  const [theme, setTheme] = useState('dark');
  const isDark = theme === 'dark';

  // Theme tokens
  const t = isDark ? {
    bg: 'bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900',
    border: 'border-white/[0.06]',
    headerIcon: 'bg-white/[0.06] border-white/[0.08]',
    headerIconColor: 'text-white/70',
    title: 'text-white',
    subtitle: 'text-white/50',
    toggleBg: 'bg-white/[0.04] border-white/[0.06]',
    toggleActive: 'bg-white/[0.15] text-white shadow-lg border border-white/[0.15]',
    toggleInactive: 'text-white/40 hover:text-white/60',
    valToggleActive: 'bg-white text-slate-900 shadow-lg shadow-white/10',
    valToggleInactive: 'text-white/40 hover:text-white/60',
    kpiActive: (m) => `bg-gradient-to-br ${m.bgGlow} ${m.borderGlow} ring-1 ${m.activeRing}`,
    kpiInactive: 'bg-white/[0.03] border-white/[0.06] opacity-50 hover:opacity-80',
    kpiLabel: 'text-white/50',
    kpiValue: 'text-white',
    kpiSub: 'text-white/40',
    emptyBg: 'bg-white/[0.03] border-white/[0.06]',
    emptyIcon: 'text-white/20',
    emptyText: 'text-white/40',
    emptySubtext: 'text-white/25',
    gridStroke: 'rgba(255,255,255,0.06)',
    axisTick: 'rgba(255,255,255,0.45)',
    axisTickY: 'rgba(255,255,255,0.30)',
    cursorFill: 'rgba(255,255,255,0.02)',
    cursorStroke: 'rgba(255,255,255,0.06)',
    dotFill: '#0f172a',
    trendLineStroke: 'rgba(255,255,255,0.3)',
    summaryInactive: 'bg-white/[0.02] border-white/[0.04] opacity-40',
    summaryLabel: 'text-white/45',
    summaryValue: 'text-white',
    gradOpacity: [0.25, 0.08, 0],
  } : {
    bg: 'bg-white',
    border: 'border-gray-200/80',
    headerIcon: 'bg-gray-100 border-gray-200',
    headerIconColor: 'text-gray-600',
    title: 'text-gray-900',
    subtitle: 'text-gray-500',
    toggleBg: 'bg-gray-100 border-gray-200',
    toggleActive: 'bg-white text-gray-900 shadow-sm border border-gray-200',
    toggleInactive: 'text-gray-500 hover:text-gray-700',
    valToggleActive: 'bg-slate-800 text-white shadow-sm',
    valToggleInactive: 'text-gray-500 hover:text-gray-700',
    kpiActive: (m) => `bg-gradient-to-br ${m.lightBg} ${m.lightBorder} ring-1 ${m.lightRing}`,
    kpiInactive: 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-90',
    kpiLabel: 'text-gray-600',
    kpiValue: 'text-gray-900',
    kpiSub: 'text-gray-500',
    emptyBg: 'bg-gray-50 border-gray-200',
    emptyIcon: 'text-gray-300',
    emptyText: 'text-gray-500',
    emptySubtext: 'text-gray-400',
    gridStroke: '#e2e8f0',
    axisTick: '#475569',
    axisTickY: '#64748b',
    cursorFill: 'rgba(0,0,0,0.03)',
    cursorStroke: 'rgba(0,0,0,0.08)',
    dotFill: '#ffffff',
    trendLineStroke: 'rgba(0,0,0,0.2)',
    summaryInactive: 'bg-gray-50 border-gray-200 opacity-50',
    summaryLabel: 'text-gray-600',
    summaryValue: 'text-gray-900',
    gradOpacity: [0.15, 0.05, 0],
  };

  const chartData = useMemo(() => {
    if (precomputedData && precomputedData.length > 0) {
      // Use only the last 3 months
      const last3 = precomputedData.slice(-3);
      return last3.map(m => {
        const opexTotal = m.opex || 0;
        const payrollVal = m.payroll || 0;
        const opexWithoutPayroll = Math.max(opexTotal - payrollVal, 0);
        const ventasNetas = m.ventas || 0;
        return {
          name: m.name, fullName: m.fullName,
          foodCost: m.costos || 0, payroll: payrollVal, opexAmount: opexWithoutPayroll,
          foodCostPercent: m.foodCostPercent || 0, payrollPercent: m.payrollPercent || 0,
          opexPercent: ventasNetas > 0 ? (opexWithoutPayroll / ventasNetas) * 100 : 0,
          totalSales: ventasNetas
        };
      });
    }
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(monthStart);
      const monthSales = sales.filter(s => { if (s.is_cancelled) return false; const d = new Date(s.date_time || s.date); return d >= monthStart && d <= monthEnd; });
      const monthSupply = supplyCosts.filter(c => { if (c.payment_status !== 'pagado') return false; const d = new Date(c.date); return d >= monthStart && d <= monthEnd; });
      const monthOp = opex.filter(o => { if (o.payment_status !== 'pagado') return false; const d = new Date(o.date); return d >= monthStart && d <= monthEnd; });
      const getNet = (s) => { if (s.subtotal > 0) return s.subtotal; return s.total_amount ? Math.round(s.total_amount / (1 + (s.tax_rate || 19) / 100)) : 0; };
      const ts = monthSales.reduce((s, v) => s + getNet(v), 0);
      const fc = monthSupply.reduce((s, c) => s + (c.total_cost || 0), 0);
      const pr = monthOp.filter(o => o.type === 'payroll').reduce((s, o) => s + (o.amount || 0), 0);
      const ox = monthOp.filter(o => o.type !== 'payroll').reduce((s, o) => s + (o.amount || 0), 0);
      months.push({
        name: format(monthStart, 'MMM', { locale: es }), fullName: format(monthStart, 'MMMM yyyy', { locale: es }),
        foodCost: fc, payroll: pr, opexAmount: ox,
        foodCostPercent: ts > 0 ? (fc / ts) * 100 : 0, payrollPercent: ts > 0 ? (pr / ts) * 100 : 0, opexPercent: ts > 0 ? (ox / ts) * 100 : 0,
        totalSales: ts
      });
    }
    return months;
  }, [sales, supplyCosts, opex, precomputedData]);

  const getTrend = (data, key) => { if (data.length < 2) return 0; const r = data.slice(-3).reduce((s, d) => s + d[key], 0) / 3; const o = data.slice(0, 3).reduce((s, d) => s + d[key], 0) / 3; return o > 0 ? ((r - o) / o) * 100 : 0; };
  const foodCostTrend = getTrend(chartData, 'foodCostPercent');
  const payrollTrend = getTrend(chartData, 'payrollPercent');
  const opexTrend = getTrend(chartData, 'opexPercent');
  const latestData = chartData[chartData.length - 1] || {};
  const hasData = chartData.some(d => d.foodCost > 0 || d.payroll > 0 || d.opexAmount > 0);
  const isMetricActive = (id) => activeMetric === 'all' || activeMetric === id;

  const metrics = [
    {
      id: 'foodCost', label: 'COSTO DE VENTA', icon: ShoppingBag, color: '#f59e0b', stroke: '#f59e0b',
      value: viewMode === 'percent' ? `${latestData.foodCostPercent?.toFixed(1) || 0}%` : formatCurrency(latestData.foodCost || 0, currency, { compact: true }),
      subValue: viewMode === 'percent' ? formatCurrency(latestData.foodCost || 0, currency, { compact: true }) : `${latestData.foodCostPercent?.toFixed(1) || 0}%`,
      trend: foodCostTrend, bgGlow: 'from-amber-500/10 to-amber-600/5', borderGlow: 'border-amber-500/20', activeRing: 'ring-amber-400/30',
      lightBg: 'from-amber-50 to-orange-50/50', lightBorder: 'border-amber-200/60', lightRing: 'ring-amber-200/40',
      dataKeyPercent: 'foodCostPercent', dataKeyAmount: 'foodCost',
    },
    {
      id: 'payroll', label: 'COSTO PERSONAL', icon: Users, color: '#a78bfa', stroke: '#8b5cf6',
      value: viewMode === 'percent' ? `${latestData.payrollPercent?.toFixed(1) || 0}%` : formatCurrency(latestData.payroll || 0, currency, { compact: true }),
      subValue: viewMode === 'percent' ? formatCurrency(latestData.payroll || 0, currency, { compact: true }) : `${latestData.payrollPercent?.toFixed(1) || 0}%`,
      trend: payrollTrend, bgGlow: 'from-violet-500/10 to-violet-600/5', borderGlow: 'border-violet-500/20', activeRing: 'ring-violet-400/30',
      lightBg: 'from-violet-50 to-purple-50/50', lightBorder: 'border-violet-200/60', lightRing: 'ring-violet-200/40',
      dataKeyPercent: 'payrollPercent', dataKeyAmount: 'payroll',
    },
    {
      id: 'opex', label: 'OPEX', icon: Settings, color: '#22d3ee', stroke: '#06b6d4',
      value: viewMode === 'percent' ? `${latestData.opexPercent?.toFixed(1) || 0}%` : formatCurrency(latestData.opexAmount || 0, currency, { compact: true }),
      subValue: viewMode === 'percent' ? formatCurrency(latestData.opexAmount || 0, currency, { compact: true }) : `${latestData.opexPercent?.toFixed(1) || 0}%`,
      trend: opexTrend, bgGlow: 'from-cyan-500/10 to-cyan-600/5', borderGlow: 'border-cyan-500/20', activeRing: 'ring-cyan-400/30',
      lightBg: 'from-cyan-50 to-teal-50/50', lightBorder: 'border-cyan-200/60', lightRing: 'ring-cyan-200/40',
      dataKeyPercent: 'opexPercent', dataKeyAmount: 'opexAmount',
    },
  ];

  const TrendBadge = ({ value }) => {
    if (Math.abs(value) < 0.5) return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        isDark ? 'bg-white/[0.08] text-white/50 border-white/[0.06]' : 'bg-gray-100 text-gray-600 border-gray-300'
      }`}>
        <Minus className="w-3 h-3" /> estable
      </span>
    );
    const isGood = value < 0;
    const Icon = value > 0 ? TrendingUp : TrendingDown;
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        isGood ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
      }`}>
        <Icon className="w-3 h-3" />
        {Math.abs(value).toFixed(0)}%
      </span>
    );
  };

  return (
    <div className={`rounded-2xl shadow-2xl overflow-hidden border relative transition-all duration-500 ${t.bg} ${t.border}`}>
      {/* Ambient glow (dark only) */}
      {isDark && <>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/[0.03] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/[0.03] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-cyan-500/[0.03] rounded-full blur-[80px] pointer-events-none" />
      </>}

      {/* Header */}
      <div className="px-6 pt-6 pb-4 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 backdrop-blur-sm rounded-xl flex items-center justify-center border ${t.headerIcon}`}>
              <BarChart3 className={`w-5 h-5 ${t.headerIconColor}`} />
            </div>
            <div>
              <h3 className={`text-base font-bold tracking-tight ${t.title}`} translate="no">Evolución de Costos</h3>
              <p className={`text-[11px] mt-0.5 font-medium ${t.subtitle}`} translate="no">
                Últimos 3 meses • {viewMode === 'percent' ? '% sobre ventas netas' : 'Valores absolutos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 border ${
                isDark 
                  ? 'bg-white/[0.06] border-white/[0.08] hover:bg-white/[0.12] text-amber-300' 
                  : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-slate-500'
              }`}
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className={`flex items-center rounded-xl p-0.5 border ${t.toggleBg}`}>
              {['area', 'bar'].map(k => (
                <button key={k} onClick={() => setChartType(k)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${chartType === k ? t.toggleActive : t.toggleInactive}`}
                >{k === 'area' ? 'Área' : 'Barras'}</button>
              ))}
            </div>
            <div className={`flex items-center rounded-xl p-0.5 border ${t.toggleBg}`}>
              {['percent', 'amount'].map(k => (
                <button key={k} onClick={() => setViewMode(k)} translate="no"
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${viewMode === k ? t.valToggleActive : t.valToggleInactive}`}
                >{k === 'percent' ? '%' : '$'}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-6 pb-5">
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((m) => {
            const Icon = m.icon;
            const active = isMetricActive(m.id);
            return (
              <motion.button key={m.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={() => setActiveMetric(activeMetric === m.id ? 'all' : m.id)}
                className={`relative group p-4 rounded-xl transition-all duration-300 border text-left overflow-hidden ${
                  active ? t.kpiActive(m) : t.kpiInactive
                }`}
              >
                {active && isDark && <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />}
                <div className="relative flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${m.color}15` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                      </div>
                      <span className={`text-[9px] font-bold tracking-widest truncate ${t.kpiLabel}`} translate="no">{m.label}</span>
                    </div>
                    <p className={`text-2xl font-black leading-none tracking-tight ${t.kpiValue}`}>{m.value}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-medium ${t.kpiSub}`}>{m.subValue}</span>
                      <TrendBadge value={m.trend} />
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    <Sparkline data={chartData} dataKey={viewMode === 'percent' ? m.dataKeyPercent : m.dataKeyAmount} color={m.color} width={56} height={28} />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="px-6 pb-6 relative">
        {!hasData ? (
          <div className="h-64 flex flex-col items-center justify-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border ${t.emptyBg}`}>
              <Activity className={`w-8 h-8 ${t.emptyIcon}`} />
            </div>
            <p className={`text-sm font-semibold ${t.emptyText}`} translate="no">Sin datos de costos</p>
            <p className={`text-xs mt-1 ${t.emptySubtext}`} translate="no">Importa compras y gastos para ver la tendencia</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }} barGap={3} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: t.axisTick, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 10, fill: t.axisTickY }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => viewMode === 'percent' ? `${v}%` : v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                    domain={[0, 'auto']} width={45}
                  />
                  <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: t.cursorFill }} />
                  {isMetricActive('foodCost') && <Bar dataKey={viewMode === 'percent' ? 'foodCostPercent' : 'foodCost'} fill="#f59e0b" shape={<RoundedBar />} />}
                  {isMetricActive('payroll') && <Bar dataKey={viewMode === 'percent' ? 'payrollPercent' : 'payroll'} fill="#a78bfa" shape={<RoundedBar />} />}
                  {isMetricActive('opex') && <Bar dataKey={viewMode === 'percent' ? 'opexPercent' : 'opexAmount'} fill="#22d3ee" shape={<RoundedBar />} />}
                  {activeMetric !== 'all' && (
                    <Line type="monotone" dataKey={viewMode === 'percent' ? metrics.find(m => m.id === activeMetric)?.dataKeyPercent : metrics.find(m => m.id === activeMetric)?.dataKeyAmount}
                      stroke={t.trendLineStroke} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  )}
                </ComposedChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gFood" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={t.gradOpacity[0]} />
                      <stop offset="50%" stopColor="#f59e0b" stopOpacity={t.gradOpacity[1]} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={t.gradOpacity[2]} />
                    </linearGradient>
                    <linearGradient id="gPayroll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={t.gradOpacity[0]} />
                      <stop offset="50%" stopColor="#a78bfa" stopOpacity={t.gradOpacity[1]} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={t.gradOpacity[2]} />
                    </linearGradient>
                    <linearGradient id="gOpex" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={t.gradOpacity[0]} />
                      <stop offset="50%" stopColor="#22d3ee" stopOpacity={t.gradOpacity[1]} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={t.gradOpacity[2]} />
                    </linearGradient>
                    <filter id="glA"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                    <filter id="glV"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                    <filter id="glC"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: t.axisTick, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 10, fill: t.axisTickY }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => viewMode === 'percent' ? `${v}%` : v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                    domain={[0, 'auto']} width={45}
                  />
                  <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ stroke: t.cursorStroke, strokeWidth: 1 }} />
                  {isMetricActive('foodCost') && (
                    <Area type="monotone" dataKey={viewMode === 'percent' ? 'foodCostPercent' : 'foodCost'}
                      stroke="#f59e0b" strokeWidth={2.5} fill="url(#gFood)"
                      dot={{ fill: t.dotFill, stroke: '#f59e0b', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 7, fill: '#f59e0b', stroke: t.dotFill, strokeWidth: 3, filter: isDark ? 'url(#glA)' : undefined }}
                    />
                  )}
                  {isMetricActive('payroll') && (
                    <Area type="monotone" dataKey={viewMode === 'percent' ? 'payrollPercent' : 'payroll'}
                      stroke="#a78bfa" strokeWidth={2.5} fill="url(#gPayroll)"
                      dot={{ fill: t.dotFill, stroke: '#a78bfa', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 7, fill: '#a78bfa', stroke: t.dotFill, strokeWidth: 3, filter: isDark ? 'url(#glV)' : undefined }}
                    />
                  )}
                  {isMetricActive('opex') && (
                    <Area type="monotone" dataKey={viewMode === 'percent' ? 'opexPercent' : 'opexAmount'}
                      stroke="#22d3ee" strokeWidth={2.5} fill="url(#gOpex)"
                      dot={{ fill: t.dotFill, stroke: '#22d3ee', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 7, fill: '#22d3ee', stroke: t.dotFill, strokeWidth: 3, filter: isDark ? 'url(#glC)' : undefined }}
                    />
                  )}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>


    </div>
  );
}