import React, { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  AlertCircle, Loader2, FileText, ArrowLeft, Search, Building2,
  Receipt, TrendingUp, Percent, Calculator,
} from 'lucide-react';

// ─────────────────────── helpers ───────────────────────
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function monthsInRange(fromISO, toISO) {
  const from = new Date(fromISO + 'T00:00:00');
  const to = new Date(toISO + 'T00:00:00');
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];
  const months = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}
function loadSiiOverrides() {
  try {
    const raw = localStorage.getItem('noa_integrations');
    const sii = (raw ? JSON.parse(raw) : {}).sii || {};
    const out = {};
    for (const k of ['rutEmpresa', 'rutCertificado', 'password', 'apiKey', 'ambiente', 'certBase64']) {
      if (sii[k]) out[k] = sii[k];
    }
    return out;
  } catch { return {}; }
}
async function fetchRcv(type, year, month) {
  const overrides = loadSiiOverrides();
  const hasOverrides = Object.keys(overrides).length > 0;
  const res = await fetch(`/__sii/rcv?type=${type}&year=${year}&month=${month}`, {
    method: hasOverrides ? 'POST' : 'GET',
    headers: hasOverrides ? { 'Content-Type': 'application/json' } : undefined,
    body: hasOverrides ? JSON.stringify(overrides) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = json?.upstream ?? json?.error ?? `HTTP ${res.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return json;
}
function clp(n) {
  return (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}
function fdate(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString('es-CL');
}

// ─────────────────────── main page ───────────────────────
export default function Compras() {
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [search, setSearch] = useState('');
  const [view, setView] = useState({ kind: 'list' }); // {kind:'list'} | {kind:'invoice', row} | {kind:'supplier', rut, name}

  const months = useMemo(() => monthsInRange(appliedFrom, appliedTo), [appliedFrom, appliedTo]);

  const queries = useQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: ['compras-rcv', year, month],
      queryFn: () => fetchRcv('compras', year, month),
      enabled: months.length > 0,
      retry: 0,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading || q.isFetching);
  const errors = queries.map((q, i) => (q.error ? { ...months[i], error: q.error.message } : null)).filter(Boolean);

  const rows = useMemo(() => {
    const all = [];
    queries.forEach((q, i) => {
      const det = q.data?.data?.compras?.detalleCompras || [];
      det.forEach((d) => all.push({ ...d, __period: `${months[i].year}-${String(months[i].month).padStart(2, '0')}` }));
    });
    return all;
  }, [queries, months]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      String(r.folio || '').toLowerCase().includes(q) ||
      (r.razonSocial || '').toLowerCase().includes(q) ||
      (r.rutProveedor || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const kpis = useMemo(() => {
    const count = filtered.length;
    const totalBruto = filtered.reduce((s, r) => s + (Number(r.montoTotal) || 0), 0);
    const totalNeto = filtered.reduce((s, r) => s + (Number(r.montoNeto) || 0), 0);
    const avg = count ? totalBruto / count : 0;
    const proveedores = new Set(filtered.map((r) => r.rutProveedor)).size;
    return { count, totalBruto, totalNeto, avg, proveedores };
  }, [filtered]);

  if (view.kind === 'invoice') {
    return <InvoiceDetail row={view.row} onBack={() => setView({ kind: 'list' })} onSupplier={(rut, name) => setView({ kind: 'supplier', rut, name })} />;
  }
  if (view.kind === 'supplier') {
    return <SupplierDetail rut={view.rut} name={view.name} allRows={rows} onBack={() => setView({ kind: 'list' })} onInvoice={(row) => setView({ kind: 'invoice', row })} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-noa-navy">Mis facturas de compra</h1>
        <p className="text-gray-600 mt-1">Facturas de compra electrónicas y exentas, directo del SII.</p>
      </div>

      {/* Filtro de fechas + búsqueda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="from">Desde</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">Hasta</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={() => { setAppliedFrom(from); setAppliedTo(to); }} className="bg-noa-navy hover:bg-noa-navy-mid">
              Consultar
            </Button>
            <div className="flex-1 min-w-[220px] space-y-1">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input id="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Folio, proveedor o RUT" className="pl-9" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Receipt} label="Facturas en el período" value={kpis.count.toLocaleString('es-CL')} />
        <KpiCard icon={TrendingUp} label="Cantidad comprada (bruto)" value={clp(kpis.totalBruto)} />
        <KpiCard icon={Calculator} label="Monto neto" value={clp(kpis.totalNeto)} />
        <KpiCard icon={Percent} label="Monto promedio por factura" value={clp(kpis.avg)} highlight />
      </div>

      {/* Estado */}
      <div className="flex items-center gap-3 text-sm text-gray-600">
        {isLoading && <><Loader2 className="w-4 h-4 animate-spin" /> Consultando {months.length} {months.length === 1 ? 'mes' : 'meses'}…</>}
        {!isLoading && <><FileText className="w-4 h-4" /> {filtered.length} facturas · {kpis.proveedores} proveedores</>}
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Errores en {errors.length} {errors.length === 1 ? 'mes' : 'meses'}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 text-xs mt-1 space-y-1">
              {errors.map((e) => <li key={`${e.year}-${e.month}`}><strong>{e.year}-{String(e.month).padStart(2, '0')}:</strong> {e.error}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabla */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Fecha emisión</TableHead>
                <TableHead>Tipo documento</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Total bruto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 300).map((r, i) => (
                <TableRow key={i} className="hover:bg-gray-50">
                  <TableCell>
                    <button className="text-noa-orange-dk font-medium hover:underline" onClick={() => setView({ kind: 'invoice', row: r })}>
                      {r.folio}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">{fdate(r.fechaEmision)}</TableCell>
                  <TableCell className="text-xs">{r.tipoDTEString || `DTE ${r.tipoDTE}`}</TableCell>
                  <TableCell>
                    <button className="text-noa-navy hover:underline text-left text-xs" onClick={() => setView({ kind: 'supplier', rut: r.rutProveedor, name: r.razonSocial })}>
                      {r.razonSocial}
                      <span className="block text-gray-400">{r.rutProveedor}</span>
                    </button>
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold">{clp(r.montoTotal)}</TableCell>
                  <TableCell><EstadoBadge estado={r.estado} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 300 && <p className="text-xs text-gray-500 p-3 border-t">Mostrando 300 de {filtered.length} facturas.</p>}
        </div>
      )}

      {!isLoading && filtered.length === 0 && errors.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          No hay facturas de compra en el período seleccionado.
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, highlight }) {
  return (
    <Card className={highlight ? 'border-noa-orange/30 bg-noa-orange/5' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-gray-500 mb-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${highlight ? 'text-noa-navy' : 'text-gray-900'}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EstadoBadge({ estado }) {
  const e = (estado || '').toLowerCase();
  if (e.includes('confirm')) return <Badge className="bg-green-100 text-green-700 border-0">Confirmada</Badge>;
  if (e.includes('reclam')) return <Badge className="bg-red-100 text-red-700 border-0">Reclamada</Badge>;
  return <Badge variant="outline" className="text-xs">{estado || '—'}</Badge>;
}

// ─────────────────────── invoice detail ───────────────────────
function InvoiceDetail({ row, onBack, onSupplier }) {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-noa-navy">
        <ArrowLeft className="w-4 h-4" /> Volver a facturas
      </button>

      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-noa-navy flex items-center justify-center gap-2">
          {row.tipoDTEString || 'Factura Electrónica'} <FileText className="w-5 h-5 text-noa-orange" />
        </h1>
        <p className="text-lg font-semibold">Nº {row.folio} <EstadoBadge estado={row.estado} /></p>
        <p className="text-sm text-gray-500">Fecha de Emisión: {fdate(row.fechaEmision)}</p>
        {row.fechaRecepcion && <p className="text-sm text-gray-500">Fecha de Recepción: {fdate(row.fechaRecepcion)}</p>}
        {row.fechaAcuse && <p className="text-sm text-gray-500">Fecha de Acuse: {fdate(row.fechaAcuse)}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 space-y-1 text-sm">
            <p className="font-semibold text-gray-700 mb-2">Proveedor</p>
            <p><span className="text-gray-500">Razón social:</span>{' '}
              <button className="text-noa-navy hover:underline font-medium" onClick={() => onSupplier(row.rutProveedor, row.razonSocial)}>
                {row.razonSocial}
              </button>
            </p>
            <p><span className="text-gray-500">RUT:</span> {row.rutProveedor}</p>
            <p><span className="text-gray-500">Tipo compra:</span> {row.tipoCompra || '—'}</p>
            <p><span className="text-gray-500">Acuse recibo:</span> {row.acuseRecibo || '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-1 text-sm">
            <p className="font-semibold text-gray-700 mb-2">Montos</p>
            <p className="flex justify-between"><span className="text-gray-500">Monto neto</span> <span className="font-medium">{clp(row.montoNeto)}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Monto exento</span> <span className="font-medium">{clp(row.montoExento)}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">IVA recuperable</span> <span className="font-medium">{clp(row.montoIvaRecuperable)}</span></p>
            <p className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-700 font-semibold">Total</span> <span className="font-bold text-noa-navy">{clp(row.montoTotal)}</span></p>
          </CardContent>
        </Card>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-xs text-blue-800">
          El desglose de productos línea por línea no está disponible en el resumen del SII (RCV).
          Para ver los items necesitarías descargar el XML del DTE individual desde SimpleAPI — disponible en una próxima versión.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ─────────────────────── supplier detail ───────────────────────
function SupplierDetail({ rut, name, allRows, onBack, onInvoice }) {
  const supplierRows = useMemo(() => allRows.filter((r) => r.rutProveedor === rut), [allRows, rut]);

  const totalBruto = supplierRows.reduce((s, r) => s + (Number(r.montoTotal) || 0), 0);
  const totalNeto = supplierRows.reduce((s, r) => s + (Number(r.montoNeto) || 0), 0);
  const totalIva = supplierRows.reduce((s, r) => s + (Number(r.montoIvaRecuperable) || 0), 0);

  // Serie diaria para el gráfico
  const chartData = useMemo(() => {
    const byDate = {};
    for (const r of supplierRows) {
      const d = (r.fechaEmision || '').slice(0, 10);
      if (!d) continue;
      byDate[d] = (byDate[d] || 0) + (Number(r.montoTotal) || 0);
    }
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, total]) => ({ fecha: fdate(fecha), total }));
  }, [supplierRows]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-noa-navy">
        <ArrowLeft className="w-4 h-4" /> Volver a facturas
      </button>

      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-noa-navy/5"><Building2 className="w-6 h-6 text-noa-navy" /></div>
        <div>
          <h1 className="text-xl font-bold text-noa-navy">{name}</h1>
          <p className="text-sm text-gray-500">RUT: {rut}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Receipt} label="Facturas" value={supplierRows.length.toLocaleString('es-CL')} />
        <KpiCard icon={TrendingUp} label="Total comprado (bruto)" value={clp(totalBruto)} highlight />
        <KpiCard icon={Calculator} label="Total neto" value={clp(totalNeto)} />
        <KpiCard icon={Percent} label="IVA recuperable" value={clp(totalIva)} />
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">Total comprado (bruto) en el tiempo</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => clp(v)} />
                <Area type="monotone" dataKey="total" stroke="#F59E0B" fill="url(#grad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto border rounded-lg bg-white">
        <p className="text-xs font-semibold px-3 py-2 border-b bg-gray-50 text-gray-700">Facturas de este proveedor</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Fecha emisión</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Total bruto</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplierRows.map((r, i) => (
              <TableRow key={i} className="hover:bg-gray-50">
                <TableCell>
                  <button className="text-noa-orange-dk font-medium hover:underline" onClick={() => onInvoice(r)}>{r.folio}</button>
                </TableCell>
                <TableCell className="text-xs">{fdate(r.fechaEmision)}</TableCell>
                <TableCell className="text-xs">{r.tipoDTEString || `DTE ${r.tipoDTE}`}</TableCell>
                <TableCell className="text-right text-xs font-semibold">{clp(r.montoTotal)}</TableCell>
                <TableCell><EstadoBadge estado={r.estado} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
