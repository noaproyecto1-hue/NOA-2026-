import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  TrendingUp, Receipt, Percent, DollarSign, Coins, Clock, BarChart3, Loader2,
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
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['panel-ventas-sales', user?.restaurant_ids],
    queryFn: async () => {
      const rid = user?.restaurant_ids?.[0];
      const all = rid ? await base44.entities.Sale.filter({ restaurant_id: rid }) : await base44.entities.Sale.list();
      return (all || []).filter((s) => !s.is_cancelled);
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const stats = useMemo(() => computeStats(sales), [sales]);

  if (isLoading) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando ventas…</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-noa-navy flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-noa-orange" /> Panel de Ventas
        </h1>
        <p className="text-gray-600 mt-1">Ventas, ticket promedio y márgenes de tu negocio.</p>
      </div>

      {sales.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-gray-700">Aún no hay ventas cargadas</p>
            <p className="text-sm mt-1">Sincroniza tu POS Fudo (Settings → Integraciones) o importa ventas en "Ventas y Compras".</p>
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
