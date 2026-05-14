import React, { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from '@/components/utils/currencyHelper';
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, XCircle, Calendar } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

// Genera los últimos N meses como opciones
function getMonthOptions(count = 12) {
  const now = new Date();
  const options = [];
  for (let i = 0; i < count; i++) {
    const d = subMonths(now, i);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: es }),
      from: startOfMonth(d),
      to: endOfMonth(d)
    });
  }
  return options;
}

function StatusIndicator({ actual, ideal, isLowerBetter = false }) {
  if (!ideal || ideal === 0) return <span className="text-gray-300">—</span>;
  
  const diff = actual - ideal;
  const percentDiff = (diff / Math.abs(ideal)) * 100;
  
  let status;
  if (isLowerBetter) {
    status = actual <= ideal ? 'good' : percentDiff <= 10 ? 'warning' : 'bad';
  } else {
    status = actual >= ideal ? 'good' : percentDiff >= -10 ? 'warning' : 'bad';
  }

  const config = {
    good: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
    bad: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' }
  };

  const Icon = config[status].icon;
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config[status].bg}`}>
      <Icon className={`w-3.5 h-3.5 ${config[status].color}`} />
    </div>
  );
}

function DiffBadge({ actualPercent, idealPercent, isLowerBetter = false }) {
  if (idealPercent == null || idealPercent === 0) return <span className="text-gray-300">—</span>;
  
  const diff = actualPercent - idealPercent;
  
  let color;
  if (isLowerBetter) {
    color = diff <= -0.5 ? 'text-emerald-600' : diff >= 0.5 ? 'text-red-600' : 'text-gray-500';
  } else {
    color = diff >= 0.5 ? 'text-emerald-600' : diff <= -0.5 ? 'text-red-600' : 'text-gray-500';
  }

  return (
    <span className={`font-mono text-sm font-semibold ${color}`}>
      {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
    </span>
  );
}

export default function ProformaFinanciera({
  proforma,
  currency = 'CLP',
  // Funciones para obtener datos de un mes específico
  getMonthData, // (from, to) => { totalIncome, totalSupplyCost, totalOpex, costByCenter }
  // Mes actualmente seleccionado en el dashboard
  currentDateRange,
  dashboardViewMode = 'monthly',
  allSales = [],
  allSupplyCosts = [],
  allOpex = [],
  restaurant,
}) {
  const isAnnual = dashboardViewMode === 'annual';
  const monthOptions = useMemo(() => getMonthOptions(12), []);
  
  // Mes 1 (principal) - inicializar con el mes del dashboard
  const currentMonthKey = currentDateRange ? format(currentDateRange.from, 'yyyy-MM') : monthOptions[0]?.value;
  const [month1, setMonth1] = useState(currentMonthKey);
  const [month2, setMonth2] = useState(''); // Segundo mes vacío = no comparar
  const [month3, setMonth3] = useState(''); // Tercer mes vacío = no comparar

  // Year options for annual mode
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2].map(y => ({
      value: String(y),
      label: String(y),
      from: startOfYear(new Date(y, 0, 1)),
      to: endOfYear(new Date(y, 0, 1))
    }));
  }, []);

  const currentYearKey = currentDateRange ? format(currentDateRange.from, 'yyyy') : yearOptions[0]?.value;
  const [year1, setYear1] = useState(currentYearKey);

  // Obtener datos de cada mes
  const month1Option = monthOptions.find(m => m.value === month1);
  const month2Option = monthOptions.find(m => m.value === month2);

  const data1 = useMemo(() => {
    if (isAnnual) return null; // handled separately
    if (!month1Option || !getMonthData) return null;
    return getMonthData(month1Option.from, month1Option.to);
  }, [month1, getMonthData, month1Option, isAnnual]);

  const data2 = useMemo(() => {
    if (isAnnual) return null;
    if (!month2Option || !getMonthData) return null;
    return getMonthData(month2Option.from, month2Option.to);
  }, [month2, getMonthData, month2Option, isAnnual]);

  const month3Option = monthOptions.find(m => m.value === month3);
  const data3 = useMemo(() => {
    if (isAnnual) return null;
    if (!month3Option || !getMonthData) return null;
    return getMonthData(month3Option.from, month3Option.to);
  }, [month3, getMonthData, month3Option, isAnnual]);

  // Annual data
  const annualData = useMemo(() => {
    if (!isAnnual || !getMonthData) return null;
    const yearOpt = yearOptions.find(y => y.value === year1);
    if (!yearOpt) return null;
    return getMonthData(yearOpt.from, yearOpt.to);
  }, [isAnnual, year1, yearOptions, getMonthData]);

  const showMonth2 = !isAnnual && !!month2 && month2 !== '' && month2 !== 'none';
  const showMonth3 = !isAnnual && !!month3 && month3 !== '' && month3 !== 'none';

  if (!proforma || !proforma.monthly_income) {
    return (
      <Card className="p-8 text-center border-0 shadow-lg bg-gradient-to-br from-gray-50 to-white">
        <div className="text-gray-400 mb-2">📊</div>
        <p className="text-gray-500 font-medium">No hay proforma configurada</p>
        <p className="text-sm text-gray-400 mt-1">Configura tu proforma financiera para comparar con tus resultados reales.</p>
      </Card>
    );
  }

  // Calcular ideal (multiplicar por 12 si es anual)
  const multiplier = isAnnual ? 12 : 1;
  const idealIncome = proforma.monthly_income * multiplier;
  const idealFoodCostPercent = proforma.direct_cost_percent || 40;
  const idealFoodCost = (idealFoodCostPercent / 100) * idealIncome;
  const idealGrossMargin = idealIncome - idealFoodCost;
  const idealGrossMarginPercent = 100 - idealFoodCostPercent;
  const costCentersBudgetRaw = proforma.cost_centers_budget || [];
  // Scale amounts by multiplier, keep percents the same
  const costCentersBudget = costCentersBudgetRaw.map(c => ({
    ...c,
    amount: (c.amount || 0) * multiplier
  }));
  const idealTotalOpex = costCentersBudget.reduce((sum, c) => sum + (c.amount || 0), 0);
  const idealTotalOpexPercent = costCentersBudgetRaw.reduce((sum, c) => sum + (c.percent || 0), 0);
  const idealTotalCosts = idealFoodCost + idealTotalOpex;
  const idealEbitda = idealIncome - idealTotalCosts;
  const idealEbitdaPercent = idealIncome > 0 ? (idealEbitda / idealIncome) * 100 : 0;

  // Helper para calcular métricas de un mes
  const calcMonthMetrics = (monthData) => {
    if (!monthData) return null;
    const income = monthData.totalIncome || 0;
    const supply = monthData.totalSupplyCost || 0;
    const opexTotal = monthData.totalOpex || 0;
    const grossMargin = income - supply;
    const ebitda = income - supply - opexTotal;
    
    return {
      income,
      supply,
      supplyPercent: income > 0 ? (supply / income) * 100 : 0,
      grossMargin,
      grossMarginPercent: income > 0 ? (grossMargin / income) * 100 : 0,
      opex: opexTotal,
      opexPercent: income > 0 ? (opexTotal / income) * 100 : 0,
      totalCosts: supply + opexTotal,
      totalCostsPercent: income > 0 ? ((supply + opexTotal) / income) * 100 : 0,
      ebitda,
      ebitdaPercent: income > 0 ? (ebitda / income) * 100 : 0,
      costByCenter: monthData.costByCenter || {}
    };
  };

  const m1 = isAnnual ? calcMonthMetrics(annualData) : calcMonthMetrics(data1);
  const m2 = isAnnual ? null : calcMonthMetrics(data2);
  const m3 = isAnnual ? null : calcMonthMetrics(data3);

  // Columnas
  const colSpanTotal = showMonth3 ? 14 : showMonth2 ? 11 : 6;

  const MonthCell = ({ value, percent, isPositive, isBold = false }) => (
    <>
      <td className={`py-3 px-3 text-right font-mono text-sm ${isBold ? 'font-bold' : ''} ${isPositive === true ? 'text-emerald-700' : isPositive === false ? 'text-red-600' : 'text-gray-800'}`}>
        {value != null ? formatCurrency(value, currency) : '—'}
      </td>
      <td className={`py-3 px-3 text-right font-mono text-sm ${isBold ? 'font-bold' : ''} ${isPositive === true ? 'text-emerald-700' : isPositive === false ? 'text-red-600' : 'text-gray-600'}`}>
        {percent != null ? `${percent.toFixed(1)}%` : '—'}
      </td>
    </>
  );

  const IdealCell = ({ amount, percent, isBold = false }) => (
    <>
      <td className={`py-3 px-3 text-right font-mono text-sm bg-slate-50/80 ${isBold ? 'font-bold' : ''} text-gray-700`}>
        {formatCurrency(amount, currency)}
      </td>
      <td className={`py-3 px-3 text-right font-mono text-sm bg-slate-50/80 ${isBold ? 'font-bold' : ''} text-gray-600`}>
        {percent.toFixed(1)}%
      </td>
    </>
  );

  const DiffCell = ({ actualPercent, idealPercent, isLowerBetter = false }) => (
    <td className="py-3 px-3 text-center">
      <DiffBadge actualPercent={actualPercent} idealPercent={idealPercent} isLowerBetter={isLowerBetter} />
    </td>
  );

  // Fila de sección
  const SectionHeader = ({ label, emoji, bgColor }) => (
    <tr>
      <td colSpan={colSpanTotal} className={`py-2.5 px-4 font-semibold text-sm text-white ${bgColor}`}>
        <span className="mr-1.5">{emoji}</span> {label}
      </td>
    </tr>
  );

  // Fila de datos
  const DataRow = ({ label, idealAmount, idealPercent, m1Amount, m1Percent, m2Amount, m2Percent, m3Amount, m3Percent, isLowerBetter = false, isBold = false, bgClass = '' }) => {
    const m1Positive = isLowerBetter 
      ? (m1Percent != null && idealPercent != null ? m1Percent <= idealPercent : null)
      : (m1Amount != null && idealAmount != null ? m1Amount >= idealAmount : null);
    const m2Positive = isLowerBetter 
      ? (m2Percent != null && idealPercent != null ? m2Percent <= idealPercent : null)
      : (m2Amount != null && idealAmount != null ? m2Amount >= idealAmount : null);
    const m3Positive = isLowerBetter 
      ? (m3Percent != null && idealPercent != null ? m3Percent <= idealPercent : null)
      : (m3Amount != null && idealAmount != null ? m3Amount >= idealAmount : null);
    
    return (
      <tr className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${bgClass}`}>
        <td className={`py-3 px-4 text-sm ${isBold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
          {label}
        </td>
        <IdealCell amount={idealAmount} percent={idealPercent} isBold={isBold} />
        {m1 && (
          <MonthCell value={m1Amount} percent={m1Percent} isPositive={m1Positive} isBold={isBold} />
        )}
        {m1 && (
          <DiffCell actualPercent={m1Percent} idealPercent={idealPercent} isLowerBetter={isLowerBetter} />
        )}
        {showMonth2 && m2 && (
          <>
            <MonthCell value={m2Amount} percent={m2Percent} isPositive={m2Positive} isBold={isBold} />
            <DiffCell actualPercent={m2Percent} idealPercent={idealPercent} isLowerBetter={isLowerBetter} />
          </>
        )}
        {showMonth2 && !m2 && <td colSpan={3} className="py-3 px-3 text-center text-gray-300">—</td>}
        {showMonth3 && m3 && (
          <>
            <MonthCell value={m3Amount} percent={m3Percent} isPositive={m3Positive} isBold={isBold} />
            <DiffCell actualPercent={m3Percent} idealPercent={idealPercent} isLowerBetter={isLowerBetter} />
          </>
        )}
        {showMonth3 && !m3 && <td colSpan={3} className="py-3 px-3 text-center text-gray-300">—</td>}
      </tr>
    );
  };

  // Fila de resultado con estilo especial
  const ResultRow = ({ label, idealAmount, idealPercent, m1Amount, m1Percent, m2Amount, m2Percent, m3Amount, m3Percent, isPositiveResult = true, icon }) => {
    const isM1Positive = m1Amount != null ? m1Amount >= 0 : null;
    
    const ResultMonthCells = ({ amount, percent }) => {
      const isPos = amount != null ? amount >= 0 : null;
      return (
        <>
          <td className={`py-4 px-3 text-right font-mono font-bold text-base ${isPos !== false ? 'text-emerald-700' : 'text-red-600'}`}>
            {amount != null ? (amount < 0 ? '-' : '') + formatCurrency(Math.abs(amount || 0), currency) : '—'}
          </td>
          <td className={`py-4 px-3 text-right font-mono font-bold text-base ${isPos !== false ? 'text-emerald-700' : 'text-red-600'}`}>
            {percent != null ? `${percent.toFixed(1)}%` : '—'}
          </td>
          <td className="py-4 px-3 text-center">
            <Badge className={`${isPos !== false ? 'bg-emerald-500' : 'bg-red-500'} text-white text-xs`}>
              {percent != null && idealPercent != null ? (
                `${(percent - idealPercent) > 0 ? '+' : ''}${(percent - idealPercent).toFixed(1)}%`
              ) : '—'}
            </Badge>
          </td>
        </>
      );
    };

    return (
      <tr className={`${isM1Positive !== false ? 'bg-emerald-50/70' : 'bg-red-50/70'} border-b-2 border-gray-200`}>
        <td className="py-4 px-4 font-bold text-base text-gray-900 flex items-center gap-2">
          {icon}
          {label}
        </td>
        <td className="py-4 px-3 text-right font-mono font-bold text-base bg-slate-50/80">{formatCurrency(idealAmount, currency)}</td>
        <td className="py-4 px-3 text-right font-mono font-bold text-base bg-slate-50/80">{idealPercent.toFixed(1)}%</td>
        {m1 && <ResultMonthCells amount={m1Amount} percent={m1Percent} />}
        {showMonth2 && m2 && <ResultMonthCells amount={m2Amount} percent={m2Percent} />}
        {showMonth2 && !m2 && <td colSpan={3}></td>}
        {showMonth3 && m3 && <ResultMonthCells amount={m3Amount} percent={m3Percent} />}
        {showMonth3 && !m3 && <td colSpan={3}></td>}
      </tr>
    );
  };

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-white">
      {/* Selector de meses o año */}
      <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
        {isAnnual ? (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Año:</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <Select value={year1} onValueChange={setYear1}>
                <SelectTrigger className="w-36 h-8 text-sm bg-white">
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y.value} value={y.value}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="text-xs text-gray-500">
              Ideal = mensual × 12
            </Badge>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Comparar:</span>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <Select value={month1} onValueChange={setMonth1}>
                  <SelectTrigger className="w-48 h-8 text-sm bg-white">
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m.value} value={m.value} disabled={m.value === month2}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <Select value={month2} onValueChange={(v) => { setMonth2(v); if (v === 'none' || v === '') setMonth3(''); }}>
                  <SelectTrigger className="w-48 h-8 text-sm bg-white">
                    <SelectValue placeholder="+ Agregar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin comparar</SelectItem>
                    {monthOptions.map(m => (
                      <SelectItem key={m.value} value={m.value} disabled={m.value === month1 || m.value === month3}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showMonth2 && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-400 hover:text-red-500" onClick={() => { setMonth2(''); setMonth3(''); }}>
                    ✕
                  </Button>
                )}
              </div>
              {showMonth2 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-teal-500" />
                  <Select value={month3} onValueChange={setMonth3}>
                    <SelectTrigger className="w-48 h-8 text-sm bg-white">
                      <SelectValue placeholder="+ Agregar mes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin comparar</SelectItem>
                      {monthOptions.map(m => (
                        <SelectItem key={m.value} value={m.value} disabled={m.value === month1 || m.value === month2}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showMonth3 && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-400 hover:text-red-500" onClick={() => setMonth3('')}>
                      ✕
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="py-3 px-4 text-left font-bold text-sm tracking-wide">PROFORMA FINANCIERA</th>
              <th colSpan={2} className="py-3 px-3 text-center font-bold text-sm bg-slate-700/50">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  {isAnnual ? 'IDEAL ANUAL' : 'IDEAL'}
                </div>
              </th>
              {m1 && (
                <>
                  <th colSpan={2} className="py-3 px-3 text-center font-bold text-sm bg-blue-900/40">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      {isAnnual 
                        ? `AÑO ${year1}` 
                        : (month1Option?.label?.toUpperCase() || 'MES 1')
                      }
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center font-bold text-sm">DIFF</th>
                </>
              )}
              {showMonth2 && (
                <>
                  <th colSpan={2} className="py-3 px-3 text-center font-bold text-sm bg-purple-900/40">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      {month2Option?.label?.toUpperCase() || 'MES 2'}
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center font-bold text-sm">DIFF</th>
                </>
              )}
              {showMonth3 && (
                <>
                  <th colSpan={2} className="py-3 px-3 text-center font-bold text-sm bg-teal-900/40">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-400" />
                      {month3Option?.label?.toUpperCase() || 'MES 3'}
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center font-bold text-sm">DIFF</th>
                </>
              )}
            </tr>
            <tr className="bg-slate-700 text-slate-300 text-xs">
              <th className="py-2 px-4"></th>
              <th className="py-2 px-3 text-right">Monto</th>
              <th className="py-2 px-3 text-right">%</th>
              {m1 && (
                <>
                  <th className="py-2 px-3 text-right">Monto</th>
                  <th className="py-2 px-3 text-right">%</th>
                  <th className="py-2 px-3 text-center">vs Ideal</th>
                </>
              )}
              {showMonth2 && (
                <>
                  <th className="py-2 px-3 text-right">Monto</th>
                  <th className="py-2 px-3 text-right">%</th>
                  <th className="py-2 px-3 text-center">vs Ideal</th>
                </>
              )}
              {showMonth3 && (
                <>
                  <th className="py-2 px-3 text-right">Monto</th>
                  <th className="py-2 px-3 text-right">%</th>
                  <th className="py-2 px-3 text-center">vs Ideal</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {/* INGRESOS */}
            <SectionHeader label="INGRESOS NETOS" emoji="📈" bgColor="bg-emerald-600" />
            <DataRow
              label="Ingresos Netos"
              idealAmount={idealIncome} idealPercent={100}
              m1Amount={m1?.income} m1Percent={m1 ? 100 : null}
              m2Amount={m2?.income} m2Percent={m2 ? 100 : null}
              m3Amount={m3?.income} m3Percent={m3 ? 100 : null}
              isBold
            />

            {/* FOOD COST */}
            <SectionHeader label="FOOD COST" emoji="🍽️" bgColor="bg-amber-600" />
            <DataRow
              label="Costo de Insumos"
              idealAmount={idealFoodCost} idealPercent={idealFoodCostPercent}
              m1Amount={m1?.supply} m1Percent={m1?.supplyPercent}
              m2Amount={m2?.supply} m2Percent={m2?.supplyPercent}
              m3Amount={m3?.supply} m3Percent={m3?.supplyPercent}
              isLowerBetter
            />

            {/* MARGEN OPERACIONAL */}
            <ResultRow
              label="MARGEN OPERACIONAL"
              idealAmount={idealGrossMargin} idealPercent={idealGrossMarginPercent}
              m1Amount={m1?.grossMargin} m1Percent={m1?.grossMarginPercent}
              m2Amount={m2?.grossMargin} m2Percent={m2?.grossMarginPercent}
              m3Amount={m3?.grossMargin} m3Percent={m3?.grossMarginPercent}
              icon={<TrendingUp className="w-4 h-4 text-teal-600" />}
            />

            {/* CENTROS DE COSTO */}
            <SectionHeader label="CENTROS DE COSTO (OPEX)" emoji="📊" bgColor="bg-blue-600" />
            
            {costCentersBudget.map((center, idx) => {
              const key = center.name.toUpperCase();
              const m1Center = m1?.costByCenter?.[key] || { total: 0, percent: 0 };
              const m2Center = m2?.costByCenter?.[key] || { total: 0, percent: 0 };
              const m3Center = m3?.costByCenter?.[key] || { total: 0, percent: 0 };
              const m1CenterPercent = m1?.income > 0 ? (m1Center.total / m1.income) * 100 : 0;
              const m2CenterPercent = m2?.income > 0 ? (m2Center.total / m2.income) * 100 : 0;
              const m3CenterPercent = m3?.income > 0 ? (m3Center.total / m3.income) * 100 : 0;

              return (
                <DataRow
                  key={idx}
                  label={center.name}
                  idealAmount={center.amount || 0}
                  idealPercent={center.percent || 0}
                  m1Amount={m1 ? m1Center.total : null}
                  m1Percent={m1 ? m1CenterPercent : null}
                  m2Amount={m2 ? m2Center.total : null}
                  m2Percent={m2 ? m2CenterPercent : null}
                  m3Amount={m3 ? m3Center.total : null}
                  m3Percent={m3 ? m3CenterPercent : null}
                  isLowerBetter
                />
              );
            })}

            {/* TOTAL COSTOS OPERACIÓN */}
            <tr className="bg-slate-100 border-b border-gray-300">
              <td className="py-3 px-4 font-bold text-sm text-gray-800">COSTOS DE OPERACIÓN</td>
              <IdealCell amount={idealTotalCosts} percent={idealFoodCostPercent + idealTotalOpexPercent} isBold />
              {m1 && (
                <>
                  <MonthCell value={m1?.totalCosts} percent={m1?.totalCostsPercent} isBold />
                  <DiffCell actualPercent={m1?.totalCostsPercent} idealPercent={idealFoodCostPercent + idealTotalOpexPercent} isLowerBetter />
                </>
              )}
              {showMonth2 && m2 && (
                <>
                  <MonthCell value={m2?.totalCosts} percent={m2?.totalCostsPercent} isBold />
                  <DiffCell actualPercent={m2?.totalCostsPercent} idealPercent={idealFoodCostPercent + idealTotalOpexPercent} isLowerBetter />
                </>
              )}
              {showMonth2 && !m2 && <td colSpan={3}></td>}
              {showMonth3 && m3 && (
                <>
                  <MonthCell value={m3?.totalCosts} percent={m3?.totalCostsPercent} isBold />
                  <DiffCell actualPercent={m3?.totalCostsPercent} idealPercent={idealFoodCostPercent + idealTotalOpexPercent} isLowerBetter />
                </>
              )}
              {showMonth3 && !m3 && <td colSpan={3}></td>}
            </tr>

            {/* EBITDA */}
            <ResultRow
              label="EBITDA"
              idealAmount={idealEbitda} idealPercent={idealEbitdaPercent}
              m1Amount={m1?.ebitda} m1Percent={m1?.ebitdaPercent}
              m2Amount={m2?.ebitda} m2Percent={m2?.ebitdaPercent}
              m3Amount={m3?.ebitda} m3Percent={m3?.ebitdaPercent}
              icon={m1?.ebitda >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
            />
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      {!m1 && (
        <div className="p-4 bg-gray-50 text-center text-sm text-gray-400">
          Selecciona un mes para comparar contra la proforma ideal
        </div>
      )}
    </Card>
  );
}