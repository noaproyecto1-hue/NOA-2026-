import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronRight, Search, X, Palette, Loader2, Building2
} from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from '@/components/utils/currencyHelper';
import { motion, AnimatePresence } from 'framer-motion';

// Modal de detalle al pinchar un ítem (insumo o gasto): muestra proveedores,
// facturas y todo el detalle desde SupplyCost (insumos) u OpEx (costos).
function ItemDetailModal({ item, currency, onClose }) {
  const { kind, name } = item;
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['item-detail', kind, name],
    queryFn: async () => {
      if (kind === 'opex') {
        const all = await base44.entities.OpEx.list();
        return (all || []).filter((o) => {
          const n = o.description || o.category || o.type || '';
          const c = o.cost_center_name || '';
          return n.toLowerCase() === name.toLowerCase() || c.toLowerCase() === name.toLowerCase() || (o.type || '').toLowerCase() === name.toLowerCase();
        });
      }
      const all = await base44.entities.SupplyCost.list();
      return (all || []).filter((c) => {
        const n = c.supply_item_name || c.supply_name || '';
        const cat = c.supply_category || '';
        return n.toLowerCase() === name.toLowerCase() || cat.toLowerCase() === name.toLowerCase();
      });
    },
    enabled: !!name,
    staleTime: 60 * 1000,
  });

  const fdate = (v) => { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString('es-CL'); };
  const total = rows.reduce((s, r) => s + (Number(r.total_cost) || Number(r.amount) || 0), 0);
  const proveedores = [...new Set(rows.map((r) => r.supplier).filter(Boolean))];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl font-sans">
        <DialogHeader><DialogTitle className="font-display text-noa-navy flex items-center gap-2"><Building2 className="w-5 h-5 text-noa-orange" /> {name}</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-500 py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Cargando detalle…</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No hay facturas/gastos registrados para "{name}".</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="rounded-lg border p-3"><p className="text-xs text-gray-500">Documentos</p><p className="text-lg font-bold text-noa-navy">{rows.length}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-gray-500">Proveedores</p><p className="text-lg font-bold text-noa-navy">{proveedores.length || '—'}</p></div>
              <div className="rounded-lg border p-3 bg-noa-orange/5"><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold text-noa-navy">{formatCurrency(total, currency)}</p></div>
            </div>
            <div className="max-h-80 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0"><tr className="text-left text-xs text-gray-500">
                  <th className="py-2 px-3">Fecha</th><th className="py-2 px-3">Proveedor</th><th className="py-2 px-3">Folio</th>
                  <th className="py-2 px-3 text-right">Cantidad</th><th className="py-2 px-3 text-right">Monto</th>
                </tr></thead>
                <tbody className="divide-y">
                  {rows.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-xs">{fdate(r.date)}</td>
                      <td className="py-2 px-3 text-xs">{r.supplier || (kind === 'opex' ? (r.cost_center_name || '—') : '—')}</td>
                      <td className="py-2 px-3 text-xs">{r.invoice_number || '—'}</td>
                      <td className="py-2 px-3 text-xs text-right">{r.quantity_purchased ? `${r.quantity_purchased} ${r.unit_of_measure || ''}` : '—'}</td>
                      <td className="py-2 px-3 text-xs text-right font-semibold">{formatCurrency(Number(r.total_cost) || Number(r.amount) || 0, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Badge de comparación trimestral ───
function ComparisonBadge({ current, comparison, isCost = false }) {
  if (comparison == null) return null;
  const diff = current - comparison;
  const isGood = isCost ? diff < -0.5 : diff > 0.5;
  const isBad = isCost ? diff > 0.5 : diff < -0.5;
  
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
      isGood ? 'bg-emerald-100 text-emerald-700' : isBad ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {diff > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : diff < 0 ? <ArrowDownRight className="w-2.5 h-2.5" /> : null}
      {comparison.toFixed(1)}%
    </span>
  );
}

// ─── Sección colapsable principal (Ingresos, Food Cost, OPEX) ───
function Section({ title, emoji, bgColor, cleanBgClass, cleanBorderColor, children, totalAmount, totalPercent, comparisonPercent, showComparison, currency, defaultOpen = false, forceOpen = false, isClean = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen || open;
  
  return (
    <div className={`rounded-xl overflow-hidden ${isClean ? 'shadow-sm border border-gray-200' : 'shadow-sm'}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full grid grid-cols-[1fr_auto] items-center px-4 sm:px-5 py-3 transition-all ${
          isClean 
            ? `${cleanBgClass || 'bg-gradient-to-r from-blue-50/60 to-indigo-50/60'} border-l-4 ${cleanBorderColor || 'border-blue-400'} hover:brightness-95` 
            : `${bgColor} hover:brightness-95`
        }`}
      >
        {/* Izquierda: icono + título + chevron */}
        <div className="flex items-center gap-2">
          <span className="text-base flex-shrink-0">{emoji}</span>
          <span className={`font-bold text-xs sm:text-sm tracking-wide uppercase truncate ${isClean ? 'text-gray-800' : 'text-white'}`}>{title}</span>
          <span className={`flex-shrink-0 ml-1 ${isClean ? 'text-gray-400' : 'text-white/60'}`}>
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        </div>
        {/* Derecha: métricas alineadas */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span className={`font-mono font-bold text-xs sm:text-sm w-24 text-right ${isClean ? 'text-gray-900' : 'text-white'}`}>{formatCurrency(totalAmount, currency)}</span>
          <span className={`text-xs font-mono w-14 text-right hidden sm:block ${isClean ? 'text-gray-500' : 'text-white/70'}`}>{totalPercent.toFixed(1)}%</span>
          <div className="w-16 sm:w-20 flex justify-center">
            {showComparison && comparisonPercent != null ? (
              <ComparisonBadge current={totalPercent} comparison={comparisonPercent} isCost={true} />
            ) : <span className={`text-xs ${isClean ? 'text-gray-300' : 'text-white/40'}`}>—</span>}
          </div>
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white divide-y divide-gray-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Fila colapsable de 2do nivel (categoría de insumo, o centro OPEX) ───
function SubRow({ name, amount, percent, comparisonPercent, showComparison, currency, children, hasChildren = false, proformaPercent, dotColor = 'bg-gray-400', forceOpen = false }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const overBudget = proformaPercent != null && percent > proformaPercent;

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 sm:px-5 py-2.5 hover:bg-gray-50 transition-colors ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {hasChildren ? (
            <span className="text-gray-400 flex-shrink-0">
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          ) : (
            <span className="w-3.5 flex-shrink-0" />
          )}
          <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
          <span className="text-sm text-gray-800 font-semibold truncate">{name}</span>
          {proformaPercent != null && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-tight ${overBudget ? 'border-red-300 text-red-600 bg-red-50' : 'border-emerald-300 text-emerald-600 bg-emerald-50'}`}>
              ideal {proformaPercent.toFixed(1)}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
          <span className="font-mono text-sm font-medium text-gray-900 w-20 sm:w-24 text-right">{formatCurrency(amount, currency)}</span>
          <span className={`font-mono text-sm w-14 text-right hidden sm:block ${overBudget ? 'text-red-600 font-bold' : 'text-gray-500'}`}>{percent.toFixed(1)}%</span>
          <div className="w-16 sm:w-20 flex justify-center">
            {showComparison ? (
              <ComparisonBadge current={percent} comparison={comparisonPercent} isCost={true} />
            ) : <span className="text-gray-300 text-xs">—</span>}
          </div>
        </div>
      </button>
      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50/60 border-t border-gray-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Fila de ítem (nivel más bajo, dentro de categoría) ───
function ItemRow({ name, amount, percent, currency, indent = 8, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center justify-between px-4 sm:px-5 py-2 transition-colors ${onClick ? 'hover:bg-noa-orange/10 cursor-pointer' : 'hover:bg-white/80 cursor-default'}`}
    >
      <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: `${indent * 4}px` }}>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
        <span className={`text-xs truncate ${onClick ? 'text-noa-orange-dk hover:underline' : 'text-gray-600'}`}>{name}</span>
        {onClick && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
      </div>
      <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
        <span className="font-mono text-xs text-gray-600 w-20 sm:w-24 text-right">{formatCurrency(amount, currency)}</span>
        <span className="font-mono text-xs text-gray-400 w-14 text-right hidden sm:block">{percent.toFixed(1)}%</span>
        <div className="w-16 sm:w-20" />
      </div>
    </button>
  );
}

// ─── Fila colapsable de 3er nivel (categoría dentro de centro OPEX) ───
function CategoryRow({ name, amount, percent, currency, children, hasChildren = false, dotColor = 'bg-gray-400', forceOpen = false }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 sm:px-5 py-2 hover:bg-gray-50/80 transition-colors ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2 min-w-0 pl-8">
          {hasChildren ? (
            <span className="text-gray-400 flex-shrink-0">
              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : (
            <span className="w-3 flex-shrink-0" />
          )}
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
          <span className="text-xs text-gray-700 font-medium truncate">{name}</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
          <span className="font-mono text-xs text-gray-700 w-20 sm:w-24 text-right">{formatCurrency(amount, currency)}</span>
          <span className="font-mono text-xs text-gray-400 w-14 text-right hidden sm:block">{percent.toFixed(1)}%</span>
          <div className="w-16 sm:w-20" />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Fila de ingreso ───
function IncomeRow({ name, amount, percent, currency }) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0 pl-6">
        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        <span className="text-sm text-gray-800 font-medium truncate">{name}</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
        <span className="font-mono text-sm font-medium text-gray-900 w-20 sm:w-24 text-right">{formatCurrency(amount, currency)}</span>
        <span className="font-mono text-sm text-gray-500 w-14 text-right hidden sm:block">{percent.toFixed(1)}%</span>
        <div className="w-16 sm:w-20" />
      </div>
    </div>
  );
}

// ─── Línea de resultado (Margen, EBITDA, Total) ───
function ResultLine({ label, icon, amount, percent, currency, isPositive, comparisonPercent, showComparison, variant = 'result', isClean = false, cleanBgClass }) {
  const styles = isClean
    ? `${cleanBgClass ? cleanBgClass : variant === 'total' ? 'bg-amber-50/70 border border-amber-200' : isPositive ? 'bg-emerald-50/80 border border-emerald-200' : 'bg-red-50/80 border border-red-200'}`
    : variant === 'total' 
      ? 'bg-slate-100 border border-slate-200'
      : isPositive 
        ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200'
        : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200';
  
  const textColor = variant === 'total' 
    ? (isClean && cleanBgClass?.includes('slate-700') ? 'text-white' : isClean && cleanBgClass ? 'text-amber-900' : 'text-gray-900')
    : isPositive ? 'text-emerald-700' : 'text-red-700';

  return (
    <div className={`rounded-xl px-4 sm:px-5 py-3.5 flex items-center justify-between ${styles}`}>
      <div className="flex items-center gap-2.5">
        {icon}
        <span className={`font-bold text-sm ${variant === 'total' ? (isClean && cleanBgClass?.includes('slate-700') ? 'text-white' : isClean && cleanBgClass ? 'text-amber-800' : 'text-gray-800') : isPositive ? 'text-emerald-800' : 'text-red-800'}`}>{label}</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-5">
        <span className={`font-mono font-bold text-sm sm:text-base ${textColor}`}>
          {amount < 0 ? '-' : ''}{formatCurrency(Math.abs(amount), currency)}
        </span>
        <span className={`font-mono font-bold text-sm ${textColor} hidden sm:block`}>
          {percent.toFixed(1)}%
        </span>
        <div className="w-16 sm:w-20 flex justify-center">
          {showComparison && comparisonPercent != null ? (
            <ComparisonBadge current={percent} comparison={comparisonPercent} isCost={variant === 'total'} />
          ) : <span className="text-gray-300 text-xs">—</span>}
        </div>
      </div>
    </div>
  );
}

// ═══════════ COMPONENTE PRINCIPAL ═══════════
export default function IncomeStatementView({
  incomeAnalysis,
  totalIncome,
  prevTotalIncome,
  foodCostAnalysis,
  opexAnalysis,
  operationalMargin,
  operationalMarginPercent,
  totalCosts,
  totalCostPercent,
  grossProfit,
  grossMargin,
  prevGrossMargin,
  quarterAnalysis,
  showComparisonCol,
  dashboardViewMode,
  currency,
  proforma,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [detail, setDetail] = useState(null); // { kind:'supply'|'opex', name }
  const [isClean, setIsClean] = useState(false);
  const normalizedSearch = searchTerm.toLowerCase().trim();
  const isSearching = normalizedSearch.length > 0;

  // Flatten food cost: merge all centers' categories into one flat list of categories
  const flatFoodCategories = useMemo(() => {
    const merged = {};
    Object.entries(foodCostAnalysis).forEach(([centerName, centerData]) => {
      Object.entries(centerData.categories || {}).forEach(([catName, catData]) => {
        if (!merged[catName]) merged[catName] = { total: 0, items: {} };
        merged[catName].total += catData.total || 0;
        Object.entries(catData.items || {}).forEach(([itemName, itemData]) => {
          if (!merged[catName].items[itemName]) merged[catName].items[itemName] = { total: 0 };
          merged[catName].items[itemName].total += itemData.total || 0;
        });
      });
    });
    return merged;
  }, [foodCostAnalysis]);

  const totalFoodCost = Object.values(foodCostAnalysis).reduce((s, c) => s + c.total, 0);
  const totalFoodCostPercent = totalIncome > 0 ? (totalFoodCost / totalIncome) * 100 : 0;
  const totalOpex = Object.values(opexAnalysis).reduce((s, c) => s + c.total, 0);
  const totalOpexPercent = totalIncome > 0 ? (totalOpex / totalIncome) * 100 : 0;

  // Proforma for food cost
  const foodCostProformaPercent = proforma?.direct_cost_percent;

  return (
    <>
    {detail && <ItemDetailModal item={detail} currency={currency} onClose={() => setDetail(null)} />}
    <Card className={`border-0 shadow-xl overflow-hidden rounded-2xl ${isClean ? 'bg-slate-50/80' : 'bg-white'}`}>
      {/* Header */}
      <div className={`px-4 sm:px-6 py-4 ${isClean ? 'bg-gradient-to-r from-slate-100 to-gray-100 border-b border-slate-200' : 'bg-gradient-to-r from-slate-800 to-slate-900'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full">
            <div /> {/* spacer */}
            <h3 className={`font-bold text-sm tracking-widest uppercase ${isClean ? 'text-slate-700' : 'text-white'}`}>Estado de Resultados</h3>
            {/* Style switch */}
            <div className="flex items-center gap-2">
              <Palette className={`w-3.5 h-3.5 ${isClean ? 'text-slate-400' : 'text-slate-400'}`} />
              <Switch
                checked={!isClean}
                onCheckedChange={(checked) => setIsClean(!checked)}
                className="scale-75"
              />
            </div>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isClean ? 'text-slate-400' : 'text-slate-400'}`} />
            <Input
              placeholder="Buscar categoría o ítem..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`pl-9 pr-8 h-9 text-sm rounded-xl ${
                isClean 
                  ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 shadow-sm' 
                  : 'bg-slate-700/80 border-slate-600 text-white placeholder:text-slate-400 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${isClean ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className={`flex items-center justify-end gap-3 sm:gap-5 px-4 sm:px-5 py-2 border-b text-[10px] font-bold uppercase tracking-widest ${isClean ? 'bg-slate-100/60 border-slate-200 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
        <div className="w-20 sm:w-24 text-right">Monto</div>
        <div className="w-14 text-right hidden sm:block">% Venta</div>
        <div className="w-16 sm:w-20 text-center">{showComparisonCol ? (dashboardViewMode === 'annual' ? 'Año Ant.' : 'Prom. Trim.') : ''}</div>
      </div>

      <div className="p-3 sm:p-4 space-y-2">
        {/* ══════ INGRESOS NETOS ══════ */}
        <Section
          title="Ingresos Netos"
          emoji="📈"
          bgColor="bg-emerald-600"
          cleanBgClass="bg-gradient-to-r from-emerald-50/70 to-teal-50/50"
          cleanBorderColor="border-emerald-400"
          isClean={isClean}
          totalAmount={totalIncome}
          totalPercent={100}
          comparisonPercent={showComparisonCol ? 100 : null}
          showComparison={showComparisonCol}
          currency={currency}
          defaultOpen={true}
          forceOpen={isSearching}
        >
          {Object.entries(incomeAnalysis.lines || {})
            .filter(([name, data]) => {
              if (!isSearching) return true;
              if (name.toLowerCase().includes(normalizedSearch)) return true;
              return Object.keys(data.subLines || {}).some(s => s.toLowerCase().includes(normalizedSearch));
            })
            .sort((a, b) => b[1].total - a[1].total)
            .map(([name, data]) => {
              const subLines = Object.entries(data.subLines || {})
                .filter(([s]) => !isSearching || s.toLowerCase().includes(normalizedSearch) || name.toLowerCase().includes(normalizedSearch))
                .sort((a, b) => b[1].total - a[1].total);
              const hasSubLines = subLines.length > 0;

              return hasSubLines ? (
                <SubRow
                  key={name}
                  name={name}
                  amount={data.total}
                  percent={data.percentOfTotal || 0}
                  showComparison={false}
                  currency={currency}
                  hasChildren={true}
                  dotColor="bg-emerald-400"
                  forceOpen={isSearching}
                >
                  {subLines.map(([subName, subData]) => (
                    <ItemRow key={subName} name={subName} amount={subData.total} percent={subData.percentOfTotal || 0} currency={currency} />
                  ))}
                </SubRow>
              ) : (
                <IncomeRow key={name} name={name} amount={data.total} percent={data.percentOfTotal || 0} currency={currency} />
              );
            })}
        </Section>

        {/* ══════ FOOD COST ══════ */}
        {/* Expande directamente en CATEGORÍAS DE INSUMO → ítems */}
        <Section
          title="Food Cost"
          emoji="🍽️"
          bgColor="bg-amber-600"
          cleanBgClass="bg-gradient-to-r from-amber-50/70 to-orange-50/50"
          cleanBorderColor="border-amber-400"
          isClean={isClean}
          totalAmount={totalFoodCost}
          totalPercent={totalFoodCostPercent}
          comparisonPercent={showComparisonCol && quarterAnalysis.hasData && quarterAnalysis.avgIncome > 0 ? (quarterAnalysis.avgSupply / quarterAnalysis.avgIncome) * 100 : null}
          showComparison={showComparisonCol}
          currency={currency}
          defaultOpen={true}
          forceOpen={isSearching}
        >
          {Object.entries(flatFoodCategories)
            .filter(([catName, catData]) => {
              if (!isSearching) return true;
              if (catName.toLowerCase().includes(normalizedSearch)) return true;
              return Object.keys(catData.items || {}).some(item => item.toLowerCase().includes(normalizedSearch));
            })
            .sort((a, b) => b[1].total - a[1].total)
            .map(([catName, catData]) => {
              const catPercent = totalIncome > 0 ? (catData.total / totalIncome) * 100 : 0;
              const items = Object.entries(catData.items || {})
                .filter(([item]) => !isSearching || item.toLowerCase().includes(normalizedSearch) || catName.toLowerCase().includes(normalizedSearch))
                .sort((a, b) => b[1].total - a[1].total);

              // Si solo hay 1 ítem con el mismo nombre que la categoría, no mostrar subnivel
              const singleSameName = items.length === 1 && items[0][0].trim().toUpperCase() === catName.trim().toUpperCase();

              return (
                <SubRow
                  key={catName}
                  name={catName}
                  amount={catData.total}
                  percent={catPercent}
                  showComparison={false}
                  currency={currency}
                  hasChildren={!singleSameName && items.length > 0}
                  dotColor="bg-amber-400"
                  forceOpen={isSearching}
                >
                  {!singleSameName && items.map(([itemName, itemData]) => (
                    <ItemRow
                      key={itemName}
                      name={itemName}
                      amount={itemData.total}
                      percent={totalIncome > 0 ? (itemData.total / totalIncome) * 100 : 0}
                      currency={currency}
                      onClick={() => setDetail({ kind: 'supply', name: itemName })}
                    />
                  ))}
                </SubRow>
              );
            })}
        </Section>

        {/* ══════ MARGEN OPERACIONAL ══════ */}
        <ResultLine
          label="MARGEN OPERACIONAL"
          icon={<TrendingUp className="w-5 h-5 text-teal-600" />}
          amount={operationalMargin}
          percent={operationalMarginPercent}
          currency={currency}
          isPositive={operationalMargin >= 0}
          comparisonPercent={quarterAnalysis.hasData && quarterAnalysis.avgIncome > 0 ? (quarterAnalysis.avgOperationalMargin / quarterAnalysis.avgIncome) * 100 : null}
          showComparison={showComparisonCol}
          isClean={isClean}
        />

        {/* ══════ CENTROS DE COSTO (OPEX) ══════ */}
        <Section
          title="Centros de Costo (OPEX)"
          emoji="📊"
          bgColor="bg-blue-600"
          cleanBgClass="bg-gradient-to-r from-violet-50/70 to-purple-50/50"
          cleanBorderColor="border-violet-400"
          isClean={isClean}
          totalAmount={totalOpex}
          totalPercent={totalOpexPercent}
          comparisonPercent={showComparisonCol && quarterAnalysis.hasData && quarterAnalysis.avgIncome > 0 ? (quarterAnalysis.avgOpex / quarterAnalysis.avgIncome) * 100 : null}
          showComparison={showComparisonCol}
          currency={currency}
          defaultOpen={true}
          forceOpen={isSearching}
        >
          {Object.entries(opexAnalysis)
            .filter(([name, data]) => {
              if (!isSearching) return true;
              if (name.toLowerCase().includes(normalizedSearch)) return true;
              // Buscar en categorías e ítems
              return Object.entries(data.categories || {}).some(([catName, catData]) => {
                if (catName.toLowerCase().includes(normalizedSearch)) return true;
                return Object.keys(catData.items || {}).some(item => item.toLowerCase().includes(normalizedSearch));
              });
            })
            .sort((a, b) => b[1].total - a[1].total)
            .map(([centerName, centerData]) => {
              const centerPercent = totalIncome > 0 ? (centerData.total / totalIncome) * 100 : 0;
              const qPercent = quarterAnalysis.hasData && quarterAnalysis.avgIncome > 0 
                ? ((quarterAnalysis.centerAvgs?.[centerName] || 0) / quarterAnalysis.avgIncome) * 100 : null;
              
              const categories = Object.entries(centerData.categories || {})
                .filter(([catName, catData]) => {
                  if (!isSearching) return true;
                  if (centerName.toLowerCase().includes(normalizedSearch)) return true;
                  if (catName.toLowerCase().includes(normalizedSearch)) return true;
                  return Object.keys(catData.items || {}).some(item => item.toLowerCase().includes(normalizedSearch));
                })
                .sort((a, b) => b[1].total - a[1].total);

              const proformaCenter = proforma?.cost_centers_budget?.find(c => c.name.toUpperCase() === centerName.toUpperCase());
              const proformaPercent = proformaCenter?.percent;

              return (
                <SubRow
                  key={centerName}
                  name={centerName}
                  amount={centerData.total}
                  percent={centerPercent}
                  comparisonPercent={qPercent}
                  showComparison={showComparisonCol}
                  currency={currency}
                  hasChildren={categories.length > 0}
                  proformaPercent={proformaPercent}
                  dotColor="bg-violet-400"
                  forceOpen={isSearching}
                >
                  {categories.map(([catName, catData]) => {
                    const catPercent = totalIncome > 0 ? (catData.total / totalIncome) * 100 : 0;
                    const items = Object.entries(catData.items || {})
                      .filter(([itemName]) => !isSearching || itemName.toLowerCase().includes(normalizedSearch) || catName.toLowerCase().includes(normalizedSearch) || centerName.toLowerCase().includes(normalizedSearch))
                      .sort((a, b) => b[1].total - a[1].total);
                    
                    // Si la categoría tiene solo 1 ítem con el mismo nombre, mostrar solo la categoría sin desglosar
                    const singleItem = items.length === 1 && items[0][0].toLowerCase() === catName.toLowerCase();
                    
                    return (
                      <CategoryRow
                        key={catName}
                        name={catName}
                        amount={catData.total}
                        percent={catPercent}
                        currency={currency}
                        hasChildren={!singleItem && items.length > 0}
                        dotColor="bg-violet-300"
                        forceOpen={isSearching}
                      >
                        {!singleItem && items.map(([itemName, itemData]) => (
                          <ItemRow
                            key={itemName}
                            name={itemName}
                            amount={itemData.total}
                            percent={totalIncome > 0 ? (itemData.total / totalIncome) * 100 : 0}
                            currency={currency}
                            indent={12}
                            onClick={() => setDetail({ kind: 'opex', name: itemName })}
                          />
                        ))}
                      </CategoryRow>
                    );
                  })}
                </SubRow>
              );
            })}
        </Section>

        {/* ══════ TOTAL COSTOS ══════ */}
        <ResultLine
          label="COSTOS DE OPERACIÓN"
          icon={null}
          amount={totalCosts}
          percent={totalCostPercent}
          currency={currency}
          isPositive={false}
          comparisonPercent={showComparisonCol && quarterAnalysis.hasData && quarterAnalysis.avgIncome > 0 ? (quarterAnalysis.avgTotalCosts / quarterAnalysis.avgIncome) * 100 : null}
          showComparison={showComparisonCol}
          variant="total"
          isClean={isClean}
          cleanBgClass="bg-slate-700 border border-slate-600"
        />

        {/* ══════ EBITDA ══════ */}
        <ResultLine
          label="UTILIDAD EBITDA"
          icon={grossProfit >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
          amount={grossProfit}
          percent={grossMargin}
          currency={currency}
          isPositive={grossProfit >= 0}
          comparisonPercent={quarterAnalysis.hasData && quarterAnalysis.avgIncome > 0 ? (quarterAnalysis.avgEbitda / quarterAnalysis.avgIncome) * 100 : null}
          showComparison={showComparisonCol}
          isClean={isClean}
        />
      </div>
    </Card>
    </>
  );
}