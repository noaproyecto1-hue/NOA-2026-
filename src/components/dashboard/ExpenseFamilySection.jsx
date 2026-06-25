import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Scatter, ScatterChart
} from 'recharts';
import { formatCurrency } from '@/components/utils/currencyHelper';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, ArrowLeft, Percent } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format, parseISO, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

// Paleta de colores bien diferenciados
const PALETTE = [
  '#f97316', '#47587A', '#10b981', '#ef4444', '#47587A',
  '#47587A', '#47587A', '#eab308', '#47587A', '#f43f5e',
  '#47587A', '#64748b', '#47587A', '#47587A', '#0ea5e9',
  '#fb923c', '#324367', '#059669', '#dc2626', '#324367'
];

// Shapes para puntos (recharts dot shapes)
const DOT_SHAPES = ['circle', 'diamond', 'square', 'triangle', 'star', 'cross', 'wye'];

const CustomDot = ({ cx, cy, fill, shapeIndex = 0, r = 5 }) => {
  const shape = DOT_SHAPES[shapeIndex % DOT_SHAPES.length];
  if (shape === 'diamond') {
    return <polygon points={`${cx},${cy-r} ${cx+r},${cy} ${cx},${cy+r} ${cx-r},${cy}`} fill={fill} stroke="white" strokeWidth={1.5} />;
  }
  if (shape === 'square') {
    return <rect x={cx - r*0.7} y={cy - r*0.7} width={r*1.4} height={r*1.4} fill={fill} stroke="white" strokeWidth={1.5} rx={2} />;
  }
  if (shape === 'triangle') {
    return <polygon points={`${cx},${cy-r} ${cx+r},${cy+r*0.7} ${cx-r},${cy+r*0.7}`} fill={fill} stroke="white" strokeWidth={1.5} />;
  }
  // Default: circle
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke="white" strokeWidth={2} />;
};

