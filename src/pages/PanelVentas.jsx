import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  TrendingUp, Receipt, Percent, DollarSign, Coins, Clock, BarChart3, Loader2,
  RefreshCw, CheckCircle2,
} from 'lucide-react';

function clp(n) {
  return (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}
function clpShort(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v}`;
}
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export default function PanelVentas() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });

  // Ventas locales (entidad Sale en localStorage)
  const { data: localSales = [] } = useQuery({
    queryKey: ['panel-ventas-local', user?.restaurant_ids],
    queryFn: async () => {
      const rid = user?.restaurant_ids?.[0];
      const all = rid ? await base44.entities.Sale.filter({ restaurant_id: rid }) : await base44.entities.Sale.list();
      return (all || []).filter((s) => !s.is_cancelled);
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Ventas sincronizadas por el cron desde Fudo (Vercel KV)
  const { data: fudoSync = { sales: [], lastSync: null, lastRunSummary: null }, isLoading: loadingFudo } = useQuery({
    queryKey: ['panel-ventas-fudo-sync'],
    queryFn: async () => {
      const res = await fetch('/__fudo/sync-pull');
      if (!res.ok) return { sales: [], lastSync: null };
      return await res.json();
    },
    staleTime: 60 * 1000,
  });

  const isLoading = !user || loadingFudo;

  // Merge: prioridad a Fudo sync (por id), complementado con ventas locales
  const sales = useMemo(() => {
    const map = new Map();
    for (const s of localSales) if (s.id) map.set(`local-${s.id}`, s);
    for (const s of fudoSync.sales || []) if (!s.is_cancelled) map.set(`fudo-${s.id}`, s);
    return [...map.values()];
  }, [localSales, fudoSync]);

  async function syncNow() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/__fudo/sync-pull', { method: 'POST' });
      const data = await res.json();
      setSyncResult({
        ok: data.ok !== false,
        message: data.lastRunSummary
          ? `${data.lastRunSummary.broughtFromFudo} ventas nuevas traídas (${data.lastRunSummary.dateFrom} → ${data.lastRunSummary.dateTo}). Total en cache: ${data.lastRunSummary.totalInKv}.`
          : (data.message || 'Sincronización completada'),
      });
      queryClient.invalidateQueries({ queryKey: ['panel-ventas-fudo-sync'] });
    } catch (err) {
      setSyncResult({ ok: false, message: err.message });
    } finally {
      setSyncing(false);
    }
  }

  const stats = useMemo(() => computeStats(sales), [sales]);

  if (isLoading) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando ventas…</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-noa-navy flex items-center gap-2 font-display">
            <BarChart3 className="w-6 h-6 text-noa-orange" /> Panel de Ventas
          </h1>
          <p className="text-gray-600 mt-1">Ventas, ticket promedio y márgenes de tu negocio.</p>
        </div>
        <Button onClick={syncNow} disabled={syncing} className="bg-noa-navy hover:bg-noa-navy-mid">
          {syncing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          {syncing ? 'Sincronizando…' : 'Sincronizar Fudo ahora'}
        </Button>
      </div>

      {/* Estado de sincronización Fudo */}
      <Card className="border-noa-orange/20 bg-noa-orange/5">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {fudoSync.lastSync ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-noa-success" />
                  <span className="text-sm">
                    <strong>Sincronización Fudo activa</strong> · {fudoSync.sales.length} ventas en cache · última sincronización: {new Date(fudoSync.lastSync).toLocaleString('es-CL')}
                  </span>
                </>
              ) : (
                <span className="text-sm text-amber-700">
                  Aún no hay sincronización con Fudo. Click "Sincronizar Fudo ahora" o espera al cron diario (3 AM hora Chile).
                </span>
              )}
            </div>
            <Badge variant="outline" className="text-[10px]">Cron diario configurado</Badge>
          </div>
          {syncResult && (
            <p className={`text-xs mt-2 ${syncResult.ok ? 'text-noa-success' : 'text-red-600'}`}>
              {syncResult.message}
            </p>
          )}
        </CardContent>
      </Card>

      {sales.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-gray-700">Aún no hay ventas en cache</p>
            <p className="text-sm mt-1">Click "Sincronizar Fudo ahora" arriba para traer las ventas del último período, o espera al cron diario.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Kpi icon={DollarSign} label={`Ventas ${stats.currentMonthLabel}`} value={clpShort(stats.currentMonthSales)} sub={stats.salesDelta} />
            <Kpi icon={Percent} label="Total Impuestos" value={clpShort(stats.totalTax)} />
            <Kpi icon={Coins} label="Total Descuento" value={clpShort(-stats.totalDiscount)} />
            <Kpi icon={TrendingUp} label="Propinas Totales" value={clpShort(stats.totalTips)} />
            <Kpi icon={Receipt} label="Ticket promedio" value={clp(stats.avgTicket)} />
            <Kpi icon={Clock} label="Transacciones" value={stats.count.toLocaleString('es-CL')} highlight />
          </div>

          {/* Comparativas temporales */}
          <div>
            <h2 className="text-lg font-semibold text-noa-navy mb-3 flex items-center gap-2">
              <span className="text-noa-orange">◆</span> Comparativas Temporales
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-semibold text-gray-700 mb-4">Ventas por mes</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={stats.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={clpShort} />
                      <Tooltip formatter={(v) => clp(v)} />
                      <Line type="monotone" dataKey="total" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-semibold text-gray-700 mb-4">Ventas diarias</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={stats.byDay}>
                      <defs>
                        <linearGradient id="vgrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={clpShort} />
                      <Tooltip formatter={(v) => clp(v)} />
                      <Area type="monotone" dataKey="total" stroke="#16A34A" fill="url(#vgrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Gráfico de barras: ventas por método de pago */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-semibold text-gray-700 mb-4">Ventas por método de pago</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.byPayment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="method" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={clpShort} />
                  <Tooltip formatter={(v) => clp(v)} />
                  <Legend />
                  <Bar dataKey="total" name="Total vendido" fill="#0C1B33" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, highlight }) {
  return (
    <Card className={highlight ? 'border-noa-orange/30 bg-noa-orange/5' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-1.5 text-gray-500 mb-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-xl font-bold ${highlight ? 'text-noa-navy' : 'text-gray-900'}`}>{value}</p>
        {sub != null && (
          <p className={`text-xs mt-1 ${sub >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {sub >= 0 ? '↑' : '↓'} {Math.abs(sub).toFixed(1)}% vs mes anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function computeStats(sales) {
  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth();

  let totalTax = 0, totalDiscount = 0, totalTips = 0, currentMonthSales = 0, prevMonthSales = 0;
  const byMonthMap = {};
  const byDayMap = {};
  const byPaymentMap = {};

  for (const s of sales) {
    const amt = Number(s.total_amount) || 0;
    totalTax += Number(s.tax_amount) || 0;
    totalDiscount += Number(s.discount_amount) || 0;
    totalTips += Number(s.tip_amount) || 0;

    const d = new Date(s.date_time);
    if (!Number.isNaN(d.getTime())) {
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonthMap[mKey] = (byMonthMap[mKey] || 0) + amt;
      const dayKey = d.toISOString().slice(0, 10);
      byDayMap[dayKey] = (byDayMap[dayKey] || 0) + amt;
      if (d.getFullYear() === curY && d.getMonth() === curM) currentMonthSales += amt;
      const pm = new Date(curY, curM - 1, 1);
      if (d.getFullYear() === pm.getFullYear() && d.getMonth() === pm.getMonth()) prevMonthSales += amt;
    }
    const method = s.payment_method || 'Otros';
    byPaymentMap[method] = (byPaymentMap[method] || 0) + amt;
  }

  const byMonth = Object.entries(byMonthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, total]) => {
    const [y, m] = k.split('-');
    return { label: `${MONTHS[Number(m) - 1]} ${y.slice(2)}`, total };
  });
  const byDay = Object.entries(byDayMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-60).map(([k, total]) => {
    const d = new Date(k + 'T00:00:00');
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, total };
  });
  const byPayment = Object.entries(byPaymentMap).sort((a, b) => b[1] - a[1]).map(([method, total]) => ({ method, total }));

  const count = sales.length;
  const totalAll = sales.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
  const avgTicket = count ? totalAll / count : 0;
  const salesDelta = prevMonthSales > 0 ? ((currentMonthSales - prevMonthSales) / prevMonthSales) * 100 : null;

  return {
    count, totalTax, totalDiscount, totalTips, currentMonthSales, avgTicket, salesDelta,
    currentMonthLabel: `${MONTHS[curM]} ${curY}`,
    byMonth, byDay, byPayment,
  };
}
