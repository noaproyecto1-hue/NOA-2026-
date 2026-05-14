import React, { useState, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, TrendingDown, ChevronDown, Crown, Medal, Award, Package, Building2, ArrowDownRight, ArrowUpRight, ShoppingBasket, Users } from "lucide-react";
import { formatCurrency } from '@/components/utils/currencyHelper';
import { motion, AnimatePresence } from 'framer-motion';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_BG = ['from-amber-50 to-yellow-50', 'from-gray-50 to-slate-50', 'from-orange-50 to-amber-50'];
const MEDAL_ICONS = [Crown, Medal, Award];

const ITEM_COLORS = [
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-teal-100 text-teal-700 border-teal-200',
];

// No date filter — always show full history

// ─── Vista Por Proveedor ───────────────────────────────────────────────────────
function SupplierView({ supplyCosts, opexData, selectedRestaurant, currency }) {
  const [rankingMode, setRankingMode] = useState('supply_category');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [expandedSupplier, setExpandedSupplier] = useState(null);

  const isOpexMode = rankingMode === 'cost_center';

  const filterOptions = useMemo(() => {
    const supplyCategories = new Set();
    const costCenters = new Set();
    supplyCosts.forEach(c => {
      if (selectedRestaurant !== 'all' && c.restaurant_id !== selectedRestaurant) return;
      if (c.supply_category) supplyCategories.add(c.supply_category);
    });
    opexData.forEach(o => {
      if (selectedRestaurant !== 'all' && o.restaurant_id !== selectedRestaurant) return;
      if (o.cost_center_name) costCenters.add(o.cost_center_name);
    });
    return {
      supply_category: [...supplyCategories].sort(),
      cost_center: [...costCenters].sort()
    };
  }, [supplyCosts, opexData, selectedRestaurant]);

  const ranking = useMemo(() => {
    let transactions = [];

    if (rankingMode === 'supply_category') {
      transactions = supplyCosts
        .filter(c => {
          if (selectedRestaurant !== 'all' && c.restaurant_id !== selectedRestaurant) return false;
          if (selectedFilter !== 'all' && c.supply_category !== selectedFilter) return false;
          return !!c.supplier;
        })
        .map(c => ({
          supplier: c.supplier,
          category: c.supply_category || '—',
          item: c.supply_item_name || c.notes || '—',
          total: c.subtotal || c.total_cost || 0,
          qty: c.quantity_purchased || 0,
          unitCost: (c.quantity_purchased > 0) ? ((c.subtotal || c.total_cost || 0) / c.quantity_purchased) : null,
        }));
    } else {
      transactions = opexData
        .filter(o => {
          if (selectedRestaurant !== 'all' && o.restaurant_id !== selectedRestaurant) return false;
          if (selectedFilter !== 'all' && o.cost_center_name !== selectedFilter) return false;
          return !!o.supplier;
        })
        .map(o => ({
          supplier: o.supplier,
          category: o.cost_center_name || o.type || '—',
          item: o.category || o.cost_center_name || o.description || '—',
          total: o.subtotal || o.amount || 0,
          qty: 0,
          unitCost: null,
        }));
    }

    const map = {};
    transactions.forEach(t => {
      if (!map[t.supplier]) {
        map[t.supplier] = { name: t.supplier, totalSpent: 0, count: 0, categories: new Set(), items: new Set(), unitCosts: [] };
      }
      map[t.supplier].totalSpent += t.total;
      map[t.supplier].count++;
      if (t.category) map[t.supplier].categories.add(t.category);
      if (t.item) map[t.supplier].items.add(t.item);
      if (t.unitCost !== null && t.unitCost > 0) map[t.supplier].unitCosts.push(t.unitCost);
    });

    return Object.values(map)
      .map(s => {
        const avgUnitCost = s.unitCosts.length > 0 ? s.unitCosts.reduce((a, b) => a + b, 0) / s.unitCosts.length : null;
        return { ...s, categories: [...s.categories], items: [...s.items], avgUnitCost, avgPerPurchase: s.count > 0 ? s.totalSpent / s.count : 0 };
      })
      .sort((a, b) => {
        if (rankingMode === 'supply_category' && a.avgUnitCost !== null && b.avgUnitCost !== null) return a.avgUnitCost - b.avgUnitCost;
        return a.totalSpent - b.totalSpent;
      });
  }, [supplyCosts, opexData, selectedRestaurant, selectedFilter, rankingMode]);

  const currentOptions = rankingMode === 'supply_category' ? filterOptions.supply_category : filterOptions.cost_center;

  return (
    <>
      {/* Filtros */}
      <div className="px-5 py-3 border-b border-gray-100/50 bg-white/30 shrink-0 flex flex-col sm:flex-row gap-2">
        <Select value={rankingMode} onValueChange={v => { setRankingMode(v); setSelectedFilter('all'); }}>
          <SelectTrigger className="h-8 text-xs flex-1 bg-gray-50 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="supply_category"><span className="flex items-center gap-2"><Package className="w-3.5 h-3.5" /> Categoría de Insumo</span></SelectItem>
            <SelectItem value="cost_center"><span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Gasto Operativo</span></SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedFilter} onValueChange={setSelectedFilter}>
          <SelectTrigger className="h-8 text-xs flex-1 bg-gray-50 border-gray-200">
            <SelectValue placeholder="Filtrar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {currentOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="divide-y divide-gray-100/30 overflow-y-auto flex-1">
        {ranking.length === 0 ? (
          <div className="p-8 text-center">
            <TrendingDown className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Sin datos para este filtro</p>
          </div>
        ) : ranking.map((supplier, idx) => {
          const isTop3 = idx < 3;
          const MedalIcon = isTop3 ? MEDAL_ICONS[idx] : null;
          const isExpanded = expandedSupplier === supplier.name;

          return (
            <div key={supplier.name}>
              <button
                onClick={() => setExpandedSupplier(isExpanded ? null : supplier.name)}
                className={`w-full flex items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-gray-50/70 ${isTop3 ? `bg-gradient-to-r ${MEDAL_BG[idx]}` : ''}`}
              >
                <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
                  style={isTop3 ? { backgroundColor: `${MEDAL_COLORS[idx]}20`, color: MEDAL_COLORS[idx] } : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}>
                  {isTop3 ? <MedalIcon className="w-5 h-5" /> : `#${idx + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-sm truncate ${isTop3 && idx === 0 ? 'text-amber-800' : 'text-gray-900'}`}>{supplier.name}</p>
                    {idx === 0 && <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 text-[10px] font-bold px-2 py-0 shadow-sm">{isOpexMode ? 'MENOR GASTO' : 'MEJOR PRECIO'}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                    <span>{supplier.count} {isOpexMode ? 'gasto' : 'compra'}{supplier.count !== 1 ? 's' : ''}</span>
                    {supplier.categories.length > 0 && <span className="truncate max-w-[140px]">{supplier.categories.join(', ')}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {supplier.avgUnitCost !== null ? (
                    <>
                      <p className={`font-black text-lg tabular-nums ${idx === 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{formatCurrency(supplier.avgUnitCost, currency)}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{isOpexMode ? 'prom/gasto' : 'prom/unidad'}</p>
                    </>
                  ) : (
                    <>
                      <p className={`font-black text-lg tabular-nums ${idx === 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{formatCurrency(supplier.totalSpent, currency, { compact: true })}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">total gastado</p>
                    </>
                  )}
                </div>
                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                  <ChevronDown className="w-4 h-4 text-gray-300" />
                </motion.div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="bg-gray-50/50 px-5 py-4 border-t border-gray-100">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Gastado</p>
                          <p className="text-base font-black text-gray-900 mt-0.5">{formatCurrency(supplier.totalSpent, currency, { compact: true })}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{isOpexMode ? 'Prom/Gasto' : 'Prom/Compra'}</p>
                          <p className="text-base font-black text-gray-900 mt-0.5">{formatCurrency(supplier.avgPerPurchase, currency, { compact: true })}</p>
                        </div>
                        {supplier.avgUnitCost !== null ? (
                          <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Prom/Unidad</p>
                            <p className="text-base font-black text-emerald-600 mt-0.5">{formatCurrency(supplier.avgUnitCost, currency)}</p>
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{isOpexMode ? 'Gastos' : 'Compras'}</p>
                            <p className="text-base font-black text-gray-900 mt-0.5">{supplier.count}</p>
                          </div>
                        )}
                      </div>

                      {supplier.items.length > 0 && supplier.items[0] !== '—' && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{isOpexMode ? 'Ítems de gasto' : 'Ítems comprados'}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {supplier.items.slice(0, 8).map((item, itemIdx) => (
                              <span key={item} className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${ITEM_COLORS[itemIdx % ITEM_COLORS.length]}`}>{item}</span>
                            ))}
                            {supplier.items.length > 8 && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 text-[11px] font-semibold">+{supplier.items.length - 8} más</span>
                            )}
                          </div>
                        </div>
                      )}

                      {idx > 0 && ranking[0].avgUnitCost !== null && supplier.avgUnitCost !== null && (
                        <div className="mt-3 bg-red-50 rounded-xl px-3 py-2 flex items-center gap-2">
                          <ArrowUpRight className="w-4 h-4 text-red-500 shrink-0" />
                          <p className="text-xs text-red-700"><span className="font-bold">{((supplier.avgUnitCost / ranking[0].avgUnitCost - 1) * 100).toFixed(0)}% más {isOpexMode ? 'costoso' : 'caro'}</span> que {ranking[0].name}</p>
                        </div>
                      )}
                      {idx === 0 && ranking.length > 1 && ranking[1].avgUnitCost !== null && supplier.avgUnitCost !== null && (
                        <div className="mt-3 bg-emerald-50 rounded-xl px-3 py-2 flex items-center gap-2">
                          <ArrowDownRight className="w-4 h-4 text-emerald-500 shrink-0" />
                          <p className="text-xs text-emerald-700"><span className="font-bold">{((1 - supplier.avgUnitCost / ranking[1].avgUnitCost) * 100).toFixed(0)}% más {isOpexMode ? 'económico' : 'barato'}</span> que el siguiente</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Vista Por Ítem ────────────────────────────────────────────────────────────
function ItemView({ supplyCosts, opexData = [], selectedRestaurant, currency }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedItem, setExpandedItem] = useState(null);
  const [itemMode, setItemMode] = useState('supply'); // 'supply' | 'opex'

  const categories = useMemo(() => {
    const cats = new Set();
    if (itemMode === 'supply') {
      supplyCosts.forEach(c => {
        if (selectedRestaurant !== 'all' && c.restaurant_id !== selectedRestaurant) return;
        if (c.supply_category) cats.add(c.supply_category);
      });
    } else {
      opexData.forEach(o => {
        if (selectedRestaurant !== 'all' && o.restaurant_id !== selectedRestaurant) return;
        if (o.cost_center_name) cats.add(o.cost_center_name);
      });
    }
    return [...cats].sort();
  }, [supplyCosts, opexData, selectedRestaurant, itemMode]);

  // Agrupar por ítem → luego por proveedor
  const itemRanking = useMemo(() => {
    if (itemMode === 'supply') {
      const filtered = supplyCosts.filter(c => {
        if (selectedRestaurant !== 'all' && c.restaurant_id !== selectedRestaurant) return false;
        if (selectedCategory !== 'all' && c.supply_category !== selectedCategory) return false;
        return !!c.supplier && !!c.supply_item_name && c.quantity_purchased > 0;
      });

      const itemMap = {};
      filtered.forEach(c => {
        const itemName = c.supply_item_name;
        if (!itemMap[itemName]) {
          itemMap[itemName] = { name: itemName, category: c.supply_category || '—', unit: c.unit_of_measure || '', type: 'supply', suppliers: {} };
        }
        const sup = c.supplier;
        if (!itemMap[itemName].suppliers[sup]) {
          itemMap[itemName].suppliers[sup] = { name: sup, unitCosts: [], totalSpent: 0, count: 0 };
        }
        const unitCost = (c.subtotal || c.total_cost || 0) / c.quantity_purchased;
        itemMap[itemName].suppliers[sup].unitCosts.push(unitCost);
        itemMap[itemName].suppliers[sup].totalSpent += c.subtotal || c.total_cost || 0;
        itemMap[itemName].suppliers[sup].count++;
      });

      return Object.values(itemMap)
        .map(item => {
          const suppliers = Object.values(item.suppliers)
            .map(s => ({ ...s, avgUnitCost: s.unitCosts.reduce((a, b) => a + b, 0) / s.unitCosts.length }))
            .sort((a, b) => a.avgUnitCost - b.avgUnitCost);
          return { ...item, suppliers };
        })
        .filter(item => item.suppliers.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Opex: agrupar por descripción/categoría → proveedores
      const filtered = opexData.filter(o => {
        if (selectedRestaurant !== 'all' && o.restaurant_id !== selectedRestaurant) return false;
        if (selectedCategory !== 'all' && o.cost_center_name !== selectedCategory) return false;
        return !!o.supplier;
      });

      const itemMap = {};
      filtered.forEach(o => {
        const itemName = o.category || o.cost_center_name || o.description || '—';
        if (!itemMap[itemName]) {
          itemMap[itemName] = { name: itemName, category: o.cost_center_name || '—', unit: '', type: 'opex', suppliers: {} };
        }
        const sup = o.supplier;
        if (!itemMap[itemName].suppliers[sup]) {
          itemMap[itemName].suppliers[sup] = { name: sup, unitCosts: [], totalSpent: 0, count: 0 };
        }
        itemMap[itemName].suppliers[sup].totalSpent += o.subtotal || o.amount || 0;
        itemMap[itemName].suppliers[sup].count++;
        itemMap[itemName].suppliers[sup].unitCosts.push(o.subtotal || o.amount || 0);
      });

      return Object.values(itemMap)
        .map(item => {
          const suppliers = Object.values(item.suppliers)
            .map(s => ({ ...s, avgUnitCost: s.unitCosts.reduce((a, b) => a + b, 0) / s.unitCosts.length }))
            .sort((a, b) => a.avgUnitCost - b.avgUnitCost);
          return { ...item, suppliers };
        })
        .filter(item => item.suppliers.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [supplyCosts, opexData, selectedRestaurant, selectedCategory, itemMode]);

  return (
    <>
      {/* Filtros */}
      <div className="px-5 py-3 border-b border-gray-100/50 bg-white/30 shrink-0 flex flex-col sm:flex-row gap-2">
        <Select value={itemMode} onValueChange={v => { setItemMode(v); setSelectedCategory('all'); }}>
          <SelectTrigger className="h-8 text-xs flex-1 bg-gray-50 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="supply"><span className="flex items-center gap-2"><Package className="w-3.5 h-3.5" /> Ítems de Compra</span></SelectItem>
            <SelectItem value="opex"><span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Ítems de Gasto</span></SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-8 text-xs flex-1 bg-gray-50 border-gray-200">
            <SelectValue placeholder="Filtrar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{itemMode === 'supply' ? 'Todas las categorías' : 'Todos los centros'}</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de ítems */}
      <div className="divide-y divide-gray-100/30 overflow-y-auto flex-1">
        {itemRanking.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingBasket className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{itemMode === 'supply' ? 'Sin datos de ítems con cantidad registrada' : 'Sin datos de gastos operativos'}</p>
          </div>
        ) : itemRanking.map(item => {
          const isExpanded = expandedItem === item.name;
          const bestSupplier = item.suppliers[0];
          const hasMultiple = item.suppliers.length > 1;

          return (
            <div key={item.name}>
              <button
                onClick={() => setExpandedItem(isExpanded ? null : item.name)}
                className="w-full flex items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-gray-50/70"
              >
                {/* Icono ítem */}
                <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${item.type === 'opex' ? 'bg-violet-50' : 'bg-indigo-50'}`}>
                  {item.type === 'opex' ? <Building2 className="w-4 h-4 text-violet-500" /> : <ShoppingBasket className="w-4 h-4 text-indigo-500" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-400">{item.category}</span>
                    {hasMultiple && (
                      <span className="text-[11px] text-blue-500 font-semibold">{item.suppliers.length} proveedor{item.suppliers.length !== 1 ? 'es' : ''}</span>
                    )}
                  </div>
                </div>

                {/* Mejor precio */}
                <div className="shrink-0 text-right">
                  <p className="font-black text-lg tabular-nums text-emerald-600">{formatCurrency(bestSupplier.avgUnitCost, currency)}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5 truncate max-w-[90px]">{bestSupplier.name}</p>
                </div>

                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                  <ChevronDown className="w-4 h-4 text-gray-300" />
                </motion.div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="bg-gray-50/50 px-5 py-4 border-t border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                        {item.type === 'opex' ? 'Comparativa de gasto promedio' : `Comparativa de precios${item.unit ? ` · por ${item.unit}` : ''}`}
                      </p>
                      <div className="space-y-2">
                        {item.suppliers.map((s, sIdx) => {
                          const isBest = sIdx === 0;
                          const priceDiff = sIdx > 0 ? ((s.avgUnitCost / item.suppliers[0].avgUnitCost - 1) * 100).toFixed(0) : null;
                          return (
                            <div key={s.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isBest ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
                              <div className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${isBest ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                {isBest ? '★' : sIdx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold truncate ${isBest ? 'text-emerald-800' : 'text-gray-700'}`}>{s.name}</p>
                                <p className="text-[10px] text-gray-400">{s.count} {item.type === 'opex' ? 'gasto' : 'compra'}{s.count !== 1 ? 's' : ''}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className={`font-black text-sm tabular-nums ${isBest ? 'text-emerald-600' : 'text-gray-800'}`}>
                                  {formatCurrency(s.avgUnitCost, currency)}
                                </p>
                                {priceDiff && (
                                  <p className="text-[10px] text-red-500 font-bold">+{priceDiff}%</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Barra visual de comparación */}
                      {item.suppliers.length > 1 && (
                        <div className="mt-3">
                          {item.suppliers.map((s, sIdx) => {
                            const pct = (s.avgUnitCost / item.suppliers[item.suppliers.length - 1].avgUnitCost) * 100;
                            return (
                              <div key={s.name} className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] text-gray-500 w-20 truncate">{s.name}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${sIdx === 0 ? 'bg-emerald-400' : 'bg-red-300'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-gray-600 w-16 text-right tabular-nums">{formatCurrency(s.avgUnitCost, currency)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Panel Principal ───────────────────────────────────────────────────────────
export default function SupplierRankingPanel({
  supplyCosts = [],
  opexData = [],
  selectedRestaurant = 'all',
  currency = 'USD'
}) {
  const [activeTab, setActiveTab] = useState('supplier');

  return (
    <div className="bg-white/50 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-gray-100/50 bg-white/40 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200/50">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Ranking de Proveedores</h3>
            <p className="text-xs text-gray-500 mt-0.5">¿Quién te ofrece mejores precios?</p>
          </div>
        </div>

        {/* Mini pestañas */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('supplier')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'supplier'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Por Proveedor
          </button>
          <button
            onClick={() => setActiveTab('item')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'item'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShoppingBasket className="w-3.5 h-3.5" />
            Por Ítem
          </button>
        </div>
      </div>

      {/* Contenido según pestaña */}
      {activeTab === 'supplier' ? (
        <SupplierView
          supplyCosts={supplyCosts}
          opexData={opexData}
          selectedRestaurant={selectedRestaurant}
          currency={currency}
        />
      ) : (
        <ItemView
          supplyCosts={supplyCosts}
          opexData={opexData}
          selectedRestaurant={selectedRestaurant}
          currency={currency}
        />
      )}
    </div>
  );
}