const ChartTooltip = ({ active, payload, label, currency, totalSalesForPeriod }) => {
  if (!active || !payload || payload.length === 0) return null;
  
  // Find the % s/Ventas entry
  const pctEntry = payload.find(p => p.dataKey === '__pctVentas');
  const dataEntries = payload.filter(p => p.dataKey !== '__pctVentas');

  return (
    <div className="bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[220px] max-w-[320px]">
      <p className="font-bold text-gray-900 mb-1 text-sm border-b border-gray-100 pb-2">{label}</p>
      {pctEntry && (
        <div className="mb-2 mt-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-700 font-semibold flex items-center gap-1">
              <Percent className="w-3 h-3" /> Costo vs Venta
            </span>
            <span className="font-bold text-slate-900 text-sm">{(pctEntry.value || 0).toFixed(1)}%</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">De cada $100 vendidos, ${(pctEntry.value || 0).toFixed(0)} fueron a este costo</p>
        </div>
      )}
      <div className="space-y-1 mt-1">
        {dataEntries.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-700 truncate">{entry.name}</span>
            </div>
            <span className="font-bold text-gray-900 whitespace-nowrap">
              {formatCurrency(entry.value, currency, { compact: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CustomLegend = ({ payload, searchQuery }) => {
  if (!payload) return null;
  const filtered = payload.filter(p => p.dataKey !== '__pctVentas');
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2 px-4">
      {filtered.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600 font-medium">{entry.value}</span>
        </div>
      ))}
      {payload.find(p => p.dataKey === '__pctVentas') && (
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-0.5 bg-slate-700 rounded" style={{ borderTop: '2px dashed #334155' }} />
          <span className="text-gray-600 font-medium">Costo vs Venta %</span>
        </div>
      )}
    </div>
  );
};

export default function ExpenseFamilySection({
  title,
  icon: Icon,
  color,
  gradientFrom,
  gradientTo,
  allData = [],
  allSales = {},
  currency = 'CLP',
  getCategoryFn,
  getItemFn,
  getAmountFn,
  getDateFn,
  viewMode = 'monthly'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  // Group by category
  const categories = useMemo(() => {
    const grouped = {};
    allData.forEach(record => {
      const cat = getCategoryFn(record) || 'Sin categoría';
      const amount = getAmountFn(record);
      if (!grouped[cat]) grouped[cat] = { name: cat, total: 0, count: 0 };
      grouped[cat].total += amount;
      grouped[cat].count += 1;
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [allData, getCategoryFn, getAmountFn]);

  const totalAmount = useMemo(() => categories.reduce((s, c) => s + c.total, 0), [categories]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [categories, searchQuery]);

  // Build trend data for categories
  const categoryTrendData = useMemo(() => {
    if (!isOpen || selectedCategory) return [];
    return buildTrendData(allData, allSales, viewMode, getCategoryFn, getAmountFn, getDateFn, categories.map(c => c.name));
  }, [isOpen, selectedCategory, allData, allSales, viewMode, getCategoryFn, getAmountFn, getDateFn, categories]);

  // Build trend for items
  const itemTrendData = useMemo(() => {
    if (!selectedCategory) return { data: [], keys: [] };
    const catData = allData.filter(r => getCategoryFn(r) === selectedCategory);
    const itemTotals = {};
    catData.forEach(r => {
      const item = getItemFn(r) || 'Sin especificar';
      itemTotals[item] = (itemTotals[item] || 0) + getAmountFn(r);
    });
    const topItems = Object.entries(itemTotals).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name]) => name);
    const data = buildTrendData(catData, allSales, viewMode, getItemFn, getAmountFn, getDateFn, topItems);
    return { data, keys: topItems };
  }, [selectedCategory, allData, allSales, viewMode, getItemFn, getAmountFn, getDateFn, getCategoryFn]);

  const categoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    const items = {};
    allData.filter(r => getCategoryFn(r) === selectedCategory).forEach(r => {
      const name = getItemFn(r) || 'Sin especificar';
      if (!items[name]) items[name] = { name, total: 0, count: 0 };
      items[name].total += getAmountFn(r);
      items[name].count += 1;
    });
    return Object.values(items).sort((a, b) => b.total - a.total);
  }, [selectedCategory, allData, getCategoryFn, getItemFn, getAmountFn]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return categoryItems;
    return categoryItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [categoryItems, searchQuery]);

  const trendKeys = useMemo(() => {
    if (selectedCategory) return itemTrendData.keys;
    return filteredCategories.map(c => c.name).slice(0, 12);
  }, [selectedCategory, filteredCategories, itemTrendData]);

  const trendData = selectedCategory ? itemTrendData.data : categoryTrendData;

  // Filter visible keys by search
  const visibleKeys = useMemo(() => {
    if (!searchQuery) return trendKeys;
    return trendKeys.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [trendKeys, searchQuery]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="bg-white border-0 shadow-xl overflow-hidden">
        {/* Header */}
        <div
          onClick={() => { setIsOpen(!isOpen); setSelectedCategory(null); setSearchQuery(''); }}
          className={`cursor-pointer transition-all duration-300 ${isOpen ? '' : 'hover:shadow-md'}`}
        >
          <CardHeader className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} border-b`}>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span>{title}</span>
                  <p className="text-sm font-normal text-gray-500">
                    {categories.length} subcategorías • Click para {isOpen ? 'cerrar' : 'expandir'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="text-lg px-3 py-1" style={{
                  backgroundColor: color.includes('orange') ? '#fff7ed' : color.includes('indigo') ? '#eef2ff' : '#eff6ff',
                  color: color.includes('orange') ? '#c2410c' : color.includes('indigo') ? '#233152' : '#1d4ed8'
                }}>
                  {formatCurrency(totalAmount, currency, { compact: true })}
                </Badge>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                </motion.div>
              </div>
            </CardTitle>
          </CardHeader>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent className="p-6">
                {/* Back button */}
                {selectedCategory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedCategory(null); setSearchQuery(''); }}
                    className="mb-4 text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Volver a subcategorías
                  </Button>
                )}

                {/* Subtitle + Search */}
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                  <h3 className="font-semibold text-gray-800 text-base">
                    {selectedCategory ? (
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-sm">{selectedCategory}</Badge>
                        Evolución por Ítem
                      </span>
                    ) : (
                      'Evolución por Subcategoría'
                    )}
                  </h3>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder={selectedCategory ? "Buscar ítem..." : "Buscar subcategoría..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-sm border-gray-200 rounded-xl"
                    />
                  </div>
                </div>

                {/* Chart: Lines with dots + % s/Ventas dashed line on right Y axis */}
                {trendData.length > 1 && visibleKeys.length > 0 ? (
                  <div className="h-80 mb-6 bg-slate-50/50 rounded-2xl p-3 border border-slate-100">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          tickFormatter={(v) => formatCurrency(v, currency, { compact: true, showSymbol: false })}
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                          width={55}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                          width={45}
                          domain={[0, 'auto']}
                          label={{ value: 'Costo vs Venta %', angle: 90, position: 'insideRight', style: { fontSize: 9, fill: '#94a3b8' }, offset: 10 }}
                        />
                        <Tooltip content={<ChartTooltip currency={currency} />} />
                        <Legend content={<CustomLegend />} />

                        {/* Data lines with distinct dots */}
                        {visibleKeys.map((key, i) => (
                          <Line
                            key={key}
                            yAxisId="left"
                            type="monotone"
                            dataKey={key}
                            stroke={PALETTE[i % PALETTE.length]}
                            strokeWidth={2.5}
                            dot={(props) => (
                              <CustomDot
                                key={props.key}
                                cx={props.cx}
                                cy={props.cy}
                                fill={PALETTE[i % PALETTE.length]}
                                shapeIndex={i}
                                r={5}
                              />
                            )}
                            activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff', fill: PALETTE[i % PALETTE.length] }}
                            name={key}
                            connectNulls
                          />
                        ))}

                        {/* % sobre ventas dashed line */}
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="__pctVentas"
                          stroke="#334155"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={{ fill: '#334155', r: 3, strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: '#334155', stroke: '#fff', strokeWidth: 2 }}
                          name="Costo vs Venta %"
                          connectNulls
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-gray-400 text-sm mb-6 bg-gray-50 rounded-xl">
                    {trendData.length <= 1 ? 'Se necesitan al menos 2 períodos para mostrar la evolución' : 'Sin resultados para la búsqueda'}
                  </div>
                )}

                {/* Category / Item List */}
                <div className="space-y-1.5">
                  {(selectedCategory ? filteredItems : filteredCategories).map((item, i) => {
                    const pct = totalAmount > 0 ? (item.total / totalAmount) * 100 : 0;
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => {
                          if (!selectedCategory) {
                            setSelectedCategory(item.name);
                            setSearchQuery('');
                          }
                        }}
                        className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                          !selectedCategory ? 'cursor-pointer hover:bg-gray-50 hover:shadow-sm' : 'bg-gray-50/50'
                        }`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded flex-shrink-0"
                          style={{ backgroundColor: PALETTE[i % PALETTE.length], borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '50%' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 text-sm truncate">{item.name}</span>
                            <div className="flex items-center gap-2 ml-2">
                              <span className="text-xs text-gray-500">{item.count} reg.</span>
                              <span className="font-bold text-gray-900 text-sm whitespace-nowrap">
                                {formatCurrency(item.total, currency, { compact: true })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(pct, 100)}%` }}
                                transition={{ duration: 0.6, delay: i * 0.03 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                              />
                            </div>
                            <span className="text-xs font-semibold w-12 text-right" style={{ color: PALETTE[i % PALETTE.length] }}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {!selectedCategory && (
                          <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-gray-600 -rotate-90 flex-shrink-0 transition-colors" />
                        )}
                      </motion.div>
                    );
                  })}
                  {(selectedCategory ? filteredItems : filteredCategories).length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-8">No se encontraron resultados</p>
                  )}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// Build trend data grouped by time period, includes __pctVentas
// allSales is now a pre-aggregated object: { "YYYY-MM": totalAmount } from the backend
function buildTrendData(records, allSalesByMonth, viewMode, groupFn, amountFn, dateFn, keys) {
  if (records.length === 0) return [];

  const dates = records.map(r => dateFn(r)).filter(Boolean).sort();
  if (dates.length === 0) return [];

  // allSalesByMonth is { "2026-01": 12345, "2026-02": 67890, ... }
  const salesByMonth = typeof allSalesByMonth === 'object' && !Array.isArray(allSalesByMonth) 
    ? allSalesByMonth 
    : {};

  if (viewMode === 'annual') {
    const firstDate = parseISO(dates[0]);
    const lastDate = parseISO(dates[dates.length - 1]);
    const months = eachMonthOfInterval({ start: startOfMonth(firstDate), end: endOfMonth(lastDate) });

    return months.map(m => {
      const key = format(m, 'yyyy-MM');
      const label = format(m, 'MMM yy', { locale: es });
      const row = { label };
      let periodTotal = 0;
      keys.forEach(k => {
        const val = records
          .filter(r => (dateFn(r) || '').startsWith(key) && groupFn(r) === k)
          .reduce((s, r) => s + amountFn(r), 0);
        row[k] = val;
        periodTotal += val;
      });
      const periodSales = salesByMonth[key] || 0;
      row.__pctVentas = periodSales > 0 ? (periodTotal / periodSales) * 100 : 0;
      return row;
    });
  } else {
    const firstDate = parseISO(dates[0]);
    const lastDate = parseISO(dates[dates.length - 1]);
    const dayCount = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;

    if (dayCount > 35) {
      const weeks = {};
      records.forEach(r => {
        const d = dateFn(r);
        if (!d) return;
        const date = parseISO(d);
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        if (!weeks[weekKey]) weeks[weekKey] = {};
        const k = groupFn(r);
        weeks[weekKey][k] = (weeks[weekKey][k] || 0) + amountFn(r);
      });
      return Object.entries(weeks).sort().map(([weekKey, data]) => {
        const label = format(parseISO(weekKey), "d MMM", { locale: es });
        const row = { label };
        let periodTotal = 0;
        keys.forEach(k => { row[k] = data[k] || 0; periodTotal += (data[k] || 0); });
        // Approximate sales from monthly totals for the week's month
        const monthKey = weekKey.substring(0, 7);
        const monthSales = salesByMonth[monthKey] || 0;
        // Rough weekly estimate: monthly total / 4
        row.__pctVentas = monthSales > 0 ? (periodTotal / (monthSales / 4)) * 100 : 0;
        return row;
      });
    } else {
      const days = eachDayOfInterval({ start: firstDate, end: lastDate });
      return days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const label = format(day, 'd MMM', { locale: es });
        const row = { label };
        let periodTotal = 0;
        keys.forEach(k => {
          const val = records
            .filter(r => dateFn(r) === dayStr && groupFn(r) === k)
            .reduce((s, r) => s + amountFn(r), 0);
          row[k] = val;
          periodTotal += val;
        });
        // Approximate daily sales from monthly total / 30
        const monthKey = dayStr.substring(0, 7);
        const monthSales = salesByMonth[monthKey] || 0;
        row.__pctVentas = monthSales > 0 ? (periodTotal / (monthSales / 30)) * 100 : 0;
        return row;
      });
    }
  }
}