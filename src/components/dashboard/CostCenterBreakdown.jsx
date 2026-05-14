import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatCurrency } from '@/components/utils/currencyHelper';
import { motion } from 'framer-motion';
import { Receipt, TrendingUp, Utensils, Users, ShoppingBag, CheckCircle2, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import ExpenseFamilySection from './ExpenseFamilySection';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Evalúa el estado semáforo usando umbrales de alertas (% sobre VENTAS)
// threshold: { green: number, yellow: number, red: number }
function getHealthStatus(percentage, threshold) {
  if (!threshold) return { status: 'neutral', color: null };
  const green = threshold.green ?? 30;
  const yellow = threshold.yellow ?? 35;
  
  if (percentage <= green) return { status: 'excellent', color: 'green' };
  if (percentage <= yellow) return { status: 'acceptable', color: 'yellow' };
  return { status: 'alert', color: 'red' };
}

// Gradientes según estado semáforo
const HEALTH_GRADIENTS = {
  green: { gradient: 'from-emerald-500 via-emerald-600 to-green-600', textColor: 'text-emerald-100', icon: CheckCircle2, label: 'Excelente' },
  yellow: { gradient: 'from-amber-400 via-amber-500 to-yellow-500', textColor: 'text-amber-100', icon: Info, label: 'Aceptable' },
  red: { gradient: 'from-red-500 via-red-600 to-rose-600', textColor: 'text-red-100', icon: AlertTriangle, label: 'Alerta' },
  neutral: { gradient: null, textColor: null, icon: null, label: '' }
};

const FAMILY_COLORS = {
  foodCost: { fill: '#f97316', gradient: 'from-orange-400 to-amber-500' },
  payroll: { fill: '#6366f1', gradient: 'from-indigo-400 to-purple-500' },
  opex: { fill: '#3b82f6', gradient: 'from-blue-400 to-cyan-500' }
};

const DonutTooltip = ({ active, payload, currency }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-2xl border border-gray-100">
      <p className="font-bold text-gray-900 text-sm">{d.name}</p>
      <p className="text-lg font-bold" style={{ color: d.color }}>{formatCurrency(d.value, currency, { compact: true })}</p>
      <p className="text-xs text-gray-500">{d.percentage?.toFixed(1)}% del total</p>
    </div>
  );
};

