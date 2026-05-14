import React, { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { AlertCircle, Loader2, FileText } from 'lucide-react';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Devuelve [{year, month}] cubriendo todos los meses entre from y to inclusive.
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
    const stored = raw ? JSON.parse(raw) : {};
    const sii = stored.sii || {};
    // Solo enviamos campos no-vacíos: si todo viene vacío, el server usa el .env.
    const out = {};
    for (const k of ['rutEmpresa', 'rutCertificado', 'password', 'apiKey', 'ambiente']) {
      if (sii[k]) out[k] = sii[k];
    }
    return out;
  } catch {
    return {};
  }
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
    const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
    throw new Error(msg);
  }
  return json;
}

// Estructura real de SimpleAPI RCV:
//   { caratula, compras: { resumenes, detalleCompras }, ventas: { resumenes, detalleVentas } }
// Devolvemos el detalle completo de documentos (array plano).
function flattenRows(payload, type) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const root = payload[type] || {};
  // Detalle preferido: detalleCompras / detalleVentas
  const detailKey = type === 'compras' ? 'detalleCompras' : 'detalleVentas';
  if (Array.isArray(root[detailKey])) return root[detailKey];
  // Fallback: cualquier array dentro del nodo (resumenes o variantes)
  for (const v of Object.values(root)) {
    if (Array.isArray(v)) return v;
  }
  // Fallback final: primer array del payload completo
  for (const v of Object.values(payload)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

function summaryRows(payload, type) {
  const root = payload?.[type];
  if (!root || !Array.isArray(root.resumenes)) return [];
  return root.resumenes;
}

function RcvPanel({ type, from, to }) {
  const months = useMemo(() => monthsInRange(from, to), [from, to]);

  const queries = useQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: ['sii-rcv', type, year, month],
      queryFn: () => fetchRcv(type, year, month),
      enabled: months.length > 0,
      retry: 0,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading || q.isFetching);
  const errors = queries
    .map((q, i) => (q.error ? { ...months[i], error: q.error.message } : null))
    .filter(Boolean);
  const rows = queries.flatMap((q, i) => {
    const inner = q.data?.data;
    return flattenRows(inner, type).map((r) => ({ ...r, __period: `${months[i].year}-${String(months[i].month).padStart(2, '0')}` }));
  });
  const summaries = queries.flatMap((q, i) => {
    const inner = q.data?.data;
    return summaryRows(inner, type).map((r) => ({ ...r, __period: `${months[i].year}-${String(months[i].month).padStart(2, '0')}` }));
  });

  const totals = useMemo(() => {
    return summaries.reduce((acc, r) => {
      acc.documentos += Number(r.totalDocumentos) || 0;
      acc.neto += Number(r.montoNeto) || 0;
      acc.exento += Number(r.montoExento) || 0;
      acc.iva += Number(r.ivaRecuperable) || 0;
      acc.total += Number(r.montoTotal) || 0;
      return acc;
    }, { documentos: 0, neto: 0, exento: 0, iva: 0, total: 0 });
  }, [summaries]);

  const detailColumns = type === 'compras'
    ? ['__period', 'fechaEmision', 'tipoDTEString', 'folio', 'rutProveedor', 'razonSocial', 'montoNeto', 'montoIvaRecuperable', 'montoTotal', 'estado']
    : ['__period', 'fechaEmision', 'tipoDteString', 'folio', 'rutReceptor', 'razonSocial', 'montoNeto', 'montoIVA', 'montoTotal', 'estado'];

  const columns = useMemo(() => {
    if (rows.length === 0) return [];
    const sample = rows[0];
    return detailColumns.filter((c) => c === '__period' || c in sample);
  }, [rows, type]);

  if (months.length === 0) {
    return (
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertTitle>Rango inválido</AlertTitle>
        <AlertDescription>La fecha "desde" debe ser anterior o igual a la fecha "hasta".</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-gray-600">
        {isLoading && <><Loader2 className="w-4 h-4 animate-spin" /> Consultando {months.length} {months.length === 1 ? 'mes' : 'meses'}…</>}
        {!isLoading && <><FileText className="w-4 h-4" /> {rows.length} registros en {months.length} {months.length === 1 ? 'mes' : 'meses'}</>}
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Errores en {errors.length} {errors.length === 1 ? 'mes' : 'meses'}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-xs">
              {errors.map((e) => (
                <li key={`${e.year}-${e.month}`}>
                  <strong>{e.year}-{String(e.month).padStart(2, '0')}:</strong> {e.error}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {summaries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Documentos" value={totals.documentos.toLocaleString('es-CL')} />
          <Stat label="Monto Neto" value={formatCLP(totals.neto)} />
          <Stat label="Exento" value={formatCLP(totals.exento)} />
          <Stat label="IVA" value={formatCLP(totals.iva)} />
          <Stat label="Total" value={formatCLP(totals.total)} highlight />
        </div>
      )}

      {summaries.length > 0 && (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <p className="text-xs font-semibold text-gray-700 px-3 py-2 border-b bg-gray-50">Resumen por tipo de documento</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Tipo DTE</TableHead>
                <TableHead className="text-right">Documentos</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">Exento</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{r.__period}</TableCell>
                  <TableCell className="text-xs">{r.tipoDteString}</TableCell>
                  <TableCell className="text-xs text-right">{(r.totalDocumentos ?? 0).toLocaleString('es-CL')}</TableCell>
                  <TableCell className="text-xs text-right">{formatCLP(r.montoNeto)}</TableCell>
                  <TableCell className="text-xs text-right">{formatCLP(r.montoExento)}</TableCell>
                  <TableCell className="text-xs text-right">{formatCLP(r.ivaRecuperable)}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">{formatCLP(r.montoTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <p className="text-xs font-semibold text-gray-700 px-3 py-2 border-b bg-gray-50">Detalle de documentos</p>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => <TableHead key={c}>{c.replace(/^__/, '').replace(/([A-Z])/g, ' $1').trim()}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 200).map((r, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c} className="text-xs whitespace-nowrap">
                      {formatCell(r[c], c)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 200 && (
            <p className="text-xs text-gray-500 p-3 border-t">
              Mostrando primeros 200 de {rows.length} registros.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'bg-noa-orange/10 border-noa-orange/30' : 'bg-white'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-base font-semibold mt-1 ${highlight ? 'text-noa-navy' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function formatCLP(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

function formatCell(v, key) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof key === 'string' && /^(monto|iva|total)/i.test(key)) {
    const n = Number(v);
    if (!Number.isNaN(n)) return formatCLP(n);
  }
  if (typeof key === 'string' && /fecha/i.test(key) && typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL');
  }
  return String(v);
}

export default function SII() {
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SII — Registro de Compras y Ventas</h1>
        <p className="text-gray-600 mt-1">Consulta el RCV del SII vía SimpleAPI por rango de fechas.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtro de fechas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="from">Desde</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">Hasta</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
            </div>
            <Button onClick={() => { setAppliedFrom(from); setAppliedTo(to); }}>
              Consultar
            </Button>
            <p className="text-xs text-gray-500 ml-auto">
              El SII entrega datos por mes; las fechas se redondean al mes correspondiente.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ventas" className="w-full">
        <TabsList>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>
        <TabsContent value="ventas" className="mt-4">
          <RcvPanel type="ventas" from={appliedFrom} to={appliedTo} />
        </TabsContent>
        <TabsContent value="compras" className="mt-4">
          <RcvPanel type="compras" from={appliedFrom} to={appliedTo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
