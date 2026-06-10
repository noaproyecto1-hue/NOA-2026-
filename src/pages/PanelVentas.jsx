import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell,
} from 'recharts';
import {
  TrendingUp, Receipt, Percent, DollarSign, Coins, BarChart3, Loader2,
  RefreshCw, CheckCircle2,
} from 'lucide-react';

function clp(n) { return (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }); }
function clpK(n) { const v = Number(n) || 0; if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`; return `$${v}`; }
const NAVY = '#0C1B33', ORANGE = '#F59E0B';
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function firstOfMonthISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function PanelVentas() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });

  const { data: localSales = [] } = useQuery({
    queryKey: ['ventas-local', user?.restaurant_ids],
    queryFn: async () => {
      const rid = user?.restaurant_ids?.[0];
      const all = rid ? await base44.entities.Sale.filter({ restaurant_id: rid }) : await base44.entities.Sale.list();
      return (all || []).filter((s) => !s.is_cancelled);
    },
    enabled: !!user, staleTime: 2 * 60 * 1000,
  });

  const { data: fudoSync = { sales: [], lastSync: null }, isLoading: loadingFudo } = useQuery({
    queryKey: ['ventas-fudo-sync'],
    queryFn: async () => { const res = await fetch('/__fudo/sync-pull'); return res.ok ? await res.json() : { sales: [], lastSync: null }; },
    staleTime: 60 * 1000,
  });

  const allSales = useMemo(() => {
    const map = new Map();
    for (const s of localSales) if (s.id) map.set(`l-${s.id}`, s);
    for (const s of fudoSync.sales || []) if (!s.is_cancelled) map.set(`f-${s.id}`, s);
    return [...map.values()];
  }, [localSales, fudoSync]);

  // Filtra por rango
  const sales = useMemo(() => {
    const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T23:59:59');
    return allSales.filter((s) => { const d = new Date(s.date_time); return !Number.isNaN(d.getTime()) && d >= f && d <= t; });
  }, [allSales, from, to]);

  const stats = useMemo(() => computeStats(sales), [sales]);
  const isLoading = !user || loadingFudo;

  async function syncNow() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/__fudo/sync-pull', { method: 'POST' });
      const data = await res.json();
      setSyncResult({ ok: data.ok !== false, message: data.lastRunSummary ? `${data.lastRunSummary.broughtFromFudo} ventas traídas. Total: ${data.lastRunSummary.totalInKv}.` : (data.message || 'OK') });
      queryClient.invalidateQueries({ queryKey: ['ventas-fudo-sync'] });
    } catch (err) { setSyncResult({ ok: false, message: err.message }); } finally { setSyncing(false); }
  }

  if (isLoading) return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando ventas…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-noa-navy flex items-center gap-2 font-display"><BarChart3 className="w-6 h-6 text-noa-orange" /> Ventas</h1>
          <p className="text-gray-600 mt-1">Panel de ventas: evolución, días, horas, medios de pago y canales.</p>
        </div>
        <Button onClick={syncNow} disabled={syncing} className="bg-noa-navy hover:bg-noa-navy-mid">
          {syncing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}{syncing ? 'Sincronizando…' : 'Sincronizar Fudo'}
        </Button>
      </div>

      {/* Filtro fechas */}
      <Card><CardContent className="pt-6"><div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label>Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
        <div className="space-y-1"><Label>Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        {fudoSync.lastSync && <span className="text-xs text-gray-500 ml-auto inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-noa-success" /> Fudo sincronizado: {new Date(fudoSync.lastSync).toLocaleString('es-CL')}</span>}
      </div>
      {syncResult && <p className={`text-xs mt-2 ${syncResult.ok ? 'text-noa-success' : 'text-red-600'}`}>{syncResult.message}</p>}
      </CardContent></Card>

      {sales.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-gray-700">No hay ventas en el período</p>
          <p className="text-sm mt-1">Ajusta el rango de fechas o haz click en "Sincronizar Fudo".</p>
        </CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Kpi icon={DollarSign} label="Total ventas brutas" value={clpK(stats.bruto)} />
            <Kpi icon={TrendingUp} label="Total ventas netas" value={clpK(stats.neto)} />
            <Kpi icon={Coins} label="Descuentos" value={clpK(-stats.descuentos)} />
            <Kpi icon={Receipt} label="Cantidad de ventas" value={stats.count.toLocaleString('es-CL')} />
            <Kpi icon={Percent} label="Promedio por venta" value={clp(stats.promedio)} highlight />
          </div>

          {/* Evolución de ventas brutas */}
          <ChartCard title="Evolución de ventas brutas">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={stats.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={clpK} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => n === 'Cantidad' ? v : clp(v)} />
                <Legend />
                <Bar yAxisId="l" dataKey="total" name="Ventas $" fill={NAVY} radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="count" name="Cantidad" stroke={ORANGE} strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Día de semana + Hora */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Ventas por día de la semana">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.byDow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={clpK} /><Tooltip formatter={(v) => clp(v)} />
                  <Bar dataKey="total" fill={NAVY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Ventas por hora">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.byHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="label" tick={{ fontSize: 9 }} interval={1} /><YAxis tick={{ fontSize: 11 }} tickFormatter={clpK} /><Tooltip formatter={(v) => clp(v)} />
                  <Bar dataKey="total" fill={ORANGE} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Medios de pago + Origen + Canales delivery */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <HBarCard title="Medios de pago" data={stats.byPayment} color={NAVY} />
            <HBarCard title="Origen de las ventas" data={stats.byOrigin} color={NAVY} />
            <HBarCard title="Canales de delivery" data={stats.byChannel} color={ORANGE} empty="Sin ventas de delivery" />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, highlight }) {
  return (
    <Card className={highlight ? 'border-noa-orange/30 bg-noa-orange/5' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-1.5 text-gray-500 mb-2"><Icon className="w-4 h-4" /><span className="text-xs">{label}</span></div>
        <p className={`text-xl font-bold font-display ${highlight ? 'text-noa-navy' : 'text-gray-900'}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
function ChartCard({ title, children }) {
  return <Card><CardContent className="pt-6"><p className="text-sm font-semibold text-gray-700 mb-4">{title}</p>{children}</CardContent></Card>;
}
function HBarCard({ title, data, color, empty }) {
  return (
    <Card><CardContent className="pt-6">
      <p className="text-sm font-semibold text-gray-700 mb-4">{title}</p>
      {(!data || data.length === 0) ? <p className="text-xs text-gray-400 py-8 text-center">{empty || 'Sin datos'}</p> : (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={clpK} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={(v) => clp(v)} />
            <Bar dataKey="total" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </CardContent></Card>
  );
}

function computeStats(sales) {
  let bruto = 0, neto = 0, descuentos = 0;
  const byDayMap = {}, byDow = Array(7).fill(0), byHour = Array(24).fill(0), byPay = {}, byOrigin = {}, byChannel = {};

  for (const s of sales) {
    const amt = Number(s.total_amount) || 0;
    bruto += amt;
    neto += Number(s.subtotal_amount) || (amt - (Number(s.tax_amount) || 0));
    descuentos += Number(s.discount_amount) || 0;
    const d = new Date(s.date_time);
    if (!Number.isNaN(d.getTime())) {
      const k = d.toISOString().slice(0, 10);
      if (!byDayMap[k]) byDayMap[k] = { total: 0, count: 0 };
      byDayMap[k].total += amt; byDayMap[k].count += 1;
      byDow[d.getDay()] += amt;
      byHour[d.getHours()] += amt;
    }
    const pm = s.payment_method || 'Otros'; byPay[pm] = (byPay[pm] || 0) + amt;
    const isDelivery = s.is_delivery || /deliver/i.test(s.origin || s.sale_type || '');
    const origin = isDelivery ? 'Delivery' : (s.origin || s.sale_type || 'Mesa');
    byOrigin[origin] = (byOrigin[origin] || 0) + amt;
    if (isDelivery) { const ch = s.delivery || s.source || s.channel || 'Otro delivery'; byChannel[ch] = (byChannel[ch] || 0) + amt; }
  }

  const byDay = Object.entries(byDayMap).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => {
    const d = new Date(k + 'T00:00:00'); return { label: `${d.getDate()}/${d.getMonth() + 1}`, total: v.total, count: v.count };
  });
  const count = sales.length;
  return {
    bruto, neto, descuentos, count, promedio: count ? bruto / count : 0,
    byDay,
    byDow: byDow.map((total, i) => ({ label: DOW[i], total })),
    byHour: byHour.map((total, i) => ({ label: `${i}h`, total })).filter((x) => x.total > 0),
    byPayment: Object.entries(byPay).sort((a, b) => b[1] - a[1]).map(([label, total]) => ({ label, total })),
    byOrigin: Object.entries(byOrigin).sort((a, b) => b[1] - a[1]).map(([label, total]) => ({ label, total })),
    byChannel: Object.entries(byChannel).sort((a, b) => b[1] - a[1]).map(([label, total]) => ({ label, total })),
  };
}
