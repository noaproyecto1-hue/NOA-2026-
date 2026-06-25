import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Truck, ArrowLeft, Package, BarChart3, ChevronRight, ChevronDown, ChevronLeft, ShoppingBag, Building2, Hash, CreditCard, Clock, Trophy, BookUser } from "lucide-react";
import { formatCurrency } from '@/components/utils/currencyHelper';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Cell } from 'recharts';
import SupplierRankingPanel from '@/components/inventory/SupplierRankingPanel';
import { parseISO } from 'date-fns';

const PAGE_SIZE = 10;

const COLORS = ['#47587A', '#10b981', '#f43f5e', '#f97316', '#47587A', '#0ea5e9', '#47587A', '#47587A', '#eab308', '#3b82f6'];
const GRADIENTS = [
  'from-indigo-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-orange-500 to-amber-600',
  'from-violet-500 to-purple-600',
  'from-sky-500 to-cyan-600',
];

export default function SupplierHistoryTab({
  selectedRestaurant,
  accessibleRestaurantIds,
  restaurants = [],
  suppliers = [],
  currency = 'USD'
}) {
  const [searchSupplier, setSearchSupplier] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('all');
  const [expandedCats, setExpandedCats] = useState({});
  const [activeView, setActiveView] = useState('directory'); // 'directory' | 'ranking'
  const [dirPage, setDirPage] = useState(1);

  const toggleCat = (name) => setExpandedCats(prev => ({ ...prev, [name]: !prev[name] }));

  // Use .filter({ restaurant_id }) instead of .list() to reduce payload and avoid rate limiting
  const { data: supplyCosts = [] } = useQuery({
    queryKey: ['supplyCostsForSuppliers', accessibleRestaurantIds],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        accessibleRestaurantIds.map(id => base44.entities.SupplyCost.filter({ restaurant_id: id }, '-date', 500))
      );
      return results.flat();
    },
    enabled: accessibleRestaurantIds.length > 0
  });

  const { data: opexData = [] } = useQuery({
    queryKey: ['opexForSuppliers', accessibleRestaurantIds],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        accessibleRestaurantIds.map(id => base44.entities.OpEx.filter({ restaurant_id: id }, '-date', 500))
      );
      return results.flat();
    },
    enabled: accessibleRestaurantIds.length > 0
  });

  const filteredTransactions = useMemo(() => {
    const supplyTx = supplyCosts
      .filter(c => (selectedRestaurant === 'all' || c.restaurant_id === selectedRestaurant) && c.supplier)
      .map(c => ({
        id: c.id, date: c.date, supplier: c.supplier, type: 'supply',
        category: c.supply_category || '—',
        detail: c.supply_item_name || c.notes || c.supply_category || '—',
        quantity: c.quantity_purchased || 0, unit: c.unit_of_measure || '',
        total: c.total_cost || 0, paymentStatus: c.payment_status, restaurantId: c.restaurant_id
      }));

    const opexTx = opexData
      .filter(o => (selectedRestaurant === 'all' || o.restaurant_id === selectedRestaurant) && o.supplier)
      .map(o => ({
        id: o.id, date: o.date, supplier: o.supplier, type: 'opex',
        category: o.cost_center_name || o.type || '—',
        detail: o.category || o.cost_center_name || o.description || '—',
        quantity: 0, unit: '',
        total: o.amount || 0, paymentStatus: o.payment_status, restaurantId: o.restaurant_id
      }));

    return [...supplyTx, ...opexTx].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [supplyCosts, opexData, selectedRestaurant]);

  const globalSummary = useMemo(() => {
    const map = {};
    let totalAmount = 0;
    let totalPending = 0;

    filteredTransactions.forEach(t => {
      totalAmount += t.total;
      if (t.paymentStatus !== 'pagado') totalPending += t.total;
      if (!map[t.supplier]) {
        map[t.supplier] = { name: t.supplier, total: 0, count: 0, categories: new Set(), pending: 0 };
      }
      map[t.supplier].total += t.total;
      map[t.supplier].count++;
      map[t.supplier].categories.add(t.category);
      if (t.paymentStatus !== 'pagado') map[t.supplier].pending += t.total;
    });

    const suppliersList = Object.values(map)
      .map(s => ({ ...s, categories: [...s.categories] }))
      .sort((a, b) => b.total - a.total);

    return { totalAmount, totalPending, suppliersList };
  }, [filteredTransactions]);

  const supplierData = useMemo(() => {
    if (selectedSupplierId === 'all') return null;
    const txs = filteredTransactions.filter(t => t.supplier === selectedSupplierId);

    let totalAmount = 0;
    let totalPending = 0;
    let supplyTotal = 0;
    let opexTotal = 0;
    const catMap = {};

    txs.forEach(t => {
      totalAmount += t.total;
      if (t.paymentStatus !== 'pagado') totalPending += t.total;
      if (t.type === 'supply') supplyTotal += t.total;
      else opexTotal += t.total;

      if (!catMap[t.category]) catMap[t.category] = { total: 0, count: 0, type: t.type, items: {} };
      catMap[t.category].total += t.total;
      catMap[t.category].count++;

      const itemKey = t.detail || '—';
      if (!catMap[t.category].items[itemKey]) catMap[t.category].items[itemKey] = { total: 0, count: 0, qty: 0, unit: t.unit };
      catMap[t.category].items[itemKey].total += t.total;
      catMap[t.category].items[itemKey].count++;
      catMap[t.category].items[itemKey].qty += t.quantity;
    });

    const catChart = Object.entries(catMap)
      .map(([name, d]) => ({ name: name.length > 20 ? name.substring(0, 20) + '…' : name, fullName: name, value: d.total }))
      .sort((a, b) => b.value - a.value);

    const categories = Object.entries(catMap)
      .map(([name, d]) => ({
        name,
        total: d.total,
        count: d.count,
        type: d.type,
        percent: totalAmount > 0 ? ((d.total / totalAmount) * 100) : 0,
        items: Object.entries(d.items)
          .map(([itemName, itemData]) => ({ name: itemName, ...itemData }))
          .sort((a, b) => b.total - a.total)
      }))
      .sort((a, b) => b.total - a.total);

    return { txs, totalAmount, totalPending, supplyTotal, opexTotal, catChart, categories };
  }, [filteredTransactions, selectedSupplierId]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-sm">
          <p className="font-medium mb-0.5">{payload[0].payload.fullName || payload[0].payload.name}</p>
          <p className="font-bold text-emerald-300">{formatCurrency(payload[0].value, currency)}</p>
        </div>
      );
    }
    return null;
  };

  // ===================== VISTA DETALLE =====================
  if (selectedSupplierId !== 'all' && supplierData) {
    const supplierIdx = globalSummary.suppliersList.findIndex(s => s.name === selectedSupplierId);
    const gradient = GRADIENTS[supplierIdx % GRADIENTS.length];

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 max-w-5xl mx-auto pb-10">
        {/* Hero Header */}
        <div className={`relative bg-gradient-to-r ${gradient} rounded-3xl p-6 md:p-8 text-white overflow-hidden shadow-lg`}>
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-luminosity" 
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1586528116311-ad8ed7c80a30?q=80&w=2070&auto=format&fit=crop)' }} 
          />
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedSupplierId('all'); setExpandedCats({}); }}
                className="text-white/80 hover:text-white hover:bg-white/10 -ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl font-bold mb-4">
                  {selectedSupplierId.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold">{selectedSupplierId}</h2>
                <p className="text-white/70 text-sm mt-1">{supplierData.txs.length} transacciones en el período</p>
              </div>
              <div className="flex gap-8">
                <div>
                  <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-1.5">Total</p>
                  <p className="text-4xl md:text-5xl font-black tracking-tighter">{formatCurrency(supplierData.totalAmount, currency)}</p>
                </div>
                {supplierData.totalPending > 0 && (
                  <div className="border-l border-white/20 pl-8">
                    <p className="text-amber-200 text-[11px] font-bold uppercase tracking-widest mb-1.5">Pendiente</p>
                    <p className="text-4xl md:text-5xl font-black tracking-tighter text-amber-200">{formatCurrency(supplierData.totalPending, currency)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chips Insumos / OpEx */}
            <div className="flex gap-3 mt-6">
              {supplierData.supplyTotal > 0 && (
                <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-white/80" />
                  <div>
                    <p className="text-[10px] text-white/60 font-medium uppercase">Insumos</p>
                    <p className="text-sm font-bold">{formatCurrency(supplierData.supplyTotal, currency)}</p>
                  </div>
                </div>
              )}
              {supplierData.opexTotal > 0 && (
                <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-white/80" />
                  <div>
                    <p className="text-[10px] text-white/60 font-medium uppercase">Gastos Op.</p>
                    <p className="text-sm font-bold">{formatCurrency(supplierData.opexTotal, currency)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico de Barras Horizontal */}
        {supplierData.catChart.length > 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" /> Gasto por Categoría
            </p>
            <div style={{ height: Math.max(140, supplierData.catChart.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierData.catChart} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} width={150} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                    {supplierData.catChart.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Desglose Clickeable */}
        <div className="space-y-2.5">
          <p className="text-sm font-bold text-gray-800 px-1">Desglose por Categoría</p>
          {supplierData.categories.map((cat, ci) => {
            const isOpen = expandedCats[cat.name];
            const color = COLORS[ci % COLORS.length];
            return (
              <div key={cat.name} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Cabecera clickeable */}
                <button
                  onClick={() => toggleCat(cat.name)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}12` }}>
                    {cat.type === 'supply'
                      ? <ShoppingBag className="w-5 h-5" style={{ color }} />
                      : <Building2 className="w-5 h-5" style={{ color }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-gray-900 text-sm">{cat.name}</p>
                      <p className="font-bold text-gray-900 text-sm ml-4 shrink-0">{formatCurrency(cat.total, currency)}</p>
                    </div>
                    {/* Barra de progreso */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${cat.percent}%` }}
                          transition={{ duration: 0.6, delay: ci * 0.1 }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-500 w-12 text-right">{cat.percent.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Hash className="w-3 h-3" />{cat.count} {cat.type === 'opex' ? 'gastos' : 'compras'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {cat.type === 'supply' ? 'Insumo' : 'Gasto Operativo'}
                      </span>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 ml-2"
                  >
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </motion.div>
                </button>

                {/* Items expandibles */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-100 bg-gray-50/30">
                        {cat.items.map((item, ii) => {
                          const itemPercent = cat.total > 0 ? (item.total / cat.total) * 100 : 0;
                          return (
                            <div key={ii} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-white/80 transition-colors">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-gray-800 font-semibold truncate">{item.name}</p>
                                  <p className="text-sm font-bold text-gray-900 ml-4 shrink-0">{formatCurrency(item.total, currency)}</p>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  {item.qty > 0 && (
                                    <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                                      {item.qty} {item.unit}
                                    </span>
                                  )}
                                  {item.count > 1 && (
                                    <span className="text-[11px] text-gray-400">
                                      {item.count} {cat.type === 'opex' ? 'gastos' : 'compras'}
                                    </span>
                                  )}
                                  <span className="text-[11px] font-medium ml-auto" style={{ color }}>
                                    {itemPercent.toFixed(0)}% de la categoría
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  }

  // ===================== VISTA GENERAL =====================
  const filteredSuppliers = globalSummary.suppliersList.filter(s =>
    !searchSupplier || s.name.toLowerCase().includes(searchSupplier.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSuppliers.length / PAGE_SIZE);
  const pagedSuppliers = filteredSuppliers.slice((dirPage - 1) * PAGE_SIZE, dirPage * PAGE_SIZE);

  const handleSearch = (val) => { setSearchSupplier(val); setDirPage(1); };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">

      {/* Hero Banner */}
      <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 overflow-hidden shadow-xl">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-luminosity" 
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1586528116311-ad8ed7c80a30?q=80&w=2070&auto=format&fit=crop)' }} 
        />
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-lg">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Proveedores</h2>
              <p className="text-sm text-white/50 mt-0.5">Historial completo de todos tus socios comerciales</p>
            </div>
          </div>

          {/* Métricas dentro del banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col justify-center min-h-[100px] hover:bg-white/15 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <p className="text-[10px] sm:text-xs text-emerald-400 font-bold uppercase tracking-widest">Total Invertido</p>
              </div>
              <p className="text-2xl sm:text-3xl font-black tracking-tighter text-white truncate">{formatCurrency(globalSummary.totalAmount, currency, { compact: true })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col justify-center min-h-[100px] hover:bg-white/15 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <p className="text-[10px] sm:text-xs text-amber-400 font-bold uppercase tracking-widest">Deuda Pendiente</p>
              </div>
              <p className="text-2xl sm:text-3xl font-black tracking-tighter text-amber-300 truncate">{formatCurrency(globalSummary.totalPending, currency, { compact: true })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col justify-center min-h-[100px] hover:bg-white/15 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <p className="text-[10px] sm:text-xs text-blue-400 font-bold uppercase tracking-widest">Proveedores Activos</p>
              </div>
              <p className="text-2xl sm:text-3xl font-black tracking-tighter text-white">{globalSummary.suppliersList.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm gap-1">
          <button
            onClick={() => setActiveView('directory')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeView === 'directory'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <BookUser className="w-4 h-4" />
            Directorio
          </button>
          <button
            onClick={() => setActiveView('ranking')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeView === 'ranking'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Top Proveedores
          </button>
        </div>
      </div>

      {/* ── DIRECTORIO ── */}
      {activeView === 'directory' && (
        <motion.div key="directory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
          {/* Search + count */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar proveedor..."
                value={searchSupplier}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-11 h-11 bg-white border-transparent shadow-sm rounded-2xl text-sm focus-visible:ring-indigo-500"
              />
            </div>
            <span className="text-xs text-gray-400 font-semibold shrink-0 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm">
              {filteredSuppliers.length} proveedor{filteredSuppliers.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {/* Grid de tarjetas */}
          {pagedSuppliers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pagedSuppliers.map((supplier, idx) => {
                const realIdx = (dirPage - 1) * PAGE_SIZE + idx;
                const gradient = GRADIENTS[realIdx % GRADIENTS.length];
                const pct = globalSummary.totalAmount > 0 ? ((supplier.total / globalSummary.totalAmount) * 100) : 0;
                return (
                  <motion.div
                    key={supplier.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => { setSelectedSupplierId(supplier.name); setExpandedCats({}); }}
                    className="bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all cursor-pointer group overflow-hidden flex flex-col"
                  >
                    <div className="flex items-center gap-4 p-5">
                      <div className={`w-12 h-12 bg-gradient-to-br ${gradient} text-white rounded-xl flex items-center justify-center font-black text-xl shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                        {supplier.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-gray-900 text-sm truncate pr-2">{supplier.name}</h3>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 shrink-0 transition-colors" />
                        </div>
                        <p className="text-xl font-black text-gray-900 tracking-tight">{formatCurrency(supplier.total, currency, { compact: true })}</p>
                      </div>
                    </div>
                    <div className="px-5 pb-4 space-y-3">
                      {/* Barra */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full bg-gradient-to-r ${gradient}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.04 }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-gray-400 w-12 text-right">{pct.toFixed(1)}%</span>
                      </div>
                      {/* Pills */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-gray-500 font-semibold bg-gray-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Hash className="w-3 h-3" />{supplier.count} transacciones
                        </span>
                        {supplier.pending > 0 && (
                          <span className="text-[11px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <Clock className="w-3 h-3" />Pendiente: {formatCurrency(supplier.pending, currency, { compact: true })}
                          </span>
                        )}
                        {supplier.categories.slice(0, 2).map(cat => (
                          <span key={cat} className="bg-gray-100 text-gray-500 font-medium text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-lg truncate max-w-[80px]">
                            {cat}
                          </span>
                        ))}
                        {supplier.categories.length > 2 && (
                          <span className="text-[10px] text-gray-400 font-medium">+{supplier.categories.length - 2}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-gray-100">
              <Package className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900">Directorio Vacío</h3>
              <p className="text-gray-500 text-sm mt-1">Ajusta tu búsqueda o el rango de fechas</p>
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDirPage(p => Math.max(1, p - 1))}
                disabled={dirPage === 1}
                className="rounded-xl"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setDirPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                      page === dirPage
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDirPage(p => Math.min(totalPages, p + 1))}
                disabled={dirPage === totalPages}
                className="rounded-xl"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* ── RANKING ── */}
      {activeView === 'ranking' && (
        <motion.div key="ranking" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-h-[600px]">
          <SupplierRankingPanel
            supplyCosts={supplyCosts}
            opexData={opexData}
            selectedRestaurant={selectedRestaurant}
            currency={currency}
          />
        </motion.div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156,163,175,0.3); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156,163,175,0.5); }
      `}</style>
    </div>
  );
}