import React, { useMemo, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, TrendingUp, TrendingDown, Minus, DollarSign, ChevronDown, Users } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, getCurrencySymbol } from '@/components/utils/currencyHelper';

export default function PriceIncreasePanel({
  supplyCosts = [],
  selectedRestaurant = 'all',
  currency = 'USD',
  alertThresholds = {} // { green: 5, yellow: 10, red: 10 } from restaurant.alert_thresholds.supply_price_change
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [expandedItem, setExpandedItem] = useState(null);

  // Agrupar compras por insumo, ordenadas por fecha, comparar la última vs la anterior
  const priceAnalysis = useMemo(() => {
    const filtered = supplyCosts.filter(sc => {
      if (selectedRestaurant !== 'all' && sc.restaurant_id !== selectedRestaurant) return false;
      return sc.supply_item_name && sc.quantity_purchased > 0;
    });

    // Agrupar por insumo
    const byItem = {};
    filtered.forEach(sc => {
      const name = sc.supply_item_name;
      if (!byItem[name]) byItem[name] = [];
      // Usar subtotal (neto sin IVA) para precio unitario real
      const netAmount = sc.subtotal || (sc.is_tax_exempt ? (sc.total_cost || 0) : (sc.total_cost || 0) / (1 + (sc.tax_rate || 19) / 100));
      byItem[name].push({
        date: sc.date,
        unitCost: netAmount / sc.quantity_purchased,
        totalCost: netAmount,
        qty: sc.quantity_purchased,
        supplier: sc.supplier || '—',
        category: sc.supply_category || '—'
      });
    });

    const results = [];
    Object.entries(byItem).forEach(([name, purchases]) => {
      // Ordenar por fecha descendente
      purchases.sort((a, b) => b.date.localeCompare(a.date));

      // Agrupar por proveedor para comparativa
      const bySupplier = {};
      purchases.forEach(p => {
        if (!bySupplier[p.supplier]) bySupplier[p.supplier] = [];
        bySupplier[p.supplier].push(p);
      });
      const supplierComparison = Object.entries(bySupplier).map(([sup, pList]) => {
        const sorted = [...pList].sort((a, b) => b.date.localeCompare(a.date));
        const avgCost = sorted.reduce((s, p) => s + p.unitCost, 0) / sorted.length;
        const latestCost = sorted[0].unitCost;
        return { name: sup, purchases: sorted, avgCost, latestCost, count: sorted.length, latestDate: sorted[0].date };
      }).sort((a, b) => a.avgCost - b.avgCost);

      const uniqueSuppliers = [...new Set(purchases.map(p => p.supplier))];

      if (purchases.length < 2) {
        const p = purchases[0];
        results.push({
          name, category: p.category, currentPrice: p.unitCost, previousPrice: null,
          change: 0, changePercent: 0, status: 'new', lastDate: p.date, supplier: p.supplier,
          purchaseCount: 1, history: purchases, supplierComparison, uniqueSuppliers
        });
        return;
      }

      const latest = purchases[0];
      const previous = purchases[1];
      const change = latest.unitCost - previous.unitCost;
      const changePercent = previous.unitCost > 0 ? (change / previous.unitCost * 100) : 0;

      // Usar umbrales configurados del restaurante o 5% por defecto
      const greenThreshold = alertThresholds?.green || 5;
      let status = 'stable';
      let severity = 'green'; // default
      if (changePercent > greenThreshold) {
        status = 'up';
        const yellowThreshold = alertThresholds?.yellow || 10;
        const redThreshold = alertThresholds?.red || 15;
        if (Math.abs(changePercent) >= redThreshold) severity = 'red';
        else if (Math.abs(changePercent) >= yellowThreshold) severity = 'yellow';
        else severity = 'yellow';
      } else if (changePercent < -greenThreshold) {
        status = 'down';
        severity = 'green';
      }

      results.push({
        name, category: latest.category, currentPrice: latest.unitCost, previousPrice: previous.unitCost,
        change, changePercent, status, severity, lastDate: latest.date, previousDate: previous.date,
        supplier: latest.supplier, purchaseCount: purchases.length, history: purchases.slice(0, 6),
        supplierComparison, uniqueSuppliers
      });
    });

    return results.sort((a, b) => b.changePercent - a.changePercent);
  }, [supplyCosts, selectedRestaurant]);

  const filtered = priceAnalysis.filter(item => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase()) && !item.category.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterType === 'up') return item.status === 'up';
    if (filterType === 'down') return item.status === 'down';
    if (filterType === 'stable') return item.status === 'stable';
    return true;
  });

  const upCount = priceAnalysis.filter(i => i.status === 'up').length;
  const downCount = priceAnalysis.filter(i => i.status === 'down').length;
  const stableCount = priceAnalysis.filter(i => i.status === 'stable').length;
  const sym = getCurrencySymbol(currency);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar insumo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10 rounded-xl" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ({priceAnalysis.length})</SelectItem>
            <SelectItem value="up">📈 Subieron ({upCount})</SelectItem>
            <SelectItem value="down">📉 Bajaron ({downCount})</SelectItem>
            <SelectItem value="stable">➖ Estables ({stableCount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-100 cursor-pointer hover:shadow-md transition-all" onClick={() => setFilterType('up')}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-red-500" />
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Subieron</p>
            </div>
            <p className="text-2xl font-black text-red-700">{upCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100 cursor-pointer hover:shadow-md transition-all" onClick={() => setFilterType('down')}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown className="w-4 h-4 text-emerald-500" />
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Bajaron</p>
            </div>
            <p className="text-2xl font-black text-emerald-700">{downCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200 cursor-pointer hover:shadow-md transition-all" onClick={() => setFilterType('stable')}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Minus className="w-4 h-4 text-gray-500" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estables</p>
            </div>
            <p className="text-2xl font-black text-gray-700">{stableCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((item, idx) => {
            const isUp = item.status === 'up';
            const isDown = item.status === 'down';
            const isExpanded = expandedItem === item.name;
            const hasMultipleSuppliers = item.uniqueSuppliers?.length > 1;
            return (
              <motion.div key={item.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                <Card className={`bg-white border hover:shadow-lg transition-all ${isUp ? 'border-red-100' : isDown ? 'border-emerald-100' : 'border-gray-100'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedItem(isExpanded ? null : item.name)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                          isUp ? 'bg-gradient-to-br from-red-500 to-rose-600' :
                          isDown ? 'bg-gradient-to-br from-emerald-500 to-green-600' :
                          item.status === 'new' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                          'bg-gradient-to-br from-gray-400 to-gray-500'
                        }`}>
                          {isUp ? <TrendingUp className="w-5 h-5 text-white" /> :
                           isDown ? <TrendingDown className="w-5 h-5 text-white" /> :
                           <Minus className="w-5 h-5 text-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs font-semibold text-amber-600 uppercase">{item.category}</span>
                            <span className="text-xs text-gray-600">· {item.supplier}</span>
                            <span className="text-xs text-gray-600">· {item.purchaseCount} compras</span>
                            {hasMultipleSuppliers && (
                              <Badge className="bg-indigo-100 text-indigo-700 border-0 text-[10px]">
                                <Users className="w-3 h-3 mr-1" />{item.uniqueSuppliers.length} proveedores
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-lg font-black text-gray-900">{sym}{item.currentPrice.toFixed(1)}</p>
                          {item.previousPrice !== null ? (
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-400 line-through">{sym}{item.previousPrice.toFixed(1)}</span>
                              <Badge className={`border-0 text-[10px] font-bold ${
                                isUp
                                  ? item.severity === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                  : isDown ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {isUp ? (item.severity === 'red' ? '🔴' : '🟡') : isDown ? '↓' : '='} {Math.abs(item.changePercent).toFixed(1)}%
                              </Badge>
                            </div>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">Primera compra</Badge>
                          )}
                        </div>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </motion.div>
                      </div>
                    </div>

                    {/* Mini historial de precios */}
                    {item.history.length > 1 && (
                      <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
                        {item.history.map((h, hIdx) => (
                          <div key={hIdx} className={`shrink-0 text-center px-2.5 py-1.5 rounded-lg text-[11px] ${
                            hIdx === 0 ? 'bg-blue-50 border border-blue-200 font-bold text-blue-700' : 'bg-gray-50 text-gray-600'
                          }`}>
                            <div>{sym}{h.unitCost.toFixed(1)}</div>
                            <div className="text-gray-500">{h.supplier !== '—' ? h.supplier.slice(0, 8) : ''}</div>
                            <div className="text-gray-500">{h.date ? `${h.date.slice(8)}-${h.date.slice(5,7)}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Panel expandido: Comparativa de proveedores */}
                    <AnimatePresence>
                      {isExpanded && item.supplierComparison?.length > 0 && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" /> Comparativa por Proveedor
                            </p>
                            <div className="space-y-2">
                              {item.supplierComparison.map((sup, sIdx) => {
                                const isBest = sIdx === 0;
                                const priceDiff = sIdx > 0 && item.supplierComparison[0].avgCost > 0
                                  ? ((sup.avgCost / item.supplierComparison[0].avgCost - 1) * 100).toFixed(0)
                                  : null;

                                return (
                                  <div key={sup.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                                    isBest ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'
                                  }`}>
                                    <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                                      isBest ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      {isBest ? '★' : sIdx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-bold truncate ${isBest ? 'text-emerald-800' : 'text-gray-700'}`}>{sup.name}</p>
                                      <p className="text-[11px] text-gray-500">{sup.count} compra{sup.count !== 1 ? 's' : ''} · Última: {sup.latestDate ? `${sup.latestDate.slice(8)}-${sup.latestDate.slice(5,7)}` : ''}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className={`font-black text-sm tabular-nums ${isBest ? 'text-emerald-600' : 'text-gray-800'}`}>
                                        {sym}{sup.avgCost.toFixed(1)}
                                      </p>
                                      <p className="text-[11px] text-gray-500">prom.</p>
                                      {priceDiff && priceDiff !== '0' && (
                                        <p className="text-[10px] text-red-500 font-bold">+{priceDiff}%</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Barra visual */}
                            {item.supplierComparison.length > 1 && (
                              <div className="mt-3">
                                {item.supplierComparison.map((s, sIdx) => {
                                  const maxCost = item.supplierComparison[item.supplierComparison.length - 1].avgCost;
                                  const pct = maxCost > 0 ? (s.avgCost / maxCost) * 100 : 0;
                                  return (
                                    <div key={s.name} className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] text-gray-600 w-20 truncate">{s.name}</span>
                                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                                        <div className={`h-2 rounded-full ${sIdx === 0 ? 'bg-emerald-400' : 'bg-red-300'}`} style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-[11px] font-bold text-gray-700 w-16 text-right tabular-nums">{sym}{s.avgCost.toFixed(1)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {item.supplierComparison.length === 1 && (
                              <div className="mt-2 bg-blue-50 rounded-xl px-3 py-2">
                                <p className="text-xs text-blue-700">Solo 1 proveedor registrado para este insumo. Agrega compras de otros proveedores para comparar precios.</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay datos de precios</p>
            <p className="text-sm text-gray-400 mt-1">Se necesitan al menos 2 compras de un insumo para comparar</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}