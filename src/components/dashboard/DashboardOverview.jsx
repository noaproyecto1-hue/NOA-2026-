import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import { Sun, CalendarDays, Flag, ShoppingCart, TrendingUp, Wallet, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, Loader2, Pencil } from 'lucide-react';

// Config de metas (editable). Todo se rige por la utilidad objetivo (default 15%).
function loadDashCfg() {
  try { const c = JSON.parse(localStorage.getItem('noa_dash_cfg') || '{}'); return { utilPct: c.utilPct ?? 15, metaMensual: c.metaMensual ?? 10000000 }; }
  catch { return { utilPct: 15, metaMensual: 10000000 }; }
}

// ───────── helpers ─────────
function clp(n) { return (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }); }
function clpK(n) { const v = Number(n) || 0; if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`; if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`; return `$${Math.round(v)}`; }
function pct(n) { return `${(Number(n) || 0).toFixed(0)}%`; }
function todayKey(tz = 'America/Santiago') {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}

// Donut SVG simple (anillo de progreso)
function Donut({ value, label, sub, color = '#0EA5E9', size = 96 }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} strokeLinecap="round" />
        <text x="50%" y="50%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central"
          className="font-display font-bold" fill="#0C1B33" fontSize={size * 0.22}>{Math.round(value)}%</text>
      </svg>
      <p className="text-sm font-semibold text-noa-navy mt-2">{label}</p>
      {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

// Alerta de precio (donut rojo/verde con %)
function PriceAlert({ rank, name, pctChange, from, to, unit }) {
  const size = 110, r = size / 2 - 9, c = 2 * Math.PI * r;
  const up = pctChange >= 0;
  const fill = Math.min(100, Math.abs(pctChange) * 3);
  return (
    <div className="flex flex-col items-center px-3 shrink-0 w-[150px]">
      <div className="relative">
        <span className="absolute -top-1 right-0 z-10 text-[10px] font-semibold text-white bg-red-500 rounded-full px-2 py-0.5">#{rank} alza</span>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#16A34A" strokeWidth="9" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#DC2626" strokeWidth="9"
            strokeDasharray={c} strokeDashoffset={c - (fill / 100) * c} strokeLinecap="round" />
          <text x="50%" y="46%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="20" className="font-bold font-display">{up ? '+' : ''}{pctChange.toFixed(0)}%</text>
          <text x="50%" y="62%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="14">↑</text>
        </svg>
      </div>
      <p className="text-sm font-semibold text-noa-navy mt-1">{name}</p>
      <p className="text-[11px] text-gray-500">{clpK(from)}/{unit} → {clpK(to)}/{unit}</p>
    </div>
  );
}

export default function DashboardOverview({ sales = [], supplyCosts = [], opexByType = {}, restaurantId, tz = 'America/Santiago' }) {
  const today = todayKey(tz);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const queryClient = useQueryClient();

  // Config editable de metas (utilidad objetivo + meta mensual de venta)
  const [cfg, setCfg] = useState(loadDashCfg);
  const [editCfg, setEditCfg] = useState(false);
  const META_MENSUAL = cfg.metaMensual;
  const META_DIARIA = META_MENSUAL / daysInMonth;
  const UTIL_OBJETIVO = cfg.utilPct;            // % utilidad objetivo (default 15)
  const utilidadObjetivoMonto = META_MENSUAL * UTIL_OBJETIVO / 100; // "$ en plata"

  // Histórico de compras para alertas de precio
  const { data: allCosts = [] } = useQuery({
    queryKey: ['overview-costs', restaurantId],
    queryFn: async () => {
      const all = restaurantId ? await base44.entities.SupplyCost.filter({ restaurant_id: restaurantId }) : await base44.entities.SupplyCost.list();
      return (all || []).filter((c) => c.supply_type !== 'opex');
    },
    enabled: true, staleTime: 2 * 60 * 1000,
  });

  // Ventas reales de Fudo (cache KV) para la Venta Neta del día
  const { data: fudoSync = { sales: [] }, isFetching: fudoFetching } = useQuery({
    queryKey: ['overview-fudo-sync'],
    queryFn: async () => { const r = await fetch('/__fudo/sync-pull'); return r.ok ? await r.json() : { sales: [] }; },
    staleTime: 60 * 1000,
  });

  // Sincroniza ventas reales de Fudo al cargar la plataforma (una vez) + botón.
  const [syncing, setSyncing] = useState(false);
  async function actualizar() {
    setSyncing(true);
    try { await fetch('/__fudo/sync-pull', { method: 'POST' }); queryClient.invalidateQueries({ queryKey: ['overview-fudo-sync'] }); }
    catch {} finally { setSyncing(false); }
  }
  useEffect(() => {
    // Auto-sync al montar si la última sync es vieja (>30 min) o no hay datos.
    const last = fudoSync?.lastSync ? new Date(fudoSync.lastSync).getTime() : 0;
    if (!last || (Date.now() - last) > 30 * 60 * 1000) actualizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Venta neta de HOY desde Fudo (CLOSED). Neto = total / 1.19 (IVA Chile).
  const ventaNetaHoy = useMemo(() => {
    const ventas = (fudoSync.sales || []).filter((s) => !s.is_cancelled && (s.date_time || '').slice(0, 10) === today);
    const bruto = ventas.reduce((a, s) => a + (Number(s.total_amount) || 0), 0);
    return { neto: Math.round(bruto / 1.19), bruto, count: ventas.length, hasFudo: (fudoSync.sales || []).length > 0 };
  }, [fudoSync, today]);

  const ventaColor = ventaNetaHoy.neto >= META_DIARIA ? '#16A34A' : ventaNetaHoy.neto >= META_DIARIA * 0.7 ? '#F59E0B' : '#DC2626';
  const ventaPct = META_DIARIA > 0 ? Math.min(100, ventaNetaHoy.neto / META_DIARIA * 100) : 0;

  // Tendencia de utilidad estimada: últimos 3 meses desde Fudo (neto * margen actual)
  const tendencia3m = useMemo(() => {
    const ventasMes = {};
    for (const s of (fudoSync.sales || [])) {
      if (s.is_cancelled) continue;
      const k = (s.date_time || '').slice(0, 7); if (!k) continue;
      ventasMes[k] = (ventasMes[k] || 0) + (Number(s.total_amount) || 0) / 1.19;
    }
    const meses = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      meses.push({ label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][d.getMonth()], neto: ventasMes[k] || 0 });
    }
    return meses;
  }, [fudoSync, now]);

  const M = useMemo(() => {
    const saleDay = (s) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s.date_time)); } catch { return ''; } };
    // Ventas (bruto)
    const ventaAcum = sales.reduce((a, s) => a + (Number(s.total_amount) || 0), 0);
    const ventaHoy = sales.filter((s) => saleDay(s) === today).reduce((a, s) => a + (Number(s.total_amount) || 0), 0);
    const ventaDiaProm = dayOfMonth > 0 ? ventaAcum / dayOfMonth : 0;
    const ventaProj = ventaDiaProm * daysInMonth;

    // Compras (pagadas y no)
    const compraAcum = supplyCosts.reduce((a, c) => a + (Number(c.total_cost) || 0), 0);
    const compraHoy = supplyCosts.filter((c) => (c.date || '').slice(0, 10) === today).reduce((a, c) => a + (Number(c.total_cost) || 0), 0);
    const compraProj = dayOfMonth > 0 ? (compraAcum / dayOfMonth) * daysInMonth : 0;

    // OPEX
    const opexTotal = Object.values(opexByType).reduce((a, b) => a + b, 0);
    const opexDiario = opexTotal / 30;

    // Utilidad neta estimada = venta - compra - opex prorrateado
    const opexAcumProrr = opexDiario * dayOfMonth;
    const utilHoy = ventaHoy - compraHoy - opexDiario;
    const utilAcum = ventaAcum - compraAcum - opexAcumProrr;
    const utilProj = ventaProj - compraProj - opexTotal;

    const ratioCompraVenta = ventaAcum > 0 ? compraAcum / ventaAcum * 100 : 0;
    const opexSobreVenta = ventaProj > 0 ? opexTotal / ventaProj * 100 : 0;
    const margenNeto = ventaAcum > 0 ? utilAcum / ventaAcum * 100 : 0;
    const margenHoy = ventaHoy > 0 ? utilHoy / ventaHoy * 100 : 0;
    const margenProj = ventaProj > 0 ? utilProj / ventaProj * 100 : 0;

    return {
      ventaHoy, ventaAcum, ventaProj, ventaDiaProm,
      compraHoy, compraAcum, compraProj,
      utilHoy, utilAcum, utilProj,
      opexTotal, opexDiario, ratioCompraVenta, opexSobreVenta, margenNeto, margenHoy, margenProj,
      diasAcum: dayOfMonth,
    };
  }, [sales, supplyCosts, opexByType, today, dayOfMonth, daysInMonth, tz]);

  // OPEX por categoría (donuts)
  const opexCats = useMemo(() => {
    const map = { 'RRHH': 0, 'Renta': 0, 'Gastos fijos y ADM': 0, 'Marketing': 0 };
    for (const [type, amt] of Object.entries(opexByType)) {
      if (type === 'payroll') map['RRHH'] += amt;
      else if (type === 'rent') map['Renta'] += amt;
      else if (type === 'marketing') map['Marketing'] += amt;
      else map['Gastos fijos y ADM'] += amt;
    }
    const ventaRef = M.ventaProj || M.ventaAcum || 1;
    const colors = { 'RRHH': '#2563EB', 'Renta': '#16A34A', 'Gastos fijos y ADM': '#F59E0B', 'Marketing': '#EC4899' };
    return Object.entries(map).map(([name, amt]) => ({
      name, amt, color: colors[name],
      pctVenta: ventaRef > 0 ? amt / ventaRef * 100 : 0,
      diario: amt / 30,
    }));
  }, [opexByType, M]);

  // Eficiencia global lineal vs utilidad objetivo:
  // margen = utilObjetivo (15%) → 100% · margen 0% → 0% · margen -utilObjetivo → -100%
  const eficiencia = useMemo(() => {
    const base = UTIL_OBJETIVO || 15;
    const e = (M.margenNeto / base) * 100;
    return Math.round(Math.max(-100, Math.min(100, e)));
  }, [M, UTIL_OBJETIVO]);
  const eficienciaColor = eficiencia >= 66 ? '#16A34A' : eficiencia >= 33 ? '#F59E0B' : '#DC2626';

  // Alertas de precio: comparar último vs penúltimo precio por insumo
  const priceAlerts = useMemo(() => {
    const byItem = {};
    for (const c of allCosts) {
      const n = c.supply_item_name || c.supply_name; if (!n) continue;
      const qty = Number(c.quantity_purchased) || 0;
      const unitPrice = qty > 0 ? (Number(c.subtotal) || Number(c.total_cost) || 0) / qty : 0;
      if (unitPrice <= 0) continue;
      (byItem[n] = byItem[n] || []).push({ date: c.date || '', price: unitPrice, unit: c.unit_of_measure || 'kg' });
    }
    const alerts = [];
    for (const [name, list] of Object.entries(byItem)) {
      if (list.length < 2) continue;
      list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const prev = list[list.length - 2].price, last = list[list.length - 1].price;
      if (prev > 0 && last > prev) alerts.push({ name, pctChange: (last - prev) / prev * 100, from: prev, to: last, unit: list[list.length - 1].unit });
    }
    return alerts.sort((a, b) => b.pctChange - a.pctChange).slice(0, 8);
  }, [allCosts]);

  const [alertPage, setAlertPage] = useState(0);
  const perPage = 4;
  const pageAlerts = priceAlerts.slice(alertPage * perPage, alertPage * perPage + perPage);
  const totalPages = Math.ceil(priceAlerts.length / perPage);

  return (
    <div className="space-y-6 font-sans">
      {/* Botón Actualizar (sincroniza ventas reales de Fudo) */}
      <div className="flex justify-end">
        <Button onClick={actualizar} disabled={syncing || fudoFetching} variant="outline" size="sm">
          {(syncing || fudoFetching) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          {(syncing || fudoFetching) ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>

      {/* Fila superior: Venta Neta + Meta mensual / Eficiencia Global */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="overflow-hidden lg:col-span-2">
        <CardContent className="pt-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-600">Venta Neta — Hoy</p>
                {ventaNetaHoy.hasFudo
                  ? <span className="text-[10px] font-semibold text-noa-success bg-noa-success/15 rounded-full px-2 py-0.5">● Fudo en vivo</span>
                  : <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">sin datos Fudo</span>}
              </div>
              <p className="text-3xl font-bold font-display mt-1" style={{ color: ventaColor }}>{clp(ventaNetaHoy.neto)}</p>
              <p className="text-xs text-gray-500 mt-1">{ventaNetaHoy.count} ventas cerradas · bruto {clp(ventaNetaHoy.bruto)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Meta diaria</p>
              <p className="text-lg font-bold text-noa-navy">{clp(META_DIARIA)}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: ventaColor }}>{ventaPct.toFixed(0)}% de la meta</p>
            </div>
          </div>
          {/* Barra de color vs meta diaria (rojo <70% · amarillo 70-100% · verde >100%) */}
          <div className="mt-4">
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden relative">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, ventaPct)}%`, backgroundColor: ventaColor }} />
              <div className="absolute top-0 bottom-0" style={{ left: '70%', width: '1px', background: 'rgba(0,0,0,.15)' }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>$0</span><span>70%</span><span>Meta {clp(META_DIARIA)}</span>
            </div>
          </div>
          {/* Meta mensual en la misma ventana */}
          <div className="mt-4 pt-3 border-t flex items-center justify-between">
            <span className="text-xs text-gray-500">Meta mensual de venta</span>
            <span className="font-bold text-noa-navy">{clp(META_MENSUAL)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Eficiencia Global (arriba) */}
      <Card><CardContent className="pt-6 flex flex-col items-center justify-center h-full">
        <Donut value={eficiencia} label="" color={eficienciaColor} size={140} />
        <p className="text-sm font-bold text-noa-navy mt-2 font-display">EFICIENCIA GLOBAL</p>
        <p className="text-xs text-gray-500 text-center">Utilidad {M.margenNeto.toFixed(1)}% vs objetivo {UTIL_OBJETIVO}%</p>
      </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: VENTA / COMPRA / UTILIDAD */}
        <div className="lg:col-span-2 space-y-5">
          <MetricRow icon={TrendingUp} title="VENTA" color="#0C1B33"
            cols={[
              { icon: Sun, label: 'Hoy', value: clp(M.ventaHoy), tag: M.ventaHoy >= M.ventaDiaProm ? 'Sobre promedio' : 'Bajo promedio', tagOk: M.ventaHoy >= M.ventaDiaProm, foot: 'vs promedio diario', barPct: M.ventaDiaProm > 0 ? Math.min(100, M.ventaHoy / M.ventaDiaProm * 100) : 0 },
              { icon: CalendarDays, label: `Acumulada (${M.diasAcum} días)`, value: clp(M.ventaAcum), tag: 'En curso', tagOk: true, foot: '% del mes', barPct: M.diasAcum / daysInMonth * 100 },
              { icon: Flag, label: 'Proyectada fin de mes', value: clp(M.ventaProj), tag: `${clpK(M.ventaDiaProm)}/día prom.`, tagOk: true, foot: 'proyección', barPct: M.diasAcum / daysInMonth * 100 },
            ]} />

          <MetricRow icon={ShoppingCart} title="COMPRA" color="#0C1B33"
            cols={[
              { icon: Sun, label: 'Hoy', value: clp(M.compraHoy), tag: `${(M.ventaHoy > 0 ? M.compraHoy / M.ventaHoy * 100 : 0).toFixed(0)}% sobre venta`, tagOk: true, foot: 'ratio compra/venta hoy', barPct: M.ratioCompraVenta },
              { icon: CalendarDays, label: `Acumulada (${M.diasAcum} días)`, value: clp(M.compraAcum), tag: `${M.ratioCompraVenta.toFixed(0)}% sobre venta`, tagOk: true, foot: 'ratio compra/venta', barPct: M.ratioCompraVenta },
              { icon: Flag, label: 'Proyectada fin de mes', value: clp(M.compraProj), tag: `Ratio ${M.ratioCompraVenta.toFixed(0)}%`, tagOk: true, foot: 'ratio compra/venta', barPct: M.ratioCompraVenta },
            ]} />

          {/* UTILIDAD NETA ESTIMADA — solo proyectada mensual + tendencia 3 meses */}
          <div>
            <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-2 uppercase tracking-wide"><Wallet className="w-3.5 h-3.5" /> UTILIDAD NETA ESTIMADA</p>
            <Card className="border-t-2" style={{ borderTopColor: '#F59E0B' }}>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1"><Flag className="w-3.5 h-3.5" /> Proyectada fin de mes</div>
                    <p className="text-2xl font-bold text-noa-navy font-display">{clp(M.utilProj)}</p>
                    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full mt-1 ${M.utilProj >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      Margen neto {M.margenProj.toFixed(0)}% · objetivo {UTIL_OBJETIVO}%
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1 text-right">Tendencia últimos 3 meses (venta neta)</p>
                    <ResponsiveContainer width="100%" height={90}>
                      <BarChart data={tendencia3m}>
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Bar dataKey="neto" radius={[4, 4, 0, 0]}>
                          {tendencia3m.map((_, i) => <Cell key={i} fill={i === tendencia3m.length - 1 ? '#F59E0B' : '#0C1B33'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Columna derecha: OPEX */}
        <Card className="h-fit">
          <CardContent className="pt-5">
            <p className="text-sm font-semibold text-noa-navy flex items-center gap-1.5 mb-1"><Wallet className="w-4 h-4" /> OPEX — GASTOS OPERACIONALES</p>
            <p className="text-[11px] text-gray-500 mb-4">Calculados sobre venta proyectada · distribuidos en 30 días</p>
            <div className="grid grid-cols-2 gap-4">
              {opexCats.map((o) => (
                <div key={o.name} className="flex flex-col items-center">
                  <Donut value={o.pctVenta} color={o.color} size={86} />
                  <p className="text-xs font-semibold text-noa-navy mt-1 text-center">{o.name}</p>
                  <p className="text-[10px] text-gray-500">{clpK(o.diario)}/día</p>
                  <p className="text-[10px] text-gray-400">{clpK(o.amt)}/mes</p>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-3 flex items-center justify-between">
              <div><p className="text-[11px] text-gray-500">OPEX diario (promedio)</p><p className="font-bold text-noa-navy">{clp(M.opexDiario)}</p></div>
              <div className="text-right"><p className="text-[11px] text-gray-500">% sobre venta</p><p className="font-bold text-noa-orange-dk">{M.opexSobreVenta.toFixed(0)}%</p></div>
            </div>
            <div className="border-t mt-3 pt-3">
              <p className="text-[11px] text-gray-500">Total OPEX mensual proyectado</p>
              <p className="text-xl font-bold text-noa-navy font-display">{clp(M.opexTotal)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs strip: Utilidad objetivo (editable) + Costo directo de compra */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-noa-orange/5 border-noa-orange/30"><CardContent className="pt-5 text-center relative">
          <button onClick={() => setEditCfg(true)} className="absolute top-3 right-3 text-gray-400 hover:text-noa-navy" title="Editar objetivo">
            <Pencil className="w-4 h-4" />
          </button>
          <p className="text-2xl font-bold font-display text-noa-orange-dk">{UTIL_OBJETIVO}% de utilidad</p>
          <p className="text-sm font-semibold text-noa-navy mt-1">{clp(utilidadObjetivoMonto)}</p>
          <p className="text-xs text-gray-500 mt-1">objetivo mensual · meta {clp(META_MENSUAL)}</p>
        </CardContent></Card>
        <KpiStrip value={pct(M.ratioCompraVenta)} label="Costo directo de compra" color="text-green-600" />
      </div>

      {/* Alertas de precio */}
      <div className="grid grid-cols-1 gap-6">
        <Card><CardContent className="pt-6">
          <p className="text-sm font-semibold text-noa-navy flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-noa-orange" /> ALERTAS DE PRECIO — ÚLTIMA COMPRA</p>
          <p className="text-[11px] text-gray-500 mb-4">Insumos ordenados de mayor a menor alza · vs compra anterior</p>
          {priceAlerts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin alzas de precio detectadas.</p>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setAlertPage((p) => Math.max(0, p - 1))} disabled={alertPage === 0} className="p-1.5 rounded-full border disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <div className="flex-1 flex justify-around overflow-hidden">
                {pageAlerts.map((a, i) => <PriceAlert key={a.name} rank={alertPage * perPage + i + 1} {...a} />)}
              </div>
              <button onClick={() => setAlertPage((p) => Math.min(totalPages - 1, p + 1))} disabled={alertPage >= totalPages - 1} className="p-1.5 rounded-full border disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </CardContent></Card>
      </div>

      {editCfg && (
        <EditMetaDialog cfg={cfg} onClose={() => setEditCfg(false)} onSave={(next) => {
          setCfg(next); try { localStorage.setItem('noa_dash_cfg', JSON.stringify(next)); } catch {} setEditCfg(false);
        }} />
      )}
    </div>
  );
}

function EditMetaDialog({ cfg, onClose, onSave }) {
  const [utilPct, setUtilPct] = useState(cfg.utilPct);
  const [metaMensual, setMetaMensual] = useState(cfg.metaMensual);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="font-sans max-w-md">
        <DialogHeader><DialogTitle className="font-display text-noa-navy">Objetivo de utilidad y meta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Utilidad objetivo (%)</label>
            <Input type="number" value={utilPct} onChange={(e) => setUtilPct(e.target.value)} />
            <p className="text-[11px] text-gray-400">La eficiencia global y todas las metas se rigen por este %.</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Meta mensual de venta (CLP)</label>
            <Input type="number" value={metaMensual} onChange={(e) => setMetaMensual(e.target.value)} />
            <p className="text-[11px] text-gray-400">Meta diaria = meta mensual ÷ días del mes.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" onClick={() => onSave({ utilPct: Number(utilPct) || 15, metaMensual: Number(metaMensual) || 10000000 })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricRow({ icon: Icon, title, cols, color }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-2 uppercase tracking-wide"><Icon className="w-3.5 h-3.5" /> {title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cols.map((c, i) => {
          const CI = c.icon;
          return (
            <Card key={i} className={c.accent ? 'border-t-2' : ''} style={c.accent ? { borderTopColor: '#F59E0B' } : {}}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1"><CI className="w-3.5 h-3.5" /> {c.label}</div>
                <p className="text-lg font-bold text-noa-navy font-display">{c.value}</p>
                <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full mt-1 ${c.tagOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{c.tag}</span>
                <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                  <span>{c.foot}</span><span>{Math.round(c.barPct)}%</span>
                </div>
                <div className="h-1 rounded-full bg-gray-100 mt-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.barPct)}%`, backgroundColor: c.accent ? '#F59E0B' : '#0C1B33' }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function KpiStrip({ value, label, color }) {
  return (
    <Card className="bg-gray-50/50"><CardContent className="pt-5 text-center">
      <p className={`text-2xl font-bold font-display ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </CardContent></Card>
  );
}
