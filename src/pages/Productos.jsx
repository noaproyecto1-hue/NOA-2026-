import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Package, Search, Loader2, ArrowLeft, Building2, TrendingUp, TrendingDown,
  Boxes, Receipt, DollarSign, Tag, ListChecks, Layers, ChefHat, Plus, X, Trash2, Check,
} from 'lucide-react';

// ───────── helpers ─────────
function clp(n) {
  return (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}
function clpShort(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v}`;
}
function fdate(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString('es-CL');
}
function unitPrice(c) {
  const qty = Number(c.quantity_purchased) || 0;
  const base = Number(c.subtotal) || Number(c.total_cost) || 0;
  return qty > 0 ? base / qty : 0;
}

// ───────── data hook ─────────
function useSupplyCosts() {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });
  return useQuery({
    queryKey: ['supply-costs', user?.restaurant_ids],
    queryFn: async () => {
      const rid = user?.restaurant_ids?.[0];
      const all = rid ? await base44.entities.SupplyCost.filter({ restaurant_id: rid }) : await base44.entities.SupplyCost.list();
      return (all || []).filter((c) => c.supply_type !== 'opex' && (c.supply_item_name || c.supply_name));
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

// ───────── main page ─────────
export default function Productos() {
  const { data: costs = [], isLoading } = useSupplyCosts();
  const [view, setView] = useState({ kind: 'list' });

  if (isLoading) {
    return <div className="p-6 flex items-center gap-2 text-gray-500 font-sans"><Loader2 className="w-5 h-5 animate-spin" /> Cargando catálogo…</div>;
  }

  if (view.kind === 'insumo') {
    return <InsumoDetail name={view.name} costs={costs} onBack={() => setView({ kind: 'list' })} />;
  }
  if (view.kind === 'item') {
    return <ItemDetail name={view.name} costs={costs} onBack={() => setView({ kind: 'list' })} onSupplier={(s) => setView({ kind: 'supplier', supplier: s })} />;
  }
  if (view.kind === 'supplier') {
    return <SupplierDetail supplier={view.supplier} costs={costs} onBack={() => setView({ kind: 'list' })} onItem={(n) => setView({ kind: 'item', name: n })} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-noa-navy font-display">Producto y Servicio</h1>
        <p className="text-gray-600 mt-1">Insumos maestros e items de facturas, agrupados para comparar precios y proveedores.</p>
      </div>

      <Tabs defaultValue="insumos">
        <TabsList>
          <TabsTrigger value="insumos"><Boxes className="w-4 h-4 mr-1.5" /> Insumos maestros</TabsTrigger>
          <TabsTrigger value="items"><ListChecks className="w-4 h-4 mr-1.5" /> Items de facturas</TabsTrigger>
          <TabsTrigger value="categorias"><Layers className="w-4 h-4 mr-1.5" /> Categorías</TabsTrigger>
          <TabsTrigger value="elaborados"><ChefHat className="w-4 h-4 mr-1.5" /> Elaborados</TabsTrigger>
        </TabsList>
        <TabsContent value="insumos" className="mt-4">
          <InsumosMaestros costs={costs} onOpen={(name) => setView({ kind: 'insumo', name })} />
        </TabsContent>
        <TabsContent value="items" className="mt-4">
          <ItemsFacturas costs={costs} onItem={(n) => setView({ kind: 'item', name: n })} onSupplier={(s) => setView({ kind: 'supplier', supplier: s })} />
        </TabsContent>
        <TabsContent value="categorias" className="mt-4">
          <Categorias costs={costs} onItem={(n) => setView({ kind: 'item', name: n })} />
        </TabsContent>
        <TabsContent value="elaborados" className="mt-4">
          <Elaborados costs={costs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────── KPI card ─────────
function Kpi({ icon: Icon, label, value, highlight }) {
  return (
    <Card className={highlight ? 'border-noa-orange/30 bg-noa-orange/5' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-1.5 text-gray-500 mb-2">
          <Icon className="w-4 h-4" /><span className="text-xs">{label}</span>
        </div>
        <p className={`text-2xl font-bold font-display ${highlight ? 'text-noa-navy' : 'text-gray-900'}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// mini sparkline de precio
function Spark({ data }) {
  if (!data || data.length < 2) return <span className="text-gray-300 text-xs">—</span>;
  const first = data[0].v, last = data[data.length - 1].v;
  const up = last > first;
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={up ? '#DC2626' : '#16A34A'} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ───────── Insumos maestros (agrupado por nombre) ─────────
function InsumosMaestros({ costs, onOpen }) {
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const map = {};
    for (const c of costs) {
      const name = c.supply_item_name || c.supply_name;
      if (!name) continue;
      if (!map[name]) map[name] = { name, items: 0, suppliers: new Set(), totalNeto: 0, lastDate: '', lastPrice: 0, unit: c.unit_of_measure || '', series: [] };
      const g = map[name];
      g.items += 1;
      if (c.supplier) g.suppliers.add(c.supplier);
      g.totalNeto += Number(c.subtotal) || Number(c.total_cost) || 0;
      const d = (c.date || '').slice(0, 10);
      if (d && d >= g.lastDate) { g.lastDate = d; g.lastPrice = unitPrice(c); g.unit = c.unit_of_measure || g.unit; }
      if (d) g.series.push({ d, v: unitPrice(c) });
    }
    return Object.values(map).map((g) => ({
      ...g,
      suppliers: g.suppliers.size,
      series: g.series.sort((a, b) => a.d.localeCompare(b.d)),
    })).sort((a, b) => b.totalNeto - a.totalNeto);
  }, [costs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  const withUnit = groups.filter((g) => g.unit).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi icon={Boxes} label="Insumos totales" value={groups.length.toLocaleString('es-CL')} />
        <Kpi icon={Tag} label="Con unidad base" value={withUnit.toLocaleString('es-CL')} />
        <Kpi icon={Receipt} label="Resultados del filtro" value={filtered.length.toLocaleString('es-CL')} highlight />
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, palabra clave o código" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Tendencia</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Proveedores</TableHead>
                <TableHead>Última compra</TableHead>
                <TableHead className="text-right">Precio última</TableHead>
                <TableHead className="text-right">Total neto comprado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 300).map((g) => (
                <TableRow key={g.name} className="hover:bg-gray-50">
                  <TableCell>
                    <button className="text-noa-orange-dk font-medium hover:underline" onClick={() => onOpen(g.name)}>{g.name}</button>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{g.unit || '—'}</Badge></TableCell>
                  <TableCell><Spark data={g.series} /></TableCell>
                  <TableCell className="text-right text-xs">{g.items}</TableCell>
                  <TableCell className="text-right text-xs">{g.suppliers}</TableCell>
                  <TableCell className="text-xs">{fdate(g.lastDate)}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{clp(g.lastPrice)}</TableCell>
                  <TableCell className="text-right text-xs font-semibold">{clp(g.totalNeto)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ───────── Insumo detail ─────────
function InsumoDetail({ name, costs, onBack }) {
  const rows = useMemo(() => costs.filter((c) => (c.supply_item_name || c.supply_name) === name).sort((a, b) => (a.date || '').localeCompare(b.date || '')), [costs, name]);
  const [metric, setMetric] = useState('precio'); // precio | cantidad | total

  const now = new Date();
  const monthRows = rows.filter((c) => { const d = new Date(c.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const monthQty = monthRows.reduce((s, c) => s + (Number(c.quantity_purchased) || 0), 0);
  const monthAmount = monthRows.reduce((s, c) => s + (Number(c.subtotal) || Number(c.total_cost) || 0), 0);
  const last30 = rows.filter((c) => (now - new Date(c.date)) <= 30 * 864e5);
  const avgPrice = last30.length ? last30.reduce((s, c) => s + unitPrice(c), 0) / last30.length : (rows.length ? unitPrice(rows[rows.length - 1]) : 0);
  const unit = rows.find((c) => c.unit_of_measure)?.unit_of_measure || '';

  const chartData = rows.map((c) => ({
    label: fdate(c.date),
    precio: Math.round(unitPrice(c)),
    cantidad: Number(c.quantity_purchased) || 0,
    total: Number(c.subtotal) || Number(c.total_cost) || 0,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-noa-navy">
        <ArrowLeft className="w-4 h-4" /> Volver al catálogo
      </button>
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-noa-navy font-display">{name}</h1>
        {unit && <Badge className="bg-noa-navy/5 text-noa-navy border-0">Unidad: {unit}</Badge>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={Boxes} label="Compras registradas" value={rows.length.toLocaleString('es-CL')} />
        <Kpi icon={Package} label={`Compra del mes (${unit || 'u'})`} value={monthQty.toLocaleString('es-CL')} />
        <Kpi icon={DollarSign} label="Compra del mes ($)" value={clp(monthAmount)} />
        <Kpi icon={TrendingUp} label="Precio promedio (30d)" value={clp(avgPrice)} highlight />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            {[['precio', 'Precio Unitario'], ['cantidad', 'Cantidad'], ['total', 'Total Comprado']].map(([k, lbl]) => (
              <button key={k} onClick={() => setMetric(k)}
                className={`text-xs px-3 py-1.5 rounded-md ${metric === k ? 'bg-noa-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {lbl}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={metric === 'cantidad' ? (v) => v : clpShort} />
              <Tooltip formatter={(v) => metric === 'cantidad' ? v : clp(v)} />
              <Area type="monotone" dataKey={metric} stroke="#F59E0B" fill="url(#pgrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="overflow-x-auto border rounded-lg bg-white">
        <p className="text-xs font-semibold px-3 py-2 border-b bg-gray-50 text-gray-700">Historial de compras</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead><TableHead>Folio</TableHead>
              <TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Precio unit.</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...rows].reverse().map((c, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{fdate(c.date)}</TableCell>
                <TableCell className="text-xs">{c.supplier || '—'}</TableCell>
                <TableCell className="text-xs">{c.invoice_number || '—'}</TableCell>
                <TableCell className="text-right text-xs">{(Number(c.quantity_purchased) || 0).toLocaleString('es-CL')} {c.unit_of_measure || ''}</TableCell>
                <TableCell className="text-right text-xs">{clp(unitPrice(c))}</TableCell>
                <TableCell className="text-right text-xs font-semibold">{clp(c.subtotal || c.total_cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ───────── Items de facturas ─────────
function ItemsFacturas({ costs, onItem, onSupplier }) {
  const [search, setSearch] = useState('');

  // Variación de precio: comparar último precio del item con el anterior
  const priceVariation = useMemo(() => {
    const byName = {};
    for (const c of costs) {
      const n = c.supply_item_name || c.supply_name;
      if (!n) continue;
      (byName[n] = byName[n] || []).push(c);
    }
    const out = {};
    for (const [n, list] of Object.entries(byName)) {
      const sorted = list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      if (sorted.length >= 2) {
        const prev = unitPrice(sorted[sorted.length - 2]);
        const last = unitPrice(sorted[sorted.length - 1]);
        out[n] = prev > 0 ? ((last - prev) / prev) * 100 : 0;
      } else out[n] = 0;
    }
    return out;
  }, [costs]);

  const filtered = useMemo(() => {
    let list = costs;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => (c.supply_item_name || c.supply_name || '').toLowerCase().includes(q) || (c.supplier || '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [costs, search]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi icon={ListChecks} label="Items de facturas" value={costs.length.toLocaleString('es-CL')} />
        <Kpi icon={Building2} label="Proveedores" value={new Set(costs.map((c) => c.supplier).filter(Boolean)).size.toLocaleString('es-CL')} />
        <Kpi icon={Receipt} label="Resultados del filtro" value={filtered.length.toLocaleString('es-CL')} highlight />
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre de item o proveedor" className="pl-9" />
      </div>

      {filtered.length === 0 ? <EmptyState /> : (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead><TableHead>Proveedor</TableHead><TableHead className="text-right">Variación</TableHead>
                <TableHead>Folio</TableHead><TableHead>Fecha</TableHead>
                <TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Precio unit.</TableHead><TableHead className="text-right">Total bruto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 300).map((c, i) => {
                const name = c.supply_item_name || c.supply_name;
                const v = priceVariation[name] || 0;
                return (
                  <TableRow key={i} className="hover:bg-gray-50">
                    <TableCell><button className="text-noa-orange-dk font-medium hover:underline text-left" onClick={() => onItem(name)}>{name}</button></TableCell>
                    <TableCell><button className="text-noa-navy hover:underline text-xs text-left" onClick={() => onSupplier(c.supplier)}>{c.supplier || '—'}</button></TableCell>
                    <TableCell className="text-right">
                      {Math.abs(v) < 0.01 ? <span className="text-xs text-gray-400">0%</span> : (
                        <span className={`text-xs font-medium inline-flex items-center gap-0.5 ${v > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {v > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{v > 0 ? '+' : ''}{v.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{c.invoice_number || '—'}</TableCell>
                    <TableCell className="text-xs">{fdate(c.date)}</TableCell>
                    <TableCell className="text-right text-xs">{(Number(c.quantity_purchased) || 0).toLocaleString('es-CL')}</TableCell>
                    <TableCell className="text-right text-xs">{clp(unitPrice(c))}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{clp(c.total_cost || c.subtotal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ───────── Item detail ─────────
function ItemDetail({ name, costs, onBack, onSupplier }) {
  const rows = useMemo(() => costs.filter((c) => (c.supply_item_name || c.supply_name) === name).sort((a, b) => (a.date || '').localeCompare(b.date || '')), [costs, name]);
  const prices = rows.map(unitPrice).filter((p) => p > 0);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const totalQty = rows.reduce((s, c) => s + (Number(c.quantity_purchased) || 0), 0);
  const totalHist = rows.reduce((s, c) => s + (Number(c.subtotal) || Number(c.total_cost) || 0), 0);
  const chartData = rows.map((c) => ({ label: fdate(c.date), precio: Math.round(unitPrice(c)) }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-noa-navy">
        <ArrowLeft className="w-4 h-4" /> Volver a items
      </button>
      <h1 className="text-xl font-bold text-noa-navy font-display">{name}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6 space-y-2 text-sm">
            <p className="flex justify-between"><span className="text-gray-500">Cantidad total comprada</span><span className="font-medium">{totalQty.toLocaleString('es-CL')}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Precio mín.</span><span className="font-medium">{clp(min)}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Precio máx.</span><span className="font-medium">{clp(max)}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Precio promedio</span><span className="font-medium text-noa-orange-dk">{clp(avg)}</span></p>
            <p className="flex justify-between border-t pt-2"><span className="text-gray-700 font-semibold">Total histórico</span><span className="font-bold text-noa-navy">{clp(totalHist)}</span></p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">Precio unitario en el tiempo</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={clpShort} />
                <Tooltip formatter={(v) => clp(v)} />
                <Line type="monotone" dataKey="precio" stroke="#0C1B33" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto border rounded-lg bg-white">
        <p className="text-xs font-semibold px-3 py-2 border-b bg-gray-50 text-gray-700">Apariciones en facturas</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead><TableHead>Folio</TableHead>
              <TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Precio unit.</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...rows].reverse().map((c, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{fdate(c.date)}</TableCell>
                <TableCell className="text-xs"><button className="text-noa-navy hover:underline" onClick={() => onSupplier(c.supplier)}>{c.supplier || '—'}</button></TableCell>
                <TableCell className="text-xs">{c.invoice_number || '—'}</TableCell>
                <TableCell className="text-right text-xs">{(Number(c.quantity_purchased) || 0).toLocaleString('es-CL')}</TableCell>
                <TableCell className="text-right text-xs">{clp(unitPrice(c))}</TableCell>
                <TableCell className="text-right text-xs font-semibold">{clp(c.subtotal || c.total_cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ───────── Supplier detail ─────────
function SupplierDetail({ supplier, costs, onBack, onItem }) {
  const rows = useMemo(() => costs.filter((c) => c.supplier === supplier).sort((a, b) => (a.date || '').localeCompare(b.date || '')), [costs, supplier]);
  const totalBruto = rows.reduce((s, c) => s + (Number(c.total_cost) || 0), 0);
  const totalNeto = rows.reduce((s, c) => s + (Number(c.subtotal) || Number(c.total_cost) || 0), 0);
  const taxId = rows.find((c) => c.supplier_tax_id)?.supplier_tax_id;

  const chartData = useMemo(() => {
    const byDate = {};
    for (const c of rows) { const d = (c.date || '').slice(0, 10); if (d) byDate[d] = (byDate[d] || 0) + (Number(c.total_cost) || 0); }
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).map(([d, total]) => ({ label: fdate(d), total }));
  }, [rows]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-noa-navy">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-noa-navy/5"><Building2 className="w-6 h-6 text-noa-navy" /></div>
        <div>
          <h1 className="text-xl font-bold text-noa-navy font-display">{supplier || 'Proveedor'}</h1>
          {taxId && <p className="text-sm text-gray-500">RUT: {taxId}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi icon={Receipt} label="Compras" value={rows.length.toLocaleString('es-CL')} />
        <Kpi icon={TrendingUp} label="Total comprado (bruto)" value={clp(totalBruto)} highlight />
        <Kpi icon={DollarSign} label="Total neto" value={clp(totalNeto)} />
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">Total comprado (bruto) en el tiempo</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0C1B33" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0C1B33" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={clpShort} />
                <Tooltip formatter={(v) => clp(v)} />
                <Area type="monotone" dataKey="total" stroke="#0C1B33" fill="url(#sgrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto border rounded-lg bg-white">
        <p className="text-xs font-semibold px-3 py-2 border-b bg-gray-50 text-gray-700">Items comprados a este proveedor</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead><TableHead>Item</TableHead><TableHead>Folio</TableHead>
              <TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...rows].reverse().map((c, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{fdate(c.date)}</TableCell>
                <TableCell className="text-xs"><button className="text-noa-orange-dk hover:underline" onClick={() => onItem(c.supply_item_name || c.supply_name)}>{c.supply_item_name || c.supply_name}</button></TableCell>
                <TableCell className="text-xs">{c.invoice_number || '—'}</TableCell>
                <TableCell className="text-right text-xs">{(Number(c.quantity_purchased) || 0).toLocaleString('es-CL')}</TableCell>
                <TableCell className="text-right text-xs font-semibold">{clp(c.total_cost || c.subtotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ───────── Categorías (árbol) ─────────
function Categorias({ costs, onItem }) {
  const [selected, setSelected] = useState(null); // categoría abierta
  const [provModal, setProvModal] = useState(null); // categoría del modal de proveedores

  const groups = useMemo(() => {
    const map = {};
    for (const c of costs) {
      const cat = c.supply_category || 'Sin categoría asignada';
      if (!map[cat]) map[cat] = { name: cat, items: 0, suppliers: new Set(), totalNeto: 0, rows: [] };
      const g = map[cat];
      g.items += 1;
      if (c.supplier) g.suppliers.add(c.supplier);
      g.totalNeto += Number(c.subtotal) || Number(c.total_cost) || 0;
      g.rows.push(c);
    }
    return Object.values(map).map((g) => ({ ...g, suppliersCount: g.suppliers.size })).sort((a, b) => b.totalNeto - a.totalNeto);
  }, [costs]);

  if (selected) {
    return <CategoryDetail group={selected} onBack={() => setSelected(null)} onItem={onItem} onProveedores={() => setProvModal(selected)} provModal={provModal} closeProv={() => setProvModal(null)} />;
  }

  if (groups.length === 0) return <EmptyState />;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">Explora la jerarquía y rendimiento de tus categorías para tomar mejores decisiones.</p>
      <div className="overflow-x-auto border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Proveedores</TableHead>
              <TableHead className="text-right">Total neto</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.name} className="hover:bg-gray-50">
                <TableCell>
                  <button className="text-noa-orange-dk font-medium hover:underline" onClick={() => setSelected(g)}>
                    {g.name} <span className="text-gray-400">({g.items})</span>
                  </button>
                </TableCell>
                <TableCell className="text-right text-xs">
                  <button className="text-noa-navy hover:underline" onClick={() => setProvModal(g)}>{g.suppliersCount}</button>
                </TableCell>
                <TableCell className="text-right text-xs font-semibold">{clp(g.totalNeto)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelected(g)}>Ver items</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {provModal && <ProveedoresModal group={provModal} onClose={() => setProvModal(null)} />}
    </div>
  );
}

function CategoryDetail({ group, onBack, onItem, onProveedores, provModal, closeProv }) {
  const [metric, setMetric] = useState('precio');
  const rows = [...group.rows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const chartData = rows.map((c) => ({
    label: fdate(c.date),
    precio: Math.round(unitPrice(c)),
    cantidad: Number(c.quantity_purchased) || 0,
    total: Number(c.subtotal) || Number(c.total_cost) || 0,
  }));

  // Resumen por producto dentro de la categoría
  const productos = useMemo(() => {
    const map = {};
    for (const c of rows) {
      const n = c.supply_item_name || c.supply_name || '—';
      if (!map[n]) map[n] = { name: n, supplier: c.supplier, lastDate: '', lastPrice: 0, qty: 0, totalNeto: 0, totalBruto: 0, unit: c.unit_of_measure || '' };
      const p = map[n];
      p.qty += Number(c.quantity_purchased) || 0;
      p.totalNeto += Number(c.subtotal) || Number(c.total_cost) || 0;
      p.totalBruto += Number(c.total_cost) || 0;
      const d = (c.date || '').slice(0, 10);
      if (d >= p.lastDate) { p.lastDate = d; p.lastPrice = unitPrice(c); p.supplier = c.supplier; p.unit = c.unit_of_measure || p.unit; }
    }
    return Object.values(map).sort((a, b) => b.totalNeto - a.totalNeto);
  }, [rows]);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-noa-navy">
        <ArrowLeft className="w-4 h-4" /> Todas / {group.name}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              {[['precio', 'Precio Unitario'], ['cantidad', 'Cantidad'], ['total', 'Total Comprado']].map(([k, lbl]) => (
                <button key={k} onClick={() => setMetric(k)}
                  className={`text-xs px-3 py-1.5 rounded-md ${metric === k ? 'bg-noa-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{lbl}</button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs><linearGradient id="cgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={metric === 'cantidad' ? (v) => v : clpShort} />
                <Tooltip formatter={(v) => metric === 'cantidad' ? v : clp(v)} />
                <Area type="monotone" dataKey={metric} stroke="#F59E0B" fill="url(#cgrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-center font-bold text-noa-navy font-display">Categoría: "{group.name}"</p>
            <div className="text-sm space-y-2">
              <p className="flex justify-between"><span className="text-gray-500">Items</span><span className="font-medium">{group.items}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Proveedores</span>
                <button className="text-noa-navy hover:underline font-medium" onClick={onProveedores}>{group.suppliersCount}</button></p>
              <p className="flex justify-between border-t pt-2"><span className="text-gray-700 font-semibold">Total neto</span><span className="font-bold text-noa-navy">{clp(group.totalNeto)}</span></p>
            </div>
            <Button variant="outline" className="w-full" onClick={onProveedores}>Ver proveedores</Button>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto border rounded-lg bg-white">
        <p className="text-xs font-semibold px-3 py-2 border-b bg-gray-50 text-gray-700">Resumen de productos</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead><TableHead>Proveedor</TableHead><TableHead>Última compra</TableHead>
              <TableHead className="text-right">Precio últ.</TableHead><TableHead className="text-right">Q total</TableHead>
              <TableHead>Unidad</TableHead><TableHead className="text-right">Total neto</TableHead><TableHead className="text-right">Total bruto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.map((p, i) => (
              <TableRow key={i} className="hover:bg-gray-50">
                <TableCell><button className="text-noa-orange-dk hover:underline text-xs" onClick={() => onItem(p.name)}>{p.name}</button></TableCell>
                <TableCell className="text-xs">{p.supplier || '—'}</TableCell>
                <TableCell className="text-xs">{fdate(p.lastDate)}</TableCell>
                <TableCell className="text-right text-xs">{clp(p.lastPrice)}</TableCell>
                <TableCell className="text-right text-xs">{p.qty.toLocaleString('es-CL')}</TableCell>
                <TableCell className="text-xs">{p.unit || '—'}</TableCell>
                <TableCell className="text-right text-xs font-medium">{clp(p.totalNeto)}</TableCell>
                <TableCell className="text-right text-xs font-semibold">{clp(p.totalBruto)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {provModal && <ProveedoresModal group={provModal} onClose={closeProv} />}
    </div>
  );
}

function ProveedoresModal({ group, onClose }) {
  const proveedores = useMemo(() => {
    const map = {};
    for (const c of group.rows) {
      const key = c.supplier || '—';
      if (!map[key]) map[key] = { name: key, taxId: c.supplier_tax_id || '', count: 0, totalBruto: 0 };
      map[key].count += 1;
      map[key].totalBruto += Number(c.total_cost) || 0;
      if (c.supplier_tax_id) map[key].taxId = c.supplier_tax_id;
    }
    return Object.values(map).sort((a, b) => b.totalBruto - a.totalBruto);
  }, [group]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl font-sans">
        <DialogHeader>
          <DialogTitle className="font-display text-noa-navy">Proveedores de {group.name}</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RUT</TableHead><TableHead>Razón social</TableHead>
                <TableHead className="text-right"># Facturas</TableHead><TableHead className="text-right">Total bruto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proveedores.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{p.taxId || '—'}</TableCell>
                  <TableCell className="text-xs">{p.name}</TableCell>
                  <TableCell className="text-right text-xs">{p.count}</TableCell>
                  <TableCell className="text-right text-xs font-semibold">{clp(p.totalBruto)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────── Elaborados ─────────
function Elaborados({ costs }) {
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['elaborados', user?.restaurant_ids],
    queryFn: async () => {
      const rid = user?.restaurant_ids?.[0];
      const all = rid ? await base44.entities.Recipe.filter({ restaurant_id: rid }) : await base44.entities.Recipe.list();
      return all || [];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
  const [creating, setCreating] = useState(false);

  // Precios de insumos para costeo (último precio conocido por nombre)
  const priceByItem = useMemo(() => {
    const map = {};
    for (const c of costs) {
      const n = c.supply_item_name || c.supply_name;
      if (!n) continue;
      const d = (c.date || '');
      if (!map[n] || d >= map[n].date) map[n] = { date: d, price: unitPrice(c), unit: c.unit_of_measure || '' };
    }
    return map;
  }, [costs]);

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>;

  if (creating) {
    return <NuevoElaborado priceByItem={priceByItem} restaurantId={user?.restaurant_ids?.[0]} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); queryClient.invalidateQueries({ queryKey: ['elaborados'] }); }} />;
  }

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-br from-noa-orange/10 to-noa-cream border-0">
        <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <Badge className="bg-noa-success/15 text-noa-success border-0 mb-2">Primeros pasos</Badge>
            <h2 className="text-lg font-bold text-noa-navy font-display">Crea tu elaborado</h2>
            <p className="text-sm text-gray-600">Costea recetas, define precio y revisa margen en un solo lugar.</p>
          </div>
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Crear elaborado
          </Button>
        </CardContent>
      </Card>

      {recipes.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[['1', 'Define la base', 'Nombra la receta, elige su unidad base y cuánto rinde.'],
            ['2', 'Agrega ingredientes', 'Busca insumos y arma la composición completa en minutos.'],
            ['3', 'Revisa costo y margen', 'Define el precio de venta y sigue la rentabilidad.']].map(([n, t, d]) => (
            <Card key={n}><CardContent className="pt-6">
              <div className="w-7 h-7 rounded-full bg-noa-navy/5 text-noa-navy flex items-center justify-center font-bold mb-3">{n}</div>
              <p className="font-semibold text-noa-navy">{t}</p>
              <p className="text-sm text-gray-600 mt-1">{d}</p>
            </CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead><TableHead>Unidad</TableHead><TableHead className="text-right">Rinde</TableHead>
                <TableHead className="text-right">Costo</TableHead><TableHead className="text-right">Precio venta</TableHead><TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((r) => {
                const cost = Number(r.cost) || 0, price = Number(r.sale_price) || 0;
                const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-noa-navy">{r.name}</TableCell>
                    <TableCell className="text-xs">{r.unit || '—'}</TableCell>
                    <TableCell className="text-right text-xs">{r.yield || 1}</TableCell>
                    <TableCell className="text-right text-xs">{clp(cost)}</TableCell>
                    <TableCell className="text-right text-xs">{clp(price)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold" style={{ color: margin >= 0 ? '#16A34A' : '#DC2626' }}>{margin.toFixed(0)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function NuevoElaborado({ priceByItem, restaurantId, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [yieldQty, setYieldQty] = useState('1');
  const [tags, setTags] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [ingredients, setIngredients] = useState([]); // {name, qty}
  const [saving, setSaving] = useState(false);

  const itemNames = useMemo(() => Object.keys(priceByItem).sort(), [priceByItem]);

  function addIngredient() { setIngredients((x) => [...x, { name: '', qty: '1' }]); }
  function updateIng(i, patch) { setIngredients((x) => x.map((g, idx) => idx === i ? { ...g, ...patch } : g)); }
  function removeIng(i) { setIngredients((x) => x.filter((_, idx) => idx !== i)); }

  const cost = useMemo(() => ingredients.reduce((s, ing) => {
    const p = priceByItem[ing.name]?.price || 0;
    return s + p * (Number(ing.qty) || 0);
  }, 0), [ingredients, priceByItem]);

  const canSave = name.trim() && unit && ingredients.some((i) => i.name);
  const margin = Number(salePrice) > 0 ? ((Number(salePrice) - cost) / Number(salePrice)) * 100 : null;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await base44.entities.Recipe.create({
        restaurant_id: restaurantId,
        name: name.trim(),
        unit,
        yield: Number(yieldQty) || 1,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        cost: Math.round(cost),
        sale_price: Number(salePrice) || 0,
        ingredients: ingredients.filter((i) => i.name).map((i) => ({ name: i.name, quantity: Number(i.qty) || 0, unit_cost: priceByItem[i.name]?.price || 0 })),
        is_elaborado: true,
      });
      onSaved();
    } catch (err) {
      alert('Error guardando: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-noa-navy font-display">Nuevo elaborado</h2>
          <p className="text-sm text-gray-600">Define la base de la receta y arma su composición.</p>
        </div>
        <div className="flex items-center gap-2">
          {!canSave && <span className="text-xs text-amber-600">Faltan nombre, unidad base y al menos 1 ingrediente</span>}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" disabled={!canSave || saving} onClick={save}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Crear elaborado</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card><CardContent className="pt-6 space-y-4">
            <p className="font-semibold text-noa-navy">Datos esenciales</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Mayonesa de la casa" />
              </div>
              <div className="space-y-1">
                <Label>Unidad base</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {['KG', 'GR', 'LT', 'ML', 'UND', 'PORCIÓN'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rendimiento</Label>
                <Input type="number" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} />
              </div>
            </div>
          </CardContent></Card>

          <Card><CardContent className="pt-6 space-y-3">
            <p className="font-semibold text-noa-navy">Tags</p>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="entrada, fondo, postre (separados por coma)" />
          </CardContent></Card>

          <Card><CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-noa-navy">Composición</p>
              <Button variant="outline" size="sm" onClick={addIngredient}><Plus className="w-4 h-4 mr-1" /> Agregar ingrediente</Button>
            </div>
            {ingredients.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Agrega el primer ingrediente. Busca insumos por nombre.</p>
            ) : (
              <div className="space-y-2">
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={ing.name} onValueChange={(v) => updateIng(i, { name: v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Insumo…" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {itemNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" value={ing.qty} onChange={(e) => updateIng(i, { qty: e.target.value })} className="w-24" placeholder="Cant." />
                    <span className="text-xs text-gray-500 w-28">{ing.name ? clp((priceByItem[ing.name]?.price || 0) * (Number(ing.qty) || 0)) : ''}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeIng(i)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </div>

        <Card className="h-fit"><CardContent className="pt-6 space-y-3">
          <p className="font-semibold text-noa-navy">Resumen</p>
          <div className="text-sm space-y-2">
            <p className="flex justify-between"><span className="text-gray-500">Nombre</span><span className="font-medium">{name || 'Sin nombre'}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Rendimiento</span><span className="font-medium">{yieldQty || '—'} {unit}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Ingredientes</span><span className="font-medium">{ingredients.filter((i) => i.name).length}</span></p>
            <p className="flex justify-between border-t pt-2"><span className="text-gray-700 font-semibold">Costo total</span><span className="font-bold text-noa-navy">{clp(cost)}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Costo / {unit || 'u'}</span><span className="font-medium">{clp(Number(yieldQty) > 0 ? cost / Number(yieldQty) : cost)}</span></p>
          </div>
          <div className="space-y-1 pt-2 border-t">
            <Label>Precio de venta (opcional)</Label>
            <Input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="0" />
            {margin != null && (
              <p className="text-xs mt-1" style={{ color: margin >= 0 ? '#16A34A' : '#DC2626' }}>
                Margen: {margin.toFixed(1)}%
              </p>
            )}
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-gray-500">
      <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p className="font-medium text-gray-700">No hay datos de compras cargados</p>
      <p className="text-sm mt-1">Importa facturas en "Ventas y Compras" o registra compras de insumos para ver el catálogo.</p>
    </div>
  );
}
