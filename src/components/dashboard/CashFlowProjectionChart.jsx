import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Target, Wallet, ArrowRight, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/components/utils/currencyHelper';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isBefore, isToday, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md p-4 border border-gray-100 shadow-2xl rounded-2xl">
        <p className="font-bold text-gray-900 mb-2 text-sm">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-bold" style={{ color: entry.color }}>
              {formatCurrency(entry.value, currency)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Valores por defecto para proyección
const DEFAULT_PROJECTION_SETTINGS = {
  optimistic_sales_factor: 1.15,   // +15% ventas
  optimistic_cost_factor: 0.95,    // -5% costos
  pessimistic_sales_factor: 0.85,  // -15% ventas
  pessimistic_cost_factor: 1.10    // +10% costos
};

export default function CashFlowProjectionChart({ 
  sales = [], 
  supplyCosts = [], 
  opex = [],
  targetNetProfit = 0,
  currency = 'USD',
  dateRange,
  projectionSettings = {} // Configuración personalizada del restaurante
}) {
  // Merge con valores por defecto
  const settings = { ...DEFAULT_PROJECTION_SETTINGS, ...projectionSettings };
  
  const chartData = useMemo(() => {
    const monthStart = dateRange?.from || startOfMonth(new Date());
    const monthEnd = dateRange?.to || endOfMonth(new Date());
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const today = new Date();
    
    let accumulatedSales = 0;
    let accumulatedCosts = 0;
    let accumulatedOpex = 0;
    
    // Calcular totales hasta hoy para la proyección
    const salesUpToNow = sales
      .filter(s => !s.is_cancelled && isBefore(new Date(s.date_time || s.date), addDays(today, 1)))
      .reduce((sum, s) => sum + (s.subtotal || (s.total_amount / 1.19) || 0), 0);
    
    const costsUpToNow = supplyCosts
      .filter(c => isBefore(new Date(c.date), addDays(today, 1)))
      .reduce((sum, c) => sum + (c.total_cost || 0), 0);
    
    const opexUpToNow = opex
      .filter(o => isBefore(new Date(o.date), addDays(today, 1)))
      .reduce((sum, o) => sum + (o.amount || 0), 0);
    
    // Días transcurridos y totales
    const daysElapsed = allDays.filter(d => isBefore(d, addDays(today, 1))).length;
    const totalDays = allDays.length;
    const remainingDays = totalDays - daysElapsed;
    
    // Ritmo diario promedio
    const dailySalesRate = daysElapsed > 0 ? salesUpToNow / daysElapsed : 0;
    const dailyCostsRate = daysElapsed > 0 ? costsUpToNow / daysElapsed : 0;
    const dailyOpexRate = daysElapsed > 0 ? opexUpToNow / daysElapsed : 0;
    
    return allDays.map((day, index) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'd MMM', { locale: es });
      const isPast = isBefore(day, today) || isToday(day);
      
      if (isPast) {
        // Datos reales
        const daySales = sales
          .filter(s => !s.is_cancelled && (s.date_time || s.date)?.startsWith(dayStr))
          .reduce((sum, s) => sum + (s.subtotal || (s.total_amount / 1.19) || 0), 0);
        
        const dayCosts = supplyCosts
          .filter(c => c.date?.startsWith(dayStr))
          .reduce((sum, c) => sum + (c.total_cost || 0), 0);
        
        const dayOpex = opex
          .filter(o => o.date?.startsWith(dayStr))
          .reduce((sum, o) => sum + (o.amount || 0), 0);
        
        accumulatedSales += daySales;
        accumulatedCosts += dayCosts;
        accumulatedOpex += dayOpex;
        
        const realCashFlow = accumulatedSales - accumulatedCosts - accumulatedOpex;
        
        return {
          name: dayLabel,
          day: index + 1,
          flujoReal: realCashFlow,
          flujoProyectado: null,
          flujoOptimista: null,
          flujoPesimista: null,
          isToday: isToday(day)
        };
      } else {
        // Proyección para días futuros usando configuración del restaurante
        const daysFromNow = index - daysElapsed + 1;
        
        // Escenario base (ritmo actual)
        const projectedSales = salesUpToNow + (dailySalesRate * daysFromNow);
        const projectedCosts = costsUpToNow + (dailyCostsRate * daysFromNow);
        const projectedOpex = opexUpToNow + (dailyOpexRate * daysFromNow);
        const projectedCashFlow = projectedSales - projectedCosts - projectedOpex;
        
        // Escenario optimista (usando factores configurados)
        const optimisticSales = salesUpToNow + (dailySalesRate * settings.optimistic_sales_factor * daysFromNow);
        const optimisticCosts = costsUpToNow + (dailyCostsRate * settings.optimistic_cost_factor * daysFromNow);
        const optimisticCashFlow = optimisticSales - optimisticCosts - projectedOpex;
        
        // Escenario pesimista (usando factores configurados)
        const pessimisticSales = salesUpToNow + (dailySalesRate * settings.pessimistic_sales_factor * daysFromNow);
        const pessimisticCosts = costsUpToNow + (dailyCostsRate * settings.pessimistic_cost_factor * daysFromNow);
        const pessimisticCashFlow = pessimisticSales - pessimisticCosts - projectedOpex;
        
        return {
          name: dayLabel,
          day: index + 1,
          flujoReal: null,
          flujoProyectado: projectedCashFlow,
          flujoOptimista: optimisticCashFlow,
          flujoPesimista: pessimisticCashFlow,
          isToday: false
        };
      }
    });
  }, [sales, supplyCosts, opex, dateRange, settings]);

  // Cálculos finales
  const lastRealData = chartData.filter(d => d.flujoReal !== null).slice(-1)[0];
  const lastProjectedData = chartData.slice(-1)[0];
  
  const currentCashFlow = lastRealData?.flujoReal || 0;
  const projectedEndCashFlow = lastProjectedData?.flujoProyectado || lastProjectedData?.flujoReal || 0;
  const optimisticEndCashFlow = lastProjectedData?.flujoOptimista || projectedEndCashFlow;
  const pessimisticEndCashFlow = lastProjectedData?.flujoPesimista || projectedEndCashFlow;
  
  const targetProgress = targetNetProfit > 0 ? (projectedEndCashFlow / targetNetProfit) * 100 : 0;
  const isOnTrack = targetNetProfit > 0 ? projectedEndCashFlow >= targetNetProfit * 0.9 : projectedEndCashFlow >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-2xl rounded-3xl overflow-hidden">
        {/* Header Premium */}
        <CardHeader className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 border-b border-gray-100/50 pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Wallet className="w-7 h-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Flujo de Caja Proyectado</CardTitle>
                <CardDescription className="text-gray-500">
                  Proyección basada en el ritmo actual de ventas y gastos
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className={`px-4 py-2 text-sm font-semibold ${isOnTrack ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {isOnTrack ? (
                  <><TrendingUp className="w-4 h-4 mr-1" /> En buen camino</>
                ) : (
                  <><TrendingDown className="w-4 h-4 mr-1" /> Requiere atención</>
                )}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* KPIs Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border border-cyan-100"
            >
              <p className="text-xs text-cyan-600 font-semibold mb-1">ACTUAL</p>
              <p className={`text-2xl font-bold ${currentCashFlow >= 0 ? 'text-cyan-700' : 'text-red-600'}`}>
                {formatCurrency(currentCashFlow, currency, { compact: true })}
              </p>
              <p className="text-xs text-gray-500 mt-1">Flujo acumulado hoy</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 }}
              className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100"
            >
              <p className="text-xs text-indigo-600 font-semibold mb-1">PROYECTADO</p>
              <p className={`text-2xl font-bold ${projectedEndCashFlow >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                {formatCurrency(projectedEndCashFlow, currency, { compact: true })}
              </p>
              <p className="text-xs text-gray-500 mt-1">Al cierre del mes</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border border-emerald-100"
            >
              <p className="text-xs text-emerald-600 font-semibold mb-1">OPTIMISTA</p>
              <p className="text-2xl font-bold text-emerald-700">
                {formatCurrency(optimisticEndCashFlow, currency, { compact: true })}
              </p>
              <p className="text-xs text-gray-500 mt-1">+{((settings.optimistic_sales_factor - 1) * 100).toFixed(0)}% ventas, -{((1 - settings.optimistic_cost_factor) * 100).toFixed(0)}% costos</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 }}
              className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-4 border border-rose-100"
            >
              <p className="text-xs text-rose-600 font-semibold mb-1">PESIMISTA</p>
              <p className={`text-2xl font-bold ${pessimisticEndCashFlow >= 0 ? 'text-rose-700' : 'text-red-600'}`}>
                {formatCurrency(pessimisticEndCashFlow, currency, { compact: true })}
              </p>
              <p className="text-xs text-gray-500 mt-1">-{((1 - settings.pessimistic_sales_factor) * 100).toFixed(0)}% ventas, +{((settings.pessimistic_cost_factor - 1) * 100).toFixed(0)}% costos</p>
            </motion.div>
          </div>

          {/* Chart */}
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProyectado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#47587A" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#47587A" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOptimista" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPesimista" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={(value) => formatCurrency(value, currency, { compact: true })}
                  width={80}
                />
                
                <Tooltip content={<CustomTooltip currency={currency} />} />
                
                {targetNetProfit > 0 && (
                  <ReferenceLine 
                    y={targetNetProfit} 
                    stroke="#f59e0b" 
                    strokeDasharray="8 4" 
                    strokeWidth={2}
                    label={{ 
                      value: `Meta: ${formatCurrency(targetNetProfit, currency, { compact: true })}`, 
                      position: 'insideTopRight',
                      fill: '#f59e0b',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}
                  />
                )}
                
                <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />
                
                {/* Escenario Pesimista */}
                <Area
                  type="monotone"
                  dataKey="flujoPesimista"
                  name="Pesimista"
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="url(#colorPesimista)"
                  connectNulls={false}
                />
                
                {/* Escenario Optimista */}
                <Area
                  type="monotone"
                  dataKey="flujoOptimista"
                  name="Optimista"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="url(#colorOptimista)"
                  connectNulls={false}
                />
                
                {/* Proyección Base */}
                <Area
                  type="monotone"
                  dataKey="flujoProyectado"
                  name="Proyectado"
                  stroke="#47587A"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  fill="url(#colorProyectado)"
                  connectNulls={false}
                />
                
                {/* Datos Reales */}
                <Area
                  type="monotone"
                  dataKey="flujoReal"
                  name="Real"
                  stroke="#0891b2"
                  strokeWidth={3}
                  fill="url(#colorReal)"
                  connectNulls={false}
                  dot={{ fill: '#0891b2', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 6, fill: '#0891b2', stroke: '#fff', strokeWidth: 2 }}
                />

                <Legend 
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Insight Footer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border border-indigo-100"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-1">¿Cómo se calcula?</h4>
                <p className="text-sm text-gray-600">
                  La proyección usa tu <span className="font-semibold text-indigo-600">ritmo diario actual</span> de ventas y gastos. 
                  Los escenarios optimista ({((settings.optimistic_sales_factor - 1) * 100).toFixed(0)}% ventas, -{((1 - settings.optimistic_cost_factor) * 100).toFixed(0)}% costos) 
                  y pesimista (-{((1 - settings.pessimistic_sales_factor) * 100).toFixed(0)}% ventas, +{((settings.pessimistic_cost_factor - 1) * 100).toFixed(0)}% costos) 
                  usan la configuración de tu restaurante.
                </p>
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}