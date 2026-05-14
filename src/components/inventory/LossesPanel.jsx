import React, { useMemo, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown, Search, Package, ShoppingCart, ChefHat, User, Calendar, Clock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from '@/components/utils/currencyHelper';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatDateInUserTz, getUserTimezone } from '@/components/utils/timezoneHelper';
import { formatInTimeZone } from 'date-fns-tz';

function ExpandableRow({ item, idx, currency, user }) {
  const [expanded, setExpanded] = useState(false);
  const isExternal = item._lossType === 'external';

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className={`cursor-pointer transition-colors hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${expanded ? 'bg-blue-50/50' : ''}`}
      >
        <td className="py-2.5 px-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
            idx < 3 ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gray-400'
          }`}>
            {idx + 1}
          </div>
        </td>
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-900 text-sm">{item.name}</span>
            {isExternal ? (
              <Badge className="bg-orange-100 text-orange-700 border-0 text-[9px] px-1.5 py-0">🚚 Proveedor</Badge>
            ) : (
              <Badge className="bg-indigo-100 text-indigo-700 border-0 text-[9px] px-1.5 py-0">📋 Conteo</Badge>
            )}
          </div>
        </td>
        <td className="py-2.5 px-3">
          <Badge className="bg-green-100 text-green-700 border-0 text-xs px-2 py-0.5">{item.category}</Badge>
        </td>
        <td className="py-2.5 px-3 text-right">
          <span className="text-sm font-bold text-red-600">-{item.lossQty} {item.unit}</span>
        </td>
        <td className="py-2.5 px-3 text-right">
          <span className="text-sm font-black text-red-600">{formatCurrency(item.lossValue, currency)}</span>
        </td>
        <td className="py-2.5 px-3 text-sm text-gray-500">
          {formatDateInUserTz(item.lastCountDate, 'dd/MM/yy', user) || item.lastCountDate || '—'}
        </td>
        <td className="py-2.5 px-3 text-center">
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-200">
          <td colSpan={7} className="p-4">
            {isExternal ? (
              /* Detalle para pérdidas externas (proveedor) */
              <div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
                  <div className="text-center bg-white rounded-xl p-3 border border-orange-100">
                    <p className="text-[10px] text-orange-400 uppercase font-bold mb-1">Facturado (total)</p>
                    <p className="text-sm font-bold text-gray-700">{item._invoicedQty} {item.unit}</p>
                  </div>
                  <div className="text-center bg-white rounded-xl p-3 border border-green-100">
                    <p className="text-[10px] text-green-400 uppercase font-bold mb-1">Recibido (total)</p>
                    <p className="text-sm font-bold text-green-600">{item._receivedQty} {item.unit}</p>
                  </div>
                  <div className="text-center bg-white rounded-xl p-3 border border-red-100">
                    <p className="text-[10px] text-red-400 uppercase font-bold mb-1">Faltante (total)</p>
                    <p className="text-sm font-bold text-red-600">-{item.lossQty} {item.unit}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                  {item._purchaseCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      <span><b>Compras con faltante:</b> {item._purchaseCount}</span>
                    </div>
                  )}
                  {item._supplierName && item._supplierName !== 'N/A' && (
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                      <span><b>{item._purchaseCount > 1 ? 'Proveedores' : 'Proveedor'}:</b> {item._supplierName}</span>
                    </div>
                  )}
                  {item._invoiceNumber && item._invoiceNumber !== 'N/A' && (
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      <span><b>Factura:</b> {item._invoiceNumber}</span>
                    </div>
                  )}
                  {item.lastCountedBy && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span><b>Registró:</b> {item.lastCountedBy}</span>
                    </div>
                  )}
                  {item.lastCountDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span><b>Última fecha:</b> {formatDateInUserTz(item.lastCountDate, "dd 'de' MMMM yyyy", user) || item.lastCountDate}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Detalle para pérdidas por conteo */
              <div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
                  <div className="text-center bg-white rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Package className="w-3 h-3 text-gray-400" />
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Esperado (sistema)</p>
                    </div>
                    <p className="text-sm font-bold text-gray-700">{item.totalExpected} {item.unit}</p>
                  </div>
                  <div className="text-center bg-white rounded-xl p-3 border border-red-100">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <p className="text-[10px] text-red-500 uppercase font-bold">Contado (real)</p>
                    </div>
                    <p className="text-sm font-bold text-red-600">{item.totalActual} {item.unit}</p>
                  </div>
                  <div className="text-center bg-white rounded-xl p-3 border border-red-200">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TrendingDown className="w-3 h-3 text-red-500" />
                      <p className="text-[10px] text-red-500 uppercase font-bold">Diferencia</p>
                    </div>
                    <p className="text-sm font-bold text-red-600">-{item.lossQty} {item.unit}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                  {item.counters?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span><b>Contó:</b> {item.counters.join(', ')}</span>
                    </div>
                  )}
                  {item.lastCountDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span><b>Fecha:</b> {formatDateInUserTz(item.lastCountDate, "dd 'de' MMMM yyyy", user) || item.lastCountDate}</span>
                    </div>
                  )}
                  {item.lastCountCreatedDate && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span><b>Hora:</b> {(() => {
                        try {
                          const tz = getUserTimezone(user);
                          let dateStr = item.lastCountCreatedDate;
                          if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) dateStr += 'Z';
                          return formatInTimeZone(new Date(dateStr), tz, 'HH:mm');
                        } catch { return '—'; }
                      })()}</span>
                    </div>
                  )}
                  {item.lastCountType && (
                    <Badge variant="outline" className="text-xs text-gray-500">
                      {item.lastCountType === 'daily' ? '📋 Diario' : item.lastCountType === 'monthly' ? '📦 Mensual' : '📊 XLSX'}
                    </Badge>
                  )}
                  {item.area && (
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">📍 {item.area}</Badge>
                  )}
                </div>
                {item.gainQty > 0 && (
                  <div className="mt-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-1.5 w-fit">
                    ✓ También registró sobrante de +{item.gainQty} en otros conteos
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function LossesPanel({
  inventoryCounts = [],
  supplyItems = [],
  supplyCosts = [],
  stockMovements = [],
  wasteRecords = [],
  selectedRestaurant = 'all',
  currency = 'USD'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('current');
  const [lossType, setLossType] = useState('external'); // 'external', 'unexplained'

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    if (filterMonth === 'current') {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    } else if (filterMonth === 'last') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: lastMonth.toISOString().slice(0, 10), to: lastDay.toISOString().slice(0, 10) };
    }
    return { from: '2020-01-01', to: now.toISOString().slice(0, 10) };
  }, [filterMonth]);

  // Internal losses from inventory counts
  const internalLosses = useMemo(() => {
    const items = supplyItems.filter(s => selectedRestaurant === 'all' || s.restaurant_id === selectedRestaurant);
    
    const periodCounts = inventoryCounts.filter(c => {
      if (selectedRestaurant !== 'all' && c.restaurant_id !== selectedRestaurant) return false;
      return c.date >= dateRange.from && c.date <= dateRange.to;
    });

    if (periodCounts.length === 0) return [];

    const countsByItem = {};
    periodCounts.forEach(c => {
      if (!countsByItem[c.supply_name]) countsByItem[c.supply_name] = [];
      countsByItem[c.supply_name].push(c);
    });

    const results = [];
    Object.entries(countsByItem).forEach(([supplyName, counts]) => {
      const totalExpected = counts.reduce((sum, c) => sum + (c.expected_quantity || 0), 0);
      const totalActual = counts.reduce((sum, c) => sum + (c.actual_quantity || 0), 0);
      const totalLossQty = counts.reduce((sum, c) => sum + (c.loss_quantity > 0 ? c.loss_quantity : 0), 0);
      const totalLossValue = counts.reduce((sum, c) => sum + (c.loss_value > 0 ? c.loss_value : 0), 0);
      const totalGainQty = counts.reduce((sum, c) => sum + (c.loss_quantity < 0 ? Math.abs(c.loss_quantity) : 0), 0);

      const item = items.find(s => s.name === supplyName);

      const purchases = supplyCosts.filter(sc => {
        if (selectedRestaurant !== 'all' && sc.restaurant_id !== selectedRestaurant) return false;
        if (sc.date < dateRange.from || sc.date > dateRange.to) return false;
        return sc.supply_item_name === supplyName;
      });
      const totalPurchased = purchases.reduce((sum, p) => sum + (p.quantity_purchased || 0), 0);

      const salesMovements = stockMovements.filter(m => {
        if (selectedRestaurant !== 'all' && m.restaurant_id !== selectedRestaurant) return false;
        const mDate = (m.transaction_date || m.created_date || '').slice(0, 10);
        if (mDate < dateRange.from || mDate > dateRange.to) return false;
        return m.product_name === supplyName && m.movement_type === 'sale';
      });
      const totalSold = salesMovements.reduce((sum, m) => sum + Math.abs(m.quantity || 0), 0);

      if (totalLossQty > 0 || totalGainQty > 0) {
        const counters = [...new Set(counts.map(c => c.counted_by_name).filter(Boolean))];
        const lastCount = counts[counts.length - 1];

        results.push({
          name: supplyName,
          category: item?.category || '—',
          area: item?.area || lastCount?.area || '',
          unit: item?.unit_of_measure || '',
          unitCost: item?.average_unit_cost || 0,
          totalExpected,
          totalActual,
          lossQty: totalLossQty,
          lossValue: totalLossValue,
          gainQty: totalGainQty,
          totalPurchased,
          totalSold,
          countSessions: counts.length,
          counters,
          lastCountedBy: lastCount?.counted_by_name || '',
          lastCountedByEmail: lastCount?.counted_by_email || '',
          lastCountType: lastCount?.count_type || 'xlsx',
          lastCountDate: lastCount?.date || '',
          lastCountCreatedDate: lastCount?.created_date || '',
          _lossType: 'internal'
        });
      }
    });

    return results.sort((a, b) => b.lossValue - a.lossValue);
  }, [inventoryCounts, supplyItems, supplyCosts, stockMovements, selectedRestaurant, dateRange]);

  // External losses from wasteRecords (pérdidas externas por faltante de proveedor)
  const externalLosses = useMemo(() => {
    const items = supplyItems.filter(s => selectedRestaurant === 'all' || s.restaurant_id === selectedRestaurant);
    
    const periodWaste = wasteRecords.filter(w => {
      if (selectedRestaurant !== 'all' && w.restaurant_id !== selectedRestaurant) return false;
      if (w.date < dateRange.from || w.date > dateRange.to) return false;
      return w.notes?.includes('Pérdida externa');
    });

    if (periodWaste.length === 0) return [];

    const byItem = {};
    periodWaste.forEach(w => {
      const key = w.supply_name;
      if (!byItem[key]) byItem[key] = { records: [], totalQty: 0, totalValue: 0 };
      byItem[key].records.push(w);
      byItem[key].totalQty += w.quantity || 0;
      byItem[key].totalValue += w.estimated_value || 0;
    });

    return Object.entries(byItem).map(([supplyName, data]) => {
      const item = items.find(s => s.name === supplyName);
      const lastRecord = data.records[data.records.length - 1];
      
      // Parse ALL records and sum facturado/recibido across all purchases
      const parseField = (notesStr, field) => {
        const match = notesStr.match(new RegExp(`${field}:([^|]+)`));
        return match ? match[1].trim() : '';
      };
      
      let totalInvoiced = 0;
      let totalReceived = 0;
      const suppliers = new Set();
      const invoices = new Set();
      
      data.records.forEach(w => {
        const notesStr = w.notes || '';
        const inv = parseFloat(parseField(notesStr, 'facturado')) || 0;
        const rec = parseFloat(parseField(notesStr, 'recibido')) || 0;
        const sup = parseField(notesStr, 'proveedor');
        const invNum = parseField(notesStr, 'factura');
        totalInvoiced += inv;
        totalReceived += rec;
        if (sup && sup !== 'N/A') suppliers.add(sup);
        if (invNum && invNum !== 'N/A') invoices.add(invNum);
      });
      
      // Fallback: if parsing failed for all records
      if (totalInvoiced === 0) totalInvoiced = data.totalQty;
      
      return {
        name: supplyName,
        category: item?.category || '—',
        area: item?.area || '',
        unit: item?.unit_of_measure || lastRecord?.unit || '',
        unitCost: item?.average_unit_cost || 0,
        totalExpected: 0,
        totalActual: 0,
        lossQty: data.totalQty,
        lossValue: data.totalValue,
        gainQty: 0,
        totalPurchased: 0,
        totalSold: 0,
        countSessions: data.records.length,
        counters: [],
        lastCountedBy: lastRecord?.registered_by || '',
        lastCountedByEmail: '',
        lastCountType: '',
        lastCountDate: lastRecord?.date || '',
        lastCountCreatedDate: lastRecord?.created_date || '',
        _lossType: 'external',
        _supplierName: [...suppliers].join(', ') || '',
        _invoiceNumber: [...invoices].join(', ') || '',
        _receivedQty: totalReceived,
        _invoicedQty: totalInvoiced,
        _purchaseCount: data.records.length
      };
    }).sort((a, b) => b.lossValue - a.lossValue);
  }, [wasteRecords, supplyItems, selectedRestaurant, dateRange]);

  // Combine based on filter
  const lossAnalysis = useMemo(() => {
    if (lossType === 'external') return externalLosses;
    return internalLosses;
  }, [internalLosses, externalLosses, lossType]);

  const filtered = lossAnalysis.filter(item => 
    !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalLossValue = filtered.reduce((sum, i) => sum + i.lossValue, 0);
  const totalLossQty = filtered.reduce((sum, i) => sum + i.lossQty, 0);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar insumo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 h-10 rounded-xl"
          />
        </div>
        {/* Tipo de pérdida */}
        <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
          {[
            { key: 'external', label: 'Externas', icon: '🚚', count: externalLosses.length },
            { key: 'unexplained', label: 'Sin explicación', icon: '❓', count: internalLosses.length }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setLossType(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                lossType === t.key
                  ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <Badge className={`text-[9px] px-1.5 py-0 ${lossType === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {t.count}
              </Badge>
            </button>
          ))}
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[160px] h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Este mes</SelectItem>
            <SelectItem value="last">Mes anterior</SelectItem>
            <SelectItem value="all">Todo el historial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-100">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Total Pérdidas</p>
            <p className="text-2xl font-black text-red-700 mt-1">{formatCurrency(totalLossValue, currency)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Unidades Perdidas</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{totalLossQty}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Insumos Afectados</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla compacta con filas expandibles */}
      {filtered.length > 0 ? (
        <Card className="bg-white border-0 shadow-lg rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                  <th className="py-3 px-3 text-left text-xs font-bold text-gray-500 uppercase w-10">#</th>
                  <th className="py-3 px-3 text-left text-xs font-bold text-gray-500 uppercase">Insumo</th>
                  <th className="py-3 px-3 text-left text-xs font-bold text-gray-500 uppercase">Categoría</th>
                  <th className="py-3 px-3 text-right text-xs font-bold text-gray-500 uppercase">Pérdida</th>
                  <th className="py-3 px-3 text-right text-xs font-bold text-gray-500 uppercase">Valor</th>
                  <th className="py-3 px-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
                  <th className="py-3 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item, idx) => (
                  <ExpandableRow key={item.name} item={item} idx={idx} currency={currency} user={user} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingDown className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay pérdidas detectadas</p>
            <p className="text-sm text-gray-400 mt-1">Aquí se muestran pérdidas externas (faltantes de proveedor) y pérdidas sin explicación detectadas en conteos</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}