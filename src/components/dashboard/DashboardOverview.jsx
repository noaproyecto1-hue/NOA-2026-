import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Sun, CalendarDays, Flag, ShoppingCart, TrendingUp, Wallet, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const { data: fudoSync = { sales: [] } } = useQuery({
    queryKey: ['overview-fudo-sync'],
    queryFn: async () => { const r = await fetch('/__fudo/sync-pull'); return r.ok ? await r.json() : { sales: [] }; },
    staleTime: 60 * 1000,
  });

  // Venta neta de HOY desde Fudo (CLOSED). Neto = total / 1.19 (IVA Chile).
  const ventaNetaHoy = useMemo(() => {
    const ventas = (fudoSync.sales || []).filter((s) => !s.is_cancelled && (s.date_time || '').slice(0, 10) === today);
    const bruto = ventas.reduce((a, s) => a + (Number(s.total_amount) || 0), 0);
    return { neto: Math.round(bruto / 1.19), bruto, count: ventas.length, hasFudo: (fudoSync.sales || []).length > 0 };
  }, [fudoSync, today]);

  const META_DIARIA = 1000000;
  const ventaColor = ventaNetaHoy.neto >= META_DIARIA ? '#16A34A' : ventaNetaHoy.neto >= 700000 ? '#F59E0B' : '#DC2626';
  const ventaPct = Math.min(100, ventaNetaHoy.neto / META_DIARIA * 100);

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

  // Eficiencia global: composite simple (margen neto normalizado + control de costos)
  const eficiencia = useMemo(() => {
    const margenScore = Math.max(0, Math.min(100, M.margenNeto * 2)); // 50% margen → 100
    const costoScore = Math.max(0, 100 - M.ratioCompraVenta); // menos costo = mejor
    return Math.round((margenScore * 0.5 + costoScore * 0.5));
  }, [M]);

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
      {/* Venta Neta del día (datos reales de Fudo) con barra de color vs meta diaria */}
      <Card className="overflow-hidden">
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
          {/* Barra de color: rojo <700k · amarillo 700k-1M · verde >1M */}
          <div className="mt-4">
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden relative">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, ventaPct)}%`, backgroundColor: ventaColor }} />
              {/* marcas 70% y 100% */}
              <div className="absolute top-0 bottom-0" style={{ left: '70%', width: '1px', background: 'rgba(0,0,0,.15)' }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>$0</span><span>$700K</span><span>$1M</span>
            </div>
          </div>
        </CardContent>
      </Card>

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

          <MetricRow icon={Wallet} title="UTILIDAD NETA ESTIMADA" color="#F59E0B"
            cols={[
              { icon: Sun, label: 'Hoy', value: clp(M.utilHoy), tag: `Margen neto ${M.margenHoy.toFixed(0)}%`, tagOk: M.utilHoy >= 0, foot: 'margen neto', barPct: Math.max(0, M.margenHoy * 2), accent: true },
              { icon: CalendarDays, label: `Acumulada (${M.diasAcum} días)`, value: clp(M.utilAcum), tag: `Margen neto ${M.margenNeto.toFixed(0)}%`, tagOk: M.utilAcum >= 0, foot: 'margen neto', barPct: Math.max(0, M.margenNeto * 2), accent: true },
              { icon: Flag, label: 'Proyectada fin de mes', value: clp(M.utilProj), tag: `Margen neto ${M.margenProj.toFixed(0)}%`, tagOk: M.utilProj >= 0, foot: 'margen neto', barPct: Math.max(0, M.margenProj * 2), accent: true },
            ]} />
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

      {/* KPIs strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiStrip value={clp(M.ventaDiaProm)} label="Promedio venta / día" color="text-noa-info" />
        <KpiStrip value={pct(M.ratioCompraVenta)} label="Ratio compra / venta" color="text-green-600" />
        <KpiStrip value={pct(M.opexSobreVenta)} label="OPEX / venta" color="text-noa-orange-dk" />
        <KpiStrip value={pct(M.margenNeto)} label="Margen neto estimado" color="text-noa-orange-dk" />
      </div>

      {/* Eficiencia + Alertas de precio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card><CardContent className="pt-6 flex flex-col items-center justify-center">
          <Donut value={eficiencia} label="" color="#2563EB" size={150} />
          <p className="text-sm font-bold text-noa-navy mt-2 font-display">EFICIENCIA GLOBAL</p>
          <p className="text-xs text-gray-500">Rendimiento del restaurante</p>
        </CardContent></Card>

        <Card className="lg:col-span-2"><CardContent className="pt-6">
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
    </div>
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
