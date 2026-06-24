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

// ── MODO PRESENTACIÓN — Dataset demo "Casa Mediterránea" (PDF CAMBIOS_REV4) ──
// Números fijos para la presentación del día 26/30. Coherencia verificada:
// 61.100.000 − 19.552.000 − 16.191.500 − 17.719.000 = 7.637.500 ✓
const DEMO_MODE = true;
const DEMO_CASA = {
  periodo: 'Junio 2026 · Día 26 de 30',
  diasAcum: 26, diasMes: 30,
  metaMensual: 70000000, metaDiaria: 2333333, utilPct: 10,
  ventaHoy: 2333333, ventaAcum: 61100000, ventaProj: 70500000, ventaDiaProm: 2350000,
  compraHoy: 746667, compraAcum: 19552000, compraProj: 22560000, ratioCompraVenta: 32,
  opexHoy: 619167, opexAcum: 16191500, opexProj: 18682500, opexPct: 26.5,
  utilHoy: 368500, utilAcum: 7637500, utilProj: 8812500, margenHoy: 15.8, margenNeto: 12.5, margenProj: 12.5,
  ventaNetaHoy: { neto: 2333333, bruto: 2618132, count: 104, hasFudo: true },
  noa: { score: 76, zona: 'riesgo_medio', driver: 'OPEX', foodCostPct: 32, laborCostPct: 29, opexPct: 26.5, BM: { food: 30, labor: 30, opex: 25 } },
  noaResumen: 'OPEX en 26.5% sobre venta — +1.5pp sobre benchmark (25%). Food cost en 32% — +2pp sobre benchmark (30%). Margen positivo 12.5%, sobre el mínimo de 10%.',
  tendencia3m: [{ label: 'Abr', neto: 57800000 }, { label: 'May', neto: 59300000 }, { label: 'Jun', neto: 61100000 }],
};

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
  const daysInMonth = DEMO_MODE ? DEMO_CASA.diasMes : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = DEMO_MODE ? DEMO_CASA.diasAcum : now.getDate();
  const queryClient = useQueryClient();

  // Config editable de metas (utilidad objetivo + meta mensual de venta)
  const [cfg, setCfg] = useState(loadDashCfg);
  const [editCfg, setEditCfg] = useState(false);
  const META_MENSUAL = DEMO_MODE ? DEMO_CASA.metaMensual : cfg.metaMensual;
  const META_DIARIA = DEMO_MODE ? DEMO_CASA.metaDiaria : META_MENSUAL / daysInMonth;
  const UTIL_OBJETIVO = DEMO_MODE ? DEMO_CASA.utilPct : cfg.utilPct;
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
    if (DEMO_MODE) return DEMO_CASA.ventaNetaHoy;
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
    return DEMO_MODE ? DEMO_CASA.tendencia3m : meses;
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

  // ── NOA SCORE (HORECA): Food Cost + Labor Cost + OPEX + Tendencia ──
  // Benchmarks: Food 30%, Labor 30%, OPEX 25%. Pesos: OPEX 40, Food 25, Labor 20, Tendencia 15.
  const noa = useMemo(() => {
    if (DEMO_MODE) return DEMO_CASA.noa;
    const BM = { food: 30, labor: 30, opex: 25 };
    const ventaNeta = (M.ventaAcum || 0) / 1.19;
    const payroll = Object.entries(opexByType).filter(([t]) => t === 'payroll').reduce((a, [, v]) => a + v, 0);
    const foodCostPct = M.ratioCompraVenta;                                  // compra / venta
    const laborCostPct = ventaNeta > 0 ? (payroll / ventaNeta) * 100 : 0;    // RRHH / venta neta
    const opexPct = ventaNeta > 0 ? (M.opexTotal / ventaNeta) * 100 : 0;     // OPEX / venta neta
    const sc = (real, bm) => { const d = ((real - bm) / bm) * 100; return d <= 0 ? 100 : Math.max(0, 100 - d); };
    const sFood = sc(foodCostPct, BM.food), sLabor = sc(laborCostPct, BM.labor), sOpex = sc(opexPct, BM.opex);
    const sTrend = 70; // neutral: sin histórico de score persistido (MVP)
    const P = { opex: 0.40, food: 0.25, labor: 0.20, trend: 0.15 };
    const score = Math.round(sOpex * P.opex + sFood * P.food + sLabor * P.labor + sTrend * P.trend);
    const zona = score < 50 ? 'riesgo_alto' : score < 70 ? 'riesgo_medio' : 'saludable';
    const driver = [
      { n: 'OPEX', p: (100 - sOpex) * P.opex },
      { n: 'Food cost', p: (100 - sFood) * P.food },
      { n: 'Labor cost', p: (100 - sLabor) * P.labor },
    ].sort((a, b) => b.p - a.p)[0].n;
    return { score, zona, driver, foodCostPct, laborCostPct, opexPct, BM };
  }, [M, opexByType]);
  const noaColor = noa.zona === 'saludable' ? '#16A34A' : noa.zona === 'riesgo_medio' ? '#F59E0B' : '#DC2626';
  const noaLabel = noa.zona === 'saludable' ? 'Saludable' : noa.zona === 'riesgo_medio' ? 'Atención' : 'Riesgo';
  // Objeto unificado de KPIs (demo o real)
  const K = DEMO_MODE ? DEMO_CASA : {
    diasAcum: M.diasAcum,
    ventaHoy: M.ventaHoy, ventaAcum: M.ventaAcum, ventaProj: M.ventaProj,
    compraHoy: M.compraHoy, compraAcum: M.compraAcum, compraProj: M.compraProj, ratioCompraVenta: M.ratioCompraVenta,
    opexHoy: M.opexDiario, opexAcum: M.opexDiario * M.diasAcum, opexProj: M.opexTotal, opexPct: noa.opexPct,
    utilHoy: M.utilHoy, utilAcum: M.utilAcum, utilProj: M.utilProj, margenHoy: M.margenHoy, margenNeto: M.margenNeto, margenProj: M.margenProj,
  };

  // Resumen textual del score
  const noaResumen = useMemo(() => {
    if (DEMO_MODE) return DEMO_CASA.noaResumen;
    const op = noa.opexPct, fc = noa.foodCostPct;
    const opDelta = (op - noa.BM.opex).toFixed(0);
    const partes = [];
    partes.push(`OPEX en ${op.toFixed(0)}% sobre venta — ${opDelta}pp ${op > noa.BM.opex ? 'sobre' : 'bajo'} benchmark (${noa.BM.opex}%).`);
    partes.push(`Food cost ${fc <= noa.BM.food ? 'saludable' : 'sobre rango'} (${fc.toFixed(0)}%).`);
    partes.push(M.margenNeto >= 0 ? 'Margen positivo.' : 'Margen negativo, revisar costos.');
    return partes.join(' ');
  }, [noa, M]);

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
      {/* Leyenda de zonas + botón Actualizar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-600" /> Favorable</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Atención</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Desfavorable</span>
        </div>
        <Button onClick={actualizar} disabled={syncing || fudoFetching} variant="outline" size="sm">
          {(syncing || fudoFetching) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          {(syncing || fudoFetching) ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>

      {/* Resumen NOA Score */}
      <Card className="bg-noa-navy text-white border-0">
        <CardContent className="pt-5">
          <div className="flex items-center gap-5 flex-wrap">
            <Donut value={noa.score} label="" color={noaColor} size={96} />
            <div className="flex-1 min-w-[240px]">
              <p className="text-xs text-white/60">NOA Score</p>
              <p className="text-xl font-bold font-display" style={{ color: noaColor }}>{noaLabel}</p>
              <p className="text-sm text-white/80 mt-1">{noaResumen}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* NOA Score (arriba) */}
      <Card><CardContent className="pt-6 flex flex-col items-center justify-center h-full">
        <Donut value={noa.score} label="" color={noaColor} size={140} />
        <p className="text-sm font-bold text-noa-navy mt-2 font-display">NOA Score</p>
        <p className="text-sm font-semibold" style={{ color: noaColor }}>{noaLabel}</p>
        <p className="text-[11px] text-gray-500 text-center mt-1">Driver: {noa.driver}</p>
      </CardContent></Card>
      </div>

      {/* KPIS: barras con meta/límite (marcador al centro) + semáforo */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">KPIs</p>
        <span className="text-xs text-gray-500">Período: {DEMO_MODE ? DEMO_CASA.periodo : `mes en curso · día ${K.diasAcum}`}</span>
      </div>
      <div className="space-y-2">
        <KpiCard name="VENTA" higherIsBetter
          status={statusVenta(K.ventaProj, META_MENSUAL)}
          cols={[
            { label: 'Hoy', display: clp(K.ventaHoy), value: K.ventaHoy, target: META_DIARIA },
            { label: `Acum. ${K.diasAcum} días`, display: clp(K.ventaAcum), value: K.ventaAcum, target: META_MENSUAL * (K.diasAcum / daysInMonth) },
            { label: 'Proyectado', display: clp(K.ventaProj), value: K.ventaProj, target: META_MENSUAL },
          ]} markerLabel="meta" />

        <KpiCard name="COMPRA" higherIsBetter={false}
          status={statusRatio(K.ratioCompraVenta, 30, 34)}
          cols={[
            { label: 'Hoy', display: clp(K.compraHoy), value: K.ratioCompraVenta, target: 30 },
            { label: `Acum. ${K.diasAcum} días`, display: clp(K.compraAcum), value: K.ratioCompraVenta, target: 30 },
            { label: 'Proyectado', display: clp(K.compraProj), value: K.ratioCompraVenta, target: 30 },
          ]} markerLabel="límite" />

        <KpiCard name="OPEX" higherIsBetter={false}
          status={statusRatio(K.opexPct, 25, 28)}
          cols={[
            { label: 'Hoy', display: clp(K.opexHoy), value: K.opexPct, target: 25 },
            { label: `Acum. ${K.diasAcum} días`, display: clp(K.opexAcum), value: K.opexPct, target: 25 },
            { label: 'Proyectado', display: clp(K.opexProj), value: K.opexPct, target: 25 },
          ]} markerLabel="límite" />

        <KpiCard name="UTILIDAD NETA" higherIsBetter
          status={statusUtilidad(K.margenNeto)}
          cols={[
            { label: 'Hoy', display: clp(K.utilHoy), value: K.margenHoy, target: 10 },
            { label: `Acum. ${K.diasAcum} días`, display: clp(K.utilAcum), value: K.margenNeto, target: 10 },
            { label: 'Proyectado', display: clp(K.utilProj), value: K.margenProj, target: 10 },
          ]} markerLabel="meta" />
      </div>

      {/* Leyenda de barras */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#378ADD' }} /> sobre meta / bajo límite</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#E24B4A' }} /> bajo meta / sobre límite</span>
      </div>

      {/* Tendencia 3 meses */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-[11px] text-gray-400 mb-1">Tendencia últimos 3 meses (venta neta)</p>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={tendencia3m}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Bar dataKey="neto" radius={[4, 4, 0, 0]}>
                {tendencia3m.map((_, i) => <Cell key={i} fill={i === tendencia3m.length - 1 ? '#F59E0B' : '#0C1B33'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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

      {/* Panel de alertas — Compra / Óptimo / Fuga (Robo · Desviación · Merma · Precio) */}
      <div>
        <p className="text-sm font-semibold text-noa-navy flex items-center gap-1.5 mb-3"><AlertTriangle className="w-4 h-4 text-noa-orange" /> Panel de alertas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ALERTAS_DEMO.map((a) => <AlertCard key={a.producto} a={a} />)}
        </div>
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
            <p className="text-[11px] text-gray-400">La meta diaria/mensual se rige por este objetivo de utilidad.</p>
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

// ── Panel de alertas (dataset demo del PDF: Casa Mediterránea, junio 2026) ──
const ALERTAS_DEMO = [
  { producto: 'Lomo vetado', tipo: 'Robo', sev: 82, estado: 'critico',
    compra: { monto: 485000, cant: '12 kg' }, optimo: { monto: 323000, cant: '8 kg' }, fuga: { monto: 162000, cant: '4 kg' } },
  { producto: 'Aceite de oliva virgen', tipo: 'Desviación', sev: 58, estado: 'atencion',
    compra: { monto: 124000, cant: '18 lt' }, optimo: { monto: 96000, cant: '14 lt' }, fuga: { monto: 28000, cant: '4 lt' } },
  { producto: 'Salmón fresco', tipo: 'Merma', sev: 41, estado: 'atencion',
    compra: { monto: 378000, cant: '9 kg' }, optimo: { monto: 336000, cant: '8 kg' }, fuga: { monto: 42000, cant: '1 kg' } },
  { producto: 'Tomate rama', tipo: 'Precio', sev: 35, estado: 'atencion',
    compra: { monto: 89000, cant: '$4.450/kg' }, optimo: { monto: 66000, cant: '$3.300/kg' }, fuga: { monto: 23000, cant: '+$1.150/kg' } },
];
const PILL_STYLE = {
  Robo: { bg: '#FCEBEB', border: '#F09595', color: '#A32D2D' },
  Desviación: { bg: '#FAEEDA', border: '#FAC775', color: '#633806' },
  Merma: { bg: '#E1F5EE', border: '#9FE1CB', color: '#085041' },
  Precio: { bg: '#E6F1FB', border: '#85B7EB', color: '#0C447C' },
};
function AlertCard({ a }) {
  const [open, setOpen] = useState(false);
  const pill = PILL_STYLE[a.tipo] || PILL_STYLE.Precio;
  const st = STATUS_STYLE[a.estado] || STATUS_STYLE.atencion;
  const fugaPct = a.compra.monto > 0 ? (a.fuga.monto / a.compra.monto) * 100 : 0;
  const optimoPct = a.compra.monto > 0 ? (a.optimo.monto / a.compra.monto) * 100 : 0;
  const ACCIONES = {
    Robo: 'Posible robo interno. Audita stock vs. compras y restringe accesos a bodega.',
    Desviación: 'Consumo sobre lo óptimo. Revisa porciones y estandariza la receta.',
    Merma: 'Merma elevada. Revisa manipulación, almacenamiento y vida útil.',
    Precio: 'Alza de precio sobre el histórico. Renegocia o cotiza proveedor alternativo.',
  };
  const Row = ({ label, monto, cant, children }) => (
    <div className="flex items-center gap-2.5 mb-2.5">
      <span className="text-[10px] text-gray-500 w-[52px] shrink-0 text-right">{label}</span>
      <div className="flex-1 relative h-[22px] rounded-[5px] border border-gray-200 bg-[#f5f5f5] overflow-hidden">{children}</div>
      <span className="text-[10px] font-medium bg-[#f5f5f5] border border-gray-200 rounded-[5px] px-2 py-0.5 shrink-0">{cant}</span>
    </div>
  );
  return (
    <Card><CardContent className="pt-4 pb-3">
      <button className="w-full flex items-center justify-between mb-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="font-display font-bold text-[15px] text-gray-900 inline-flex items-center gap-1.5" style={{ letterSpacing: '-0.3px' }}>
          <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
          {a.producto}
        </span>
        <span className="text-[11px] font-medium px-3 py-0.5 rounded-full border" style={{ background: pill.bg, borderColor: pill.border, color: pill.color }}>{a.tipo} · {a.sev}%</span>
      </button>
      <Row label="Compra" cant={a.compra.cant}>
        <div className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-gray-900">{clp(a.compra.monto)}</div>
      </Row>
      <Row label="Óptimo" cant={a.optimo.cant}>
        <div className="absolute left-0 top-0 h-full" style={{ width: `${optimoPct}%`, background: 'rgba(12,27,51,0.06)', borderRight: '2px solid #999' }} />
        <div className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-gray-900">{clp(a.optimo.monto)}</div>
      </Row>
      <Row label="Fuga" cant={a.fuga.cant}>
        <div className="absolute right-0 top-0 h-full flex items-center justify-center" style={{ width: `${Math.max(12, fugaPct)}%`, background: '#333' }}>
          <span className="text-[10px] font-medium text-white">{clp(a.fuga.monto)}</span>
        </div>
      </Row>
      <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-gray-200">
        <span className="text-[11px] font-medium" style={{ color: st.color }}>{st.label}</span>
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-[#f5f5f5] border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-100">{open ? '↑ Ocultar' : '↓ Informe'}</button>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5">
              <p className="text-[9px] text-gray-500 uppercase tracking-wide">Compra</p>
              <p className="text-[12px] font-semibold text-gray-900">{clp(a.compra.monto)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5">
              <p className="text-[9px] text-gray-500 uppercase tracking-wide">Óptimo</p>
              <p className="text-[12px] font-semibold text-gray-900">{clp(a.optimo.monto)}</p>
            </div>
            <div className="rounded-lg px-2 py-1.5" style={{ background: '#333' }}>
              <p className="text-[9px] text-white/70 uppercase tracking-wide">Fuga</p>
              <p className="text-[12px] font-semibold text-white">{clp(a.fuga.monto)}</p>
            </div>
          </div>
          <p className="text-[11px] leading-snug text-gray-600">
            <span className="font-semibold text-gray-800">Acción:</span> {ACCIONES[a.tipo] || 'Revisa el detalle de compras de este insumo.'}
          </p>
        </div>
      )}
    </CardContent></Card>
  );
}

// Estados semáforo
const STATUS_STYLE = {
  favorable: { color: '#1D9E75', bg: '#E1F5EE', label: 'Favorable' },
  atencion: { color: '#BA7517', bg: '#FAEEDA', label: 'Atención' },
  critico: { color: '#A32D2D', bg: '#FCEBEB', label: 'Crítico' },
};
function statusVenta(proy, meta) { if (proy >= meta) return 'favorable'; if (proy >= meta * 0.9) return 'atencion'; return 'critico'; }
function statusRatio(val, bench, limite) { if (val <= bench) return 'favorable'; if (val <= limite) return 'atencion'; return 'critico'; }
function statusUtilidad(margen) { if (margen >= 10) return 'favorable'; if (margen >= 6) return 'atencion'; return 'critico'; }

// Barra con marcador de meta/límite al centro (50%). Azul si favorable, rojo si no.
function KpiBar({ value, target, higherIsBetter, markerLabel }) {
  const ratio = target > 0 ? value / target : 0;
  const fillPct = Math.max(3, Math.min(100, ratio * 50)); // 50% = en la meta/límite
  const favorable = higherIsBetter ? value >= target : value <= target;
  const color = favorable ? '#378ADD' : '#E24B4A';
  return (
    <div className="relative h-[5px] bg-[#f0f0f0] rounded-[3px] mt-2 mb-4">
      <div className="h-[5px] rounded-[3px]" style={{ width: `${fillPct}%`, background: color }} />
      <div className="absolute" style={{ left: '50%', top: '-4px', width: '2px', height: '13px', background: '#999', borderRadius: '1px', transform: 'translateX(-50%)' }} />
      <div className="absolute text-[9px] text-[#999]" style={{ left: '50%', top: '11px', transform: 'translateX(-50%)' }}>{markerLabel}</div>
    </div>
  );
}

function KpiCard({ name, status, cols, higherIsBetter, markerLabel }) {
  const st = STATUS_STYLE[status] || STATUS_STYLE.favorable;
  return (
    <Card>
      <CardContent className="pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-900">{name}</p>
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {cols.map((c, i) => (
            <div key={i}>
              <p className="text-[10px] text-gray-500 mb-0.5">{c.label}</p>
              <p className="text-lg font-semibold text-gray-900 font-display">{c.display}</p>
              <KpiBar value={c.value} target={c.target} higherIsBetter={higherIsBetter} markerLabel={markerLabel} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