export default function CostCenterBreakdown({
  supplyCosts = [],
  opex = [],
  allSupplyCosts = [],
  allOpex = [],
  allSales = {},
  restaurantConfig = {},
  currency = 'CLP',
  viewMode = 'monthly',
  totalSales = 0,
}) {
  // Totals from current period
  const totalFoodCost = useMemo(() => supplyCosts.reduce((sum, c) => sum + (c.total_cost || c.subtotal || 0), 0), [supplyCosts]);
  const totalPayroll = useMemo(() => opex.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll')).reduce((s, o) => s + (o.amount || 0), 0), [opex]);
  const totalOpexOnly = useMemo(() => opex.filter(o => o.type !== 'payroll' && !(o.cost_center_name || '').toLowerCase().includes('payroll')).reduce((s, o) => s + (o.amount || 0), 0), [opex]);

  // Alert thresholds (% sobre ventas) — configurado en Centro de Alertas
  const alertThresholds = restaurantConfig?.alert_thresholds || {};

  const grandTotal = totalFoodCost + totalPayroll + totalOpexOnly;

  // % sobre VENTAS — usado para semáforo
  const foodCostPctSales = totalSales > 0 ? (totalFoodCost / totalSales) * 100 : 0;
  const payrollPctSales = totalSales > 0 ? (totalPayroll / totalSales) * 100 : 0;
  const opexPctSales = totalSales > 0 ? (totalOpexOnly / totalSales) * 100 : 0;

  // Estado semáforo basado en % sobre VENTAS (umbrales de alertas)
  const foodCostHealth = getHealthStatus(foodCostPctSales, alertThresholds.food_cost_percent);
  const payrollHealth = getHealthStatus(payrollPctSales, alertThresholds.labor_cost_percent);
  const opexHealth = getHealthStatus(opexPctSales, alertThresholds.opex_percent);

  // Donut data
  const donutData = useMemo(() => {
    const d = [];
    if (totalFoodCost > 0) d.push({ name: 'Food Cost', value: totalFoodCost, color: FAMILY_COLORS.foodCost.fill, icon: Utensils, percentage: grandTotal > 0 ? (totalFoodCost / grandTotal) * 100 : 0 });
    if (totalPayroll > 0) d.push({ name: 'Costo Personal', value: totalPayroll, color: FAMILY_COLORS.payroll.fill, icon: Users, percentage: grandTotal > 0 ? (totalPayroll / grandTotal) * 100 : 0 });
    if (totalOpexOnly > 0) d.push({ name: 'OPEX', value: totalOpexOnly, color: FAMILY_COLORS.opex.fill, icon: Receipt, percentage: grandTotal > 0 ? (totalOpexOnly / grandTotal) * 100 : 0 });
    return d;
  }, [totalFoodCost, totalPayroll, totalOpexOnly, grandTotal]);

  // Separate data for each family from allData
  const allFoodCostData = useMemo(() => (allSupplyCosts.length > 0 ? allSupplyCosts : supplyCosts), [allSupplyCosts, supplyCosts]);
  const allPayrollData = useMemo(() => {
    const src = allOpex.length > 0 ? allOpex : opex;
    return src.filter(o => o.type === 'payroll' || (o.cost_center_name || '').toLowerCase().includes('payroll'));
  }, [allOpex, opex]);
  const allOpexOnlyData = useMemo(() => {
    const src = allOpex.length > 0 ? allOpex : opex;
    return src.filter(o => o.type !== 'payroll' && !(o.cost_center_name || '').toLowerCase().includes('payroll'));
  }, [allOpex, opex]);

  if (donutData.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-slate-100 border-0 shadow-lg">
        <CardContent className="py-16 text-center">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">Sin datos de costos</h3>
          <p className="text-gray-500">No hay compras o gastos registrados para este período</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards — % sobre ventas + semáforo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <SummaryCard 
          icon={Utensils} 
          label="FOOD COST" 
          sublabel="Costo de Ventas" 
          pct={foodCostPctSales} 
          gradient={foodCostHealth.color ? HEALTH_GRADIENTS[foodCostHealth.color].gradient : 'from-orange-500 via-orange-600 to-amber-600'} 
          textColor={foodCostHealth.color ? HEALTH_GRADIENTS[foodCostHealth.color].textColor : 'text-orange-100'} 
          delay={0.1} 
          healthLabel={foodCostHealth.color ? HEALTH_GRADIENTS[foodCostHealth.color].label : null}
          healthIcon={foodCostHealth.color ? HEALTH_GRADIENTS[foodCostHealth.color].icon : null}
          showInfoTip
          infoTipText="% sobre ventas netas. Los umbrales se configuran en Centro de Alertas → ⚙️ Food Cost."
        />
        <SummaryCard 
          icon={Users} 
          label="COSTO PERSONAL" 
          sublabel="Payroll" 
          pct={payrollPctSales} 
          gradient={payrollHealth.color ? HEALTH_GRADIENTS[payrollHealth.color].gradient : 'from-indigo-500 via-indigo-600 to-purple-600'} 
          textColor={payrollHealth.color ? HEALTH_GRADIENTS[payrollHealth.color].textColor : 'text-indigo-100'} 
          delay={0.15} 
          healthLabel={payrollHealth.color ? HEALTH_GRADIENTS[payrollHealth.color].label : null}
          healthIcon={payrollHealth.color ? HEALTH_GRADIENTS[payrollHealth.color].icon : null}
          showInfoTip
          infoTipText="% sobre ventas netas. Los umbrales se configuran en Centro de Alertas → ⚙️ Costo Personal."
        />
        <SummaryCard 
          icon={Receipt} 
          label="OPEX" 
          sublabel="Gastos Operativos" 
          pct={opexPctSales} 
          gradient={opexHealth.color ? HEALTH_GRADIENTS[opexHealth.color].gradient : 'from-blue-500 via-blue-600 to-cyan-600'} 
          textColor={opexHealth.color ? HEALTH_GRADIENTS[opexHealth.color].textColor : 'text-blue-100'} 
          delay={0.2} 
          healthLabel={opexHealth.color ? HEALTH_GRADIENTS[opexHealth.color].label : null}
          healthIcon={opexHealth.color ? HEALTH_GRADIENTS[opexHealth.color].icon : null}
          showInfoTip
          infoTipText="% sobre ventas netas. Los umbrales se configuran en Centro de Alertas → ⚙️ OPEX."
        />
      </div>

      {/* Donut Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-white border-0 shadow-xl overflow-hidden rounded-2xl">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
              {/* Donut - compact */}
              <div className="lg:col-span-2 h-72 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={115}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={10}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} className="drop-shadow-sm hover:opacity-90 transition-opacity duration-300" />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<DonutTooltip currency={currency} />} wrapperStyle={{ zIndex: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-0.5">Gastos</span>
                  <span className="text-xl font-extrabold tracking-tighter text-slate-800 drop-shadow-sm">
                    {formatCurrency(grandTotal, currency, { compact: true })}
                  </span>
                </div>
              </div>

              {/* Legend bars */}
              <div className="lg:col-span-3 space-y-6 lg:pl-4 lg:border-l lg:border-slate-50">
                {donutData.map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.08 }}
                      className="group"
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105" style={{ backgroundColor: item.color }}>
                          <ItemIcon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-slate-700 text-[15px]">{item.name}</span>
                            <span className="text-xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(item.value, currency, { compact: true })}</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${item.percentage}%` }}
                              transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Food Cost Breakdown - solo en vista anual */}
      {viewMode === 'annual' && (
        <ExpenseFamilySection
          title="Desglose Food Cost"
          icon={Utensils}
          color="from-orange-500 to-amber-600"
          gradientFrom="from-orange-50"
          gradientTo="to-amber-50"
          allData={allFoodCostData}
          allSales={allSales}
          currency={currency}
          getCategoryFn={(r) => r.supply_category || 'Sin categoría'}
          getItemFn={(r) => r.supply_item_name || r.notes || 'Sin especificar'}
          getAmountFn={(r) => r.total_cost || r.subtotal || 0}
          getDateFn={(r) => r.date}
          viewMode={viewMode}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, sublabel, pct, gradient, textColor, delay, extra, healthLabel, healthIcon: HealthIcon, pctLabel, showInfoTip, infoTipText }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className={`bg-gradient-to-br ${gradient} border-0 shadow-2xl text-white overflow-hidden relative h-full`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <span className={`${textColor} text-xs font-medium uppercase tracking-wider`}>{label}</span>
                <p className="text-white/80 text-[10px]">{sublabel}</p>
              </div>
            </div>
            {showInfoTip && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-7 h-7 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center cursor-help transition-colors">
                      <HelpCircle className="w-4 h-4 text-white/90" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px] bg-slate-900 text-white border-slate-700 p-3">
                    <p className="text-xs leading-relaxed">{infoTipText || 'Los umbrales de colores se configuran desde el Centro de Alertas.'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-3xl font-bold">{pct.toFixed(1)}%</p>
          {pctLabel && <p className="text-white/60 text-[10px] mt-1">{pctLabel}</p>}
          {healthLabel && HealthIcon && (
            <div className="flex items-center gap-1.5 mt-2">
              <HealthIcon className="w-3.5 h-3.5 text-white/90" />
              <span className="text-white/90 text-xs font-semibold">{healthLabel}</span>
            </div>
          )}
          {extra && <p className="text-gray-400 text-xs mt-2">{extra}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}