import React, { useMemo, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ClipboardCheck, Calendar, User, ChevronDown, ChevronUp, Package, AlertTriangle, TrendingDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { formatCurrency } from '@/components/utils/currencyHelper';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatDateInUserTz, getUserTimezone } from '@/components/utils/timezoneHelper';
import { formatInTimeZone } from 'date-fns-tz';

function CountRow({ item, idx, currency, user }) {
  const [expanded, setExpanded] = useState(false);
  const hasLoss = item.lossQty > 0;
  const hasGain = item.gainQty > 0;

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className={`cursor-pointer transition-colors hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${expanded ? 'bg-blue-50/50' : ''}`}
      >
        <td className="py-2.5 px-3">
          <span className="font-semibold text-gray-900 text-sm">{item.name}</span>
        </td>
        <td className="py-2.5 px-3">
          <Badge className="bg-green-100 text-green-700 border-0 text-xs px-2 py-0.5">{item.category}</Badge>
        </td>
        <td className="py-2.5 px-3 text-center">
          <span className="text-sm text-gray-700">{item.totalExpected} {item.unit}</span>
        </td>
        <td className="py-2.5 px-3 text-center">
          <span className="text-sm font-bold text-gray-900">{item.totalActual} {item.unit}</span>
        </td>
        <td className="py-2.5 px-3 text-right">
          {hasLoss ? (
            <span className="text-sm font-bold text-red-600">-{item.lossQty} {item.unit}</span>
          ) : hasGain ? (
            <span className="text-sm font-bold text-emerald-600">+{item.gainQty} {item.unit}</span>
          ) : (
            <span className="text-sm text-gray-400">0</span>
          )}
        </td>
        <td className="py-2.5 px-3 text-right">
          {hasLoss ? (
            <span className="text-sm font-black text-red-600">{formatCurrency(item.lossValue, currency)}</span>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
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
          <td colSpan={8} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
              <div className="text-center bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Esperado (sistema)</p>
                <p className="text-sm font-bold text-gray-700">{item.totalExpected} {item.unit}</p>
              </div>
              <div className="text-center bg-white rounded-xl p-3 border border-blue-100">
                <p className="text-[10px] text-blue-500 uppercase font-bold mb-1">Contado (real)</p>
                <p className="text-sm font-bold text-blue-600">{item.totalActual} {item.unit}</p>
              </div>
              <div className={`text-center bg-white rounded-xl p-3 border ${hasLoss ? 'border-red-100' : hasGain ? 'border-emerald-100' : 'border-gray-100'}`}>
                <p className={`text-[10px] uppercase font-bold mb-1 ${hasLoss ? 'text-red-500' : hasGain ? 'text-emerald-500' : 'text-gray-400'}`}>Diferencia</p>
                <p className={`text-sm font-bold ${hasLoss ? 'text-red-600' : hasGain ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {hasLoss ? `-${item.lossQty}` : hasGain ? `+${item.gainQty}` : '0'} {item.unit}
                </p>
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
              <span className="text-gray-400">· {item.countSessions} conteo{item.countSessions !== 1 ? 's' : ''}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function InventoryCountsPanel({
  inventoryCounts = [],
  supplyItems = [],
  selectedRestaurant = 'all',
  currency = 'USD'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('current');
  const [filterDate, setFilterDate] = useState(''); // specific date YYYY-MM-DD
  const [filterResult, setFilterResult] = useState('all'); // 'all', 'loss', 'gain', 'ok'

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    if (filterDate) {
      return { from: filterDate, to: filterDate };
    }
    if (filterMonth === 'current') {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    } else if (filterMonth === 'last') {
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10), to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10) };
    }
    return { from: '2020-01-01', to: new Date().toISOString().slice(0, 10) };
  }, [filterMonth, filterDate]);

  const countAnalysis = useMemo(() => {
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
      const counters = [...new Set(counts.map(c => c.counted_by_name).filter(Boolean))];
      const lastCount = counts[counts.length - 1];

      results.push({
        name: supplyName,
        category: item?.category || '—',
        area: item?.area || lastCount?.area || '',
        unit: item?.unit_of_measure || '',
        totalExpected,
        totalActual,
        lossQty: totalLossQty,
        lossValue: totalLossValue,
        gainQty: totalGainQty,
        countSessions: counts.length,
        counters,
        lastCountDate: lastCount?.date || '',
        lastCountCreatedDate: lastCount?.created_date || '',
        lastCountType: lastCount?.count_type || 'xlsx',
      });
    });

    return results.sort((a, b) => b.lossValue - a.lossValue);
  }, [inventoryCounts, supplyItems, selectedRestaurant, dateRange]);

  const filtered = countAnalysis.filter(item => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterResult === 'loss') return item.lossQty > 0;
    if (filterResult === 'gain') return item.gainQty > 0;
    if (filterResult === 'ok') return item.lossQty === 0 && item.gainQty === 0;
    return true;
  });

  const totalLossValue = filtered.reduce((sum, i) => sum + i.lossValue, 0);
  const totalCountSessions = new Set(inventoryCounts
    .filter(c => {
      if (selectedRestaurant !== 'all' && c.restaurant_id !== selectedRestaurant) return false;
      return c.date >= dateRange.from && c.date <= dateRange.to;
    })
    .map(c => c.session_id || c.date)
  ).size;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar insumo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10 rounded-xl" />
        </div>
        <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'loss', label: '📉 Con pérdida' },
            { key: 'gain', label: '📈 Con sobrante' },
            { key: 'ok', label: '✓ Sin diferencia' }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setFilterResult(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterResult === t.key
                  ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Select value={filterDate ? 'date' : filterMonth} onValueChange={(val) => {
          if (val === 'date') return; // handled by input
          setFilterDate('');
          setFilterMonth(val);
        }}>
          <SelectTrigger className="w-[160px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Este mes</SelectItem>
            <SelectItem value="last">Mes anterior</SelectItem>
            <SelectItem value="all">Todo</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <button className={`flex items-center gap-2 pl-3 pr-3 h-10 rounded-xl border text-sm transition-all ${
              filterDate 
                ? 'border-purple-300 bg-purple-50 text-purple-700 font-semibold ring-1 ring-purple-200' 
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}>
              <Calendar className="w-4 h-4 text-gray-400" />
              {filterDate 
                ? `${filterDate.slice(8,10)}/${filterDate.slice(5,7)}/${filterDate.slice(0,4)}`
                : 'Día específico'
              }
              {filterDate && (
                <span
                  onClick={(e) => { e.stopPropagation(); setFilterDate(''); setFilterMonth('current'); }}
                  className="text-purple-400 hover:text-purple-600 text-xs font-bold ml-1"
                >✕</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarPicker
              mode="single"
              selected={filterDate ? new Date(filterDate + 'T12:00:00') : undefined}
              onSelect={(date) => {
                if (date) {
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, '0');
                  const d = String(date.getDate()).padStart(2, '0');
                  setFilterDate(`${y}-${m}-${d}`);
                  setFilterMonth('');
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Insumos Contados</p>
            <p className="text-2xl font-black text-purple-700 mt-1">{countAnalysis.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Sesiones de Conteo</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{totalCountSessions}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Valor Pérdidas Conteo</p>
            <p className="text-2xl font-black text-red-700 mt-1">{formatCurrency(totalLossValue, currency)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Explicación */}
      <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-100">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-purple-800">Registros de Conteo</p>
              <p className="text-xs text-purple-600 mt-1">
                Aquí se muestran todos los resultados de tus conteos de inventario (diarios y mensuales). 
                Las diferencias entre lo esperado y lo contado se usan en el <strong>Diagnóstico</strong> para analizar las causas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      {filtered.length > 0 ? (
        <Card className="bg-white border-0 shadow-lg rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                  <th className="py-3 px-3 text-left text-xs font-bold text-gray-500 uppercase">Insumo</th>
                  <th className="py-3 px-3 text-left text-xs font-bold text-gray-500 uppercase">Categoría</th>
                  <th className="py-3 px-3 text-center text-xs font-bold text-gray-500 uppercase">Esperado</th>
                  <th className="py-3 px-3 text-center text-xs font-bold text-gray-500 uppercase">Contado</th>
                  <th className="py-3 px-3 text-right text-xs font-bold text-gray-500 uppercase">Diferencia</th>
                  <th className="py-3 px-3 text-right text-xs font-bold text-gray-500 uppercase">Valor</th>
                  <th className="py-3 px-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
                  <th className="py-3 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item, idx) => (
                  <CountRow key={item.name} item={item} idx={idx} currency={currency} user={user} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay registros de conteo</p>
            <p className="text-sm text-gray-400 mt-1">Realiza un conteo diario o mensual</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}