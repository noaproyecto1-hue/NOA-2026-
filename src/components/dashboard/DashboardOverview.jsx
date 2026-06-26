import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, ChevronRight, RefreshCw, Loader2, Pencil, Download } from 'lucide-react';
import { loadOpexFijos, saveOpexFijos, totalFijos } from '@/lib/opexConfig';
import { AlertCard, ALERTAS, sortBySeverity } from '@/components/dashboard/alerts/alertsShared';

// Config de metas (editable). Todo se rige por la utilidad objetivo (default 15%).
function loadDashCfg() {
  try {
    const c = JSON.parse(localStorage.getItem('noa_dash_cfg') || '{}');
    return { utilPct: c.utilPct ?? 15, metaMensual: c.metaMensual ?? 50000000, costoDirectoBM: c.costoDirectoBM ?? 35 };
  } catch { return { utilPct: 15, metaMensual: 50000000, costoDirectoBM: 35 }; }
}

// ── MODO PRESENTACIÓN — Dataset demo "Casa Mediterránea" (CAMBIOS_REV4) ──
// Números fijos día 26/30. Coherencia: 61.100.000 − 19.552.000 − 16.191.500 − 17.719.000 = 7.637.500 ✓
// NOA Score del demo = 76 · Atención (fórmula ponderada OPEX/Food/Labor/Tendencia del PDF
// de presentación). Fuera de DEMO_MODE el score se deriva de la utilidad EBITDA (Prompt 1).
const DEMO_MODE = false; // datos reales del negocio (cargados desde el store)
const DEMO_CASA = {
  periodo: 'Junio 2026 · Día 26 de 30',
  diasAcum: 26, diasMes: 30,
  noaScore: 76, noaZona: 'atencion',
  metaMensual: 70000000, metaDiaria: 2333333, utilPct: 15,
  ventaHoy: 2618132, ventaBrutoHoy: 2618132, ventaNetoHoy: 2200111,
  ventaAcum: 61100000, ventaProj: 70500000, ventaDiaProm: 2350000,
  compraHoy: 746667, compraAcum: 19552000, compraProj: 22560000, ratioCompraVenta: 32,
  opexHoy: 619167, opexAcum: 16191500, opexProj: 18682500, opexPct: 26.5,
  utilHoy: 368500, utilAcum: 7637500, utilProj: 8812500, margenHoy: 15.8, margenNeto: 12.5, margenProj: 12.5,
  ventaCardHoy: { neto: 2200111, bruto: 2618132, count: 104, hasFudo: true },
  utilidad6m: [
    { label: 'Ene', val: 1850000 }, { label: 'Feb', val: 3020000 }, { label: 'Mar', val: 4100000 },
    { label: 'Abr', val: 5200000 }, { label: 'May', val: 6400000 }, { label: 'Jun', val: 8812500 },
  ],
};

// ───────── helpers ─────────
function clp(n) { return (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }); }
function clpK(n) { const v = Number(n) || 0; if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`; if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`; return `$${Math.round(v)}`; }
function pct(n) { return `${(Number(n) || 0).toFixed(0)}%`; }
function todayKey(tz = 'America/Santiago') {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}
// Domingos de un mes (Prompt 9): días de operación = días del mes − domingos.
function sundaysInMonth(year, monthIndex) {
  let count = 0; const d = new Date(year, monthIndex, 1);
  while (d.getMonth() === monthIndex) { if (d.getDay() === 0) count++; d.setDate(d.getDate() + 1); }
  return count;
}
// Días operativos (sin domingos) desde el día 1 hasta `untilDay` del mes.
function diasOperativos(year, monthIndex, untilDay) {
  let c = 0;
  for (let d = 1; d <= untilDay; d++) if (new Date(year, monthIndex, d).getDay() !== 0) c++;
  return Math.max(1, c);
}
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ── NOA Score: índice ponderado de eficiencia operativa (0–100) ──
// OPEX 40% · Food Cost 25% · Labor Cost 20% · Tendencia 15%.
// Benchmarks HORECA: OPEX 25% · Food 35% · Labor 30% (sobre venta neta).
const NOA_BENCH = { opex: 25, food: 35, labor: 30 };
const NOA_PESO = { opex: 0.40, food: 0.25, labor: 0.20, tendencia: 0.15 };
// Sub-score por costo: 100 si está en/bajo el benchmark; baja 6 puntos por cada punto
// porcentual (pp) por sobre él.
function costScore(value, bench) {
  if (value <= bench) return 100;
  return Math.max(0, Math.round(100 - (value - bench) * 6));
}
// Rangos (imagen): 85–100 Favorable · 65–84 Atención · 0–64 Crítico.
function noaZonaFromScore(score) {
  if (score >= 85) return 'favorable';
  if (score >= 65) return 'atencion';
  return 'critico';
}

// Estados semáforo (Prompt 3: Favorable / Atención / Crítico; + Riesgo para el score)
const STATUS_STYLE = {
  favorable: { color: '#1D9E75', bg: '#E1F5EE', label: 'Favorable', dot: '#1D9E75' },
  atencion: { color: '#BA7517', bg: '#FAEEDA', label: 'Atención', dot: '#F59E0B' },
  riesgo: { color: '#C0392B', bg: '#FCEBEB', label: 'Riesgo', dot: '#DC2626' },
  critico: { color: '#7A1212', bg: '#F7D5D5', label: 'Crítico', dot: '#7A1212' },
};

// Donut SVG (anillo de progreso)
function Donut({ value, color = '#0EA5E9', size = 96 }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} strokeLinecap="round" />
      <text x="50%" y="50%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central"
        className="font-display font-bold" fill="#FFFFFF" fontSize={size * 0.24}>{Math.round(value)}%</text>
    </svg>
  );
}

// Descarga del Dashboard como PDF (Prompt 2)
async function descargarDashboardPDF(node) {
  if (!node) return;
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const w = pw, h = (canvas.height * pw) / canvas.width;
  let pos = 0, rest = h;
  pdf.addImage(img, 'PNG', 0, pos, w, h);
  rest -= ph;
  while (rest > 0) { pos -= ph; pdf.addPage(); pdf.addImage(img, 'PNG', 0, pos, w, h); rest -= ph; }
  pdf.save(`NOA-Dashboard-${todayKey()}.pdf`);
}

export default function DashboardOverview({ sales = [], supplyCosts = [], opex = [], opexByType = {}, restaurantId, tz = 'America/Santiago' }) {
  const today = todayKey(tz);
  const now = new Date();
  const daysInMonth = DEMO_MODE ? DEMO_CASA.diasMes : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = DEMO_MODE ? DEMO_CASA.diasAcum : now.getDate();
  const queryClient = useQueryClient();
  const rootRef = useRef(null);

  // Config editable de metas + benchmark costo directo
  const [cfg, setCfg] = useState(loadDashCfg);
  const [editCfg, setEditCfg] = useState(false);
  const [editFijos, setEditFijos] = useState(false);
  const [fijos, setFijos] = useState(loadOpexFijos);
  const META_MENSUAL = DEMO_MODE ? DEMO_CASA.metaMensual : cfg.metaMensual;
  const UTIL_OBJETIVO = DEMO_MODE ? DEMO_CASA.utilPct : cfg.utilPct;
  const COSTO_BM = cfg.costoDirectoBM;
  const utilidadObjetivoMonto = META_MENSUAL * UTIL_OBJETIVO / 100;

  // Ventas reales de Fudo (cache KV) para la Venta del día
  const { data: fudoSync = { sales: [] }, isFetching: fudoFetching } = useQuery({
    queryKey: ['overview-fudo-sync'],
    queryFn: async () => { const r = await fetch('/__fudo/sync-pull'); return r.ok ? await r.json() : { sales: [] }; },
    staleTime: 60 * 1000,
  });

  // Histórico completo (todos los meses) para la tendencia de utilidad de 6 meses.
  const { data: hist = { sales: [], costs: [], opex: [] } } = useQuery({
    queryKey: ['overview-hist', restaurantId],
    queryFn: async () => {
      const q = restaurantId ? { restaurant_id: restaurantId } : {};
      const [hs, hc, ho] = await Promise.all([
        base44.entities.Sale.filter(q),
        base44.entities.SupplyCost.filter(q),
        base44.entities.OpEx.filter(q),
      ]);
      return { sales: hs || [], costs: hc || [], opex: ho || [] };
    },
    enabled: !DEMO_MODE,
    staleTime: 5 * 60 * 1000,
  });

  const [syncing, setSyncing] = useState(false);
  async function actualizar() {
    setSyncing(true);
    try { await fetch('/__fudo/sync-pull', { method: 'POST' }); queryClient.invalidateQueries({ queryKey: ['overview-fudo-sync'] }); }
    catch {} finally { setSyncing(false); }
  }
  useEffect(() => {
    const last = fudoSync?.lastSync ? new Date(fudoSync.lastSync).getTime() : 0;
    if (!last || (Date.now() - last) > 30 * 60 * 1000) actualizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Venta del día (Prompt 5): el valor de Fudo es BRUTO (con IVA). Neto = bruto / 1.19 ──
  const ventaCard = useMemo(() => {
    if (DEMO_MODE) return DEMO_CASA.ventaCardHoy;
    // Venta de hoy desde los datos cargados (store). Fudo en vivo como respaldo.
    const delDia = (arr) => (arr || []).filter((s) => !s.is_cancelled && (s.date_time || '').slice(0, 10) === today);
    let ventas = delDia(sales); let hasFudo = false;
    if (ventas.length === 0 && (fudoSync.sales || []).length) { ventas = delDia(fudoSync.sales); hasFudo = true; }
    const bruto = ventas.reduce((a, s) => a + (Number(s.total_amount) || 0), 0);
    return { bruto, neto: Math.round(bruto / 1.19), count: ventas.length, hasFudo };
  }, [sales, fudoSync, today]);

  // ── Cálculo de KPIs sobre VENTA NETA (Prompt 5 + Prompt 9) ──
  const M = useMemo(() => {
    const saleDay = (s) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s.date_time)); } catch { return ''; } };

    // Venta neta diaria (bruto Fudo / 1.19)
    const netByDay = {};
    for (const s of sales) { if (s.is_cancelled) continue; const d = saleDay(s); if (!d) continue; netByDay[d] = (netByDay[d] || 0) + (Number(s.total_amount) || 0) / 1.19; }
    const diasConVenta = Object.keys(netByDay).filter((d) => netByDay[d] > 0).sort();
    // Día de referencia "hoy" = último día con venta del período (o la fecha real si no hay datos).
    const refToday = diasConVenta.length ? diasConVenta[diasConVenta.length - 1] : today;
    const refDate = new Date(`${refToday}T12:00:00`);
    const selY = refDate.getFullYear(), selM = refDate.getMonth();
    const selDays = new Date(selY, selM + 1, 0).getDate();              // días del mes seleccionado
    const selDia = refDate.getDate();                                  // día del mes de "hoy"
    const operDays = selDays - sundaysInMonth(selY, selM);             // días operativos del mes (sin domingos)
    const operElapsed = diasOperativos(selY, selM, selDia);           // días operativos transcurridos

    const ventaNetaAcum = diasConVenta.reduce((a, d) => a + netByDay[d], 0);
    const ventaNetaHoy = netByDay[refToday] || 0;
    const promedioDiarioReal = diasConVenta.length ? ventaNetaAcum / diasConVenta.length : 0;
    const ventaProj = promedioDiarioReal * operDays;

    // Compras NETAS (sin IVA), comparables contra la venta neta — igual que Compras 11C.
    const netoCompra = (c) => Number(c.subtotal) || (Number(c.total_cost) || 0) / 1.19;
    const compraAcum = supplyCosts.reduce((a, c) => a + netoCompra(c), 0);
    const compraHoy = supplyCosts.filter((c) => (c.date || '').slice(0, 10) === refToday).reduce((a, c) => a + netoCompra(c), 0);
    // Proyección por DÍAS OPERATIVOS (igual que venta y OPEX), no por días-calendario.
    // En un mes cerrado (operElapsed === operDays) → proyectado = acumulado, sin inflar.
    const compraProj = operElapsed > 0 ? (compraAcum / operElapsed) * operDays : compraAcum;

    // OPEX: el gasto FIJO mensual (RRHH, arriendo, config) se divide por los días
    // OPERATIVOS del mes (sin domingos) → cuota diaria. Se suma día a día (Hoy),
    // acumula por días operativos transcurridos, y proyecta a los días operativos del mes.
    const esFijo = (o) => o.type === 'payroll' || o.type === 'rent';
    const fijoMensual = (opex || []).filter(esFijo).reduce((a, o) => a + (Number(o.amount) || 0), 0) + totalFijos(fijos);
    const fijoDiario = fijoMensual / Math.max(1, operDays);
    const opexVarAcum = (opex || []).filter((o) => !esFijo(o)).reduce((a, o) => a + (Number(o.amount) || 0), 0);
    const opexVarHoy = (opex || []).filter((o) => !esFijo(o) && (o.date || '').slice(0, 10) === refToday).reduce((a, o) => a + (Number(o.amount) || 0), 0);
    const opexVarDiario = opexVarAcum / operElapsed;
    const opexHoy = fijoDiario + opexVarHoy;
    const opexAcum = fijoDiario * operElapsed + opexVarAcum;
    const opexProj = fijoDiario * operDays + opexVarDiario * operDays;

    // Meta de venta diaria = (Food + OPEX + RRHH proyectados + utilidad esperada) ÷ días operativos.
    const utilObj = DEMO_MODE ? DEMO_CASA.utilPct : (cfg.utilPct || 15);
    const costosProy = compraProj + opexProj;                 // food + opex (incluye RRHH)
    const metaVentaMensual = utilObj < 100 ? costosProy / (1 - utilObj / 100) : costosProy;
    const metaDiaria = metaVentaMensual / Math.max(1, operDays);
    const promedioNecesario = metaDiaria;

    // Utilidad sobre venta neta
    const utilHoy = ventaNetaHoy - compraHoy - opexHoy;
    const utilAcum = ventaNetaAcum - compraAcum - opexAcum;
    const utilProj = ventaProj - compraProj - opexProj;

    // Para el NOA Score: separar Labor (RRHH) del resto del OPEX (arriendo + operacional + config).
    const laborAcum = (opex || []).filter((o) => o.type === 'payroll').reduce((a, o) => a + (Number(o.amount) || 0), 0);
    const opexScoreAcum = (opex || []).filter((o) => o.type !== 'payroll').reduce((a, o) => a + (Number(o.amount) || 0), 0) + totalFijos(fijos);
    const laborPct = ventaNetaAcum > 0 ? laborAcum / ventaNetaAcum * 100 : 0;
    const opexScorePct = ventaNetaAcum > 0 ? opexScoreAcum / ventaNetaAcum * 100 : 0;

    const ratioCompraVenta = ventaNetaAcum > 0 ? compraAcum / ventaNetaAcum * 100 : 0;
    const opexPct = ventaNetaAcum > 0 ? opexAcum / ventaNetaAcum * 100 : 0;
    const margenNeto = ventaNetaAcum > 0 ? utilAcum / ventaNetaAcum * 100 : 0;
    const margenHoy = ventaNetaHoy > 0 ? utilHoy / ventaNetaHoy * 100 : 0;
    const margenProj = ventaProj > 0 ? utilProj / ventaProj * 100 : 0;

    return {
      ventaHoy: ventaNetaHoy, ventaAcum: ventaNetaAcum, ventaProj, ventaDiaProm: promedioDiarioReal,
      promedioNecesario, metaDiaria, metaVentaMensual,
      compraHoy, compraAcum, compraProj, ratioCompraVenta,
      opexHoy, opexAcum, opexProj, opexPct,
      laborPct, opexScorePct,
      utilHoy, utilAcum, utilProj, margenHoy, margenNeto, margenProj,
      diasAcum: diasConVenta.length || selDia,
    };
  }, [sales, supplyCosts, opex, fijos, today, META_MENSUAL, cfg.utilPct, tz]);

  // Objeto unificado de KPIs (demo o real)
  const K = DEMO_MODE ? {
    diasAcum: DEMO_CASA.diasAcum,
    ventaHoy: DEMO_CASA.ventaHoy, ventaAcum: DEMO_CASA.ventaAcum, ventaProj: DEMO_CASA.ventaProj, ventaDiaProm: DEMO_CASA.ventaDiaProm,
    promedioNecesario: DEMO_CASA.metaDiaria,
    compraHoy: DEMO_CASA.compraHoy, compraAcum: DEMO_CASA.compraAcum, compraProj: DEMO_CASA.compraProj, ratioCompraVenta: DEMO_CASA.ratioCompraVenta,
    opexHoy: DEMO_CASA.opexHoy, opexAcum: DEMO_CASA.opexAcum, opexProj: DEMO_CASA.opexProj, opexPct: DEMO_CASA.opexPct,
    utilHoy: DEMO_CASA.utilHoy, utilAcum: DEMO_CASA.utilAcum, utilProj: DEMO_CASA.utilProj,
    margenHoy: DEMO_CASA.margenHoy, margenNeto: DEMO_CASA.margenNeto, margenProj: DEMO_CASA.margenProj,
  } : M;

  // Meta de venta diaria (calculada desde costos + utilidad esperada) y color/% de la venta de hoy.
  const META_DIARIA = DEMO_MODE ? DEMO_CASA.metaDiaria : (K.metaDiaria || META_MENSUAL / Math.max(1, daysInMonth));
  const ventaColor = ventaCard.bruto >= META_DIARIA ? '#1D9E75' : ventaCard.bruto >= META_DIARIA * 0.7 ? '#F59E0B' : '#DC2626';
  const ventaPct = META_DIARIA > 0 ? Math.min(100, ventaCard.bruto / META_DIARIA * 100) : 0;

  // NOA Score ponderado: OPEX 40% · Food 25% · Labor 20% · Tendencia 15% (imagen).
  const noa = useMemo(() => {
    const utilPct = K.margenNeto || 0;
    if (DEMO_MODE) return { score: DEMO_CASA.noaScore, zona: DEMO_CASA.noaZona, utilPct };
    const sOpex = costScore(K.opexScorePct || 0, NOA_BENCH.opex);
    const sFood = costScore(K.ratioCompraVenta || 0, COSTO_BM || NOA_BENCH.food);
    const sLabor = costScore(K.laborPct || 0, NOA_BENCH.labor);
    // Tendencia (15%): dirección de la utilidad neta del mes vs el mes anterior.
    const utilMes = {};
    for (const s of hist.sales) { if (s.is_cancelled) continue; const k = (s.date_time || '').slice(0, 7); if (k) utilMes[k] = (utilMes[k] || 0) + (Number(s.total_amount) || 0) / 1.19; }
    for (const c of hist.costs) { const k = (c.date || '').slice(0, 7); if (k) utilMes[k] = (utilMes[k] || 0) - (Number(c.total_cost) || 0) / 1.19; }
    for (const o of hist.opex) { const k = (o.date || '').slice(0, 7); if (k) utilMes[k] = (utilMes[k] || 0) - (Number(o.amount) || 0); }
    const meses = Object.keys(utilMes).sort();
    let sTend = 70;
    if (meses.length >= 2) {
      const last = utilMes[meses[meses.length - 1]], prev = utilMes[meses[meses.length - 2]];
      sTend = prev !== 0 ? Math.max(0, Math.min(100, Math.round(60 + ((last - prev) / Math.abs(prev)) * 60))) : (last >= 0 ? 75 : 40);
    }
    const score = Math.round(sOpex * NOA_PESO.opex + sFood * NOA_PESO.food + sLabor * NOA_PESO.labor + sTend * NOA_PESO.tendencia);
    return { score, zona: noaZonaFromScore(score), utilPct, parts: { sOpex, sFood, sLabor, sTend } };
  }, [K.opexScorePct, K.ratioCompraVenta, K.laborPct, K.margenNeto, hist, COSTO_BM]);
  const noaSt = STATUS_STYLE[noa.zona] || STATUS_STYLE.atencion;

  // Párrafo dinámico del banner (Prompt 2)
  const noaResumen = useMemo(() => {
    const util = noa.utilPct;
    const potencial = Math.max(0, 15 - util);
    const fuera = [];
    if (K.ratioCompraVenta > COSTO_BM) fuera.push(`Compras (actual ${K.ratioCompraVenta.toFixed(0)}%, máx. ${COSTO_BM}%)`);
    if (K.opexPct > 25) fuera.push(`OPEX (actual ${K.opexPct.toFixed(1)}%, máx. 25%)`);
    const lista = fuera.length ? fuera.join(' y ') : 'los parámetros operativos';
    const cuerpo = potencial > 0
      ? `Existe un potencial de mejora de ${potencial.toFixed(1)}% si se optimizan: ${lista}.`
      : 'Ya estás en el óptimo de utilidad; mantén el control de costos.';
    return `NOA Score ${Math.round(noa.score)}% — ${noaSt.label}. La utilidad actual es ${util.toFixed(1)}%, pudiendo alcanzar el 15% óptimo. ${cuerpo}`;
  }, [noa, noaSt, K, COSTO_BM]);

  // Datos de utilidad 6 meses (Prompt 6)
  const utilidad6m = useMemo(() => {
    if (DEMO_MODE) return DEMO_CASA.utilidad6m;
    const ventaNetaMes = {}, foodMes = {}, opexMes = {};
    for (const s of hist.sales) {
      if (s.is_cancelled) continue;
      const k = (s.date_time || '').slice(0, 7); if (!k) continue;
      ventaNetaMes[k] = (ventaNetaMes[k] || 0) + (Number(s.total_amount) || 0) / 1.19;
    }
    for (const c of hist.costs) {
      const k = (c.date || '').slice(0, 7); if (!k) continue;
      foodMes[k] = (foodMes[k] || 0) + (Number(c.total_cost) || 0);
    }
    for (const o of hist.opex) {
      const k = (o.date || '').slice(0, 7); if (!k) continue;
      opexMes[k] = (opexMes[k] || 0) + (Number(o.amount) || 0);
    }
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const util = (ventaNetaMes[k] || 0) - (foodMes[k] || 0) - (opexMes[k] || 0);
      out.push({ label: MESES[d.getMonth()], val: Math.round(util) });
    }
    return out;
  }, [hist, now]);

  return (
    <div ref={rootRef} className="space-y-6 font-sans">
      {/* Leyenda de zonas + botón Actualizar (Prompt 3: Favorable / Atención / Crítico) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs text-white/70">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_STYLE.favorable.dot }} /> Favorable</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_STYLE.atencion.dot }} /> Atención</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_STYLE.critico.dot }} /> Crítico</span>
        </div>
        <Button onClick={actualizar} disabled={syncing || fudoFetching} variant="outline" size="sm">
          {(syncing || fudoFetching) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          {(syncing || fudoFetching) ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>

      {/* ── Banner NOA Score (Prompt 2) ── */}
      <Card className="bg-noa-navy text-white border-0 overflow-hidden">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-stretch gap-5 flex-wrap">
            {/* Izquierda: donut + estado */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <Donut value={noa.score} color={noaSt.dot} size={104} />
              <span className="mt-2 text-[11px] font-semibold px-3 py-0.5 rounded-full" style={{ color: '#fff', background: noaSt.color }}>{noaSt.label}</span>
            </div>
            {/* Centro: NOA Score + párrafo dinámico */}
            <div className="flex-1 min-w-[260px] flex flex-col justify-center">
              <p className="text-xs text-white/60">NOA Score</p>
              <p className="text-sm text-white/85 leading-relaxed mt-1">{noaResumen}</p>
              <p className="text-[11px] text-white/45 mt-2">Eficiencia Global Gastronómica</p>
            </div>
            {/* Derecha: descarga PDF abajo a la derecha */}
            <div className="flex items-end justify-end shrink-0 ml-auto">
              <button
                onClick={() => descargarDashboardPDF(rootRef.current)}
                className="inline-flex items-center gap-1.5 text-xs text-white/80 bg-white/10 hover:bg-white/20 transition rounded-lg px-3 py-2"
                title="Descargar reporte del dashboard">
                <Download className="w-4 h-4" /> Descargar PDF
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Venta Bruta — Hoy (Prompt 5) */}
      <Card className="overflow-hidden">
        <CardContent className="pt-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-600">Venta Bruta — Hoy</p>
                {ventaCard.hasFudo
                  ? <span className="text-[10px] font-semibold text-noa-success bg-noa-success/15 rounded-full px-2 py-0.5">● Fudo en vivo</span>
                  : <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">sin datos Fudo</span>}
              </div>
              <p className="text-3xl font-bold font-display mt-1" style={{ color: ventaColor }}>{clp(ventaCard.bruto)}</p>
              <p className="text-xs text-gray-500 mt-1">{ventaCard.count} ventas cerradas · neto {clp(ventaCard.neto)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Meta diaria</p>
              <p className="text-lg font-bold text-noa-navy">{clp(META_DIARIA)}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: ventaColor }}>{ventaPct.toFixed(0)}% de la meta</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden relative">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, ventaPct)}%`, backgroundColor: ventaColor }} />
              <div className="absolute top-0 bottom-0" style={{ left: '70%', width: '1px', background: 'rgba(0,0,0,.15)' }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>$0</span><span>70%</span><span>Meta {clp(META_DIARIA)}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between">
            <span className="text-xs text-gray-500">Meta mensual de venta</span>
            <span className="font-bold text-noa-navy">{clp(META_MENSUAL)}</span>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">KPIs</p>
        <span className="text-xs text-white/60">Período: {DEMO_MODE ? DEMO_CASA.periodo : `mes en curso · día ${K.diasAcum}`}</span>
      </div>
      <div className="space-y-2">
        {/* Promedio de Venta Diaria (Prompt 4) */}
        <KpiCard name="PROMEDIO DE VENTA DIARIA" higherIsBetter
          status={statusVenta(K.ventaDiaProm, K.promedioNecesario)}
          subtitle={`${K.promedioNecesario > 0 ? ((K.ventaDiaProm / K.promedioNecesario) * 100).toFixed(0) : 0}% del promedio esperado`}
          cols={[
            { label: 'Hoy', display: clp(K.ventaHoy), value: K.ventaHoy, target: K.promedioNecesario },
            { label: `Acum. ${K.diasAcum} días`, display: clp(K.ventaAcum), value: K.ventaDiaProm, target: K.promedioNecesario },
            { label: 'Proyectado', display: clp(K.ventaProj), value: K.ventaProj, target: META_MENSUAL },
          ]} markerLabel="meta" />

        <KpiCard name="COMPRA" higherIsBetter={false}
          status={statusRatio(K.ratioCompraVenta, COSTO_BM, COSTO_BM + 4)}
          subtitle={`${K.ratioCompraVenta.toFixed(0)}% sobre venta neta · benchmark ${COSTO_BM}%`}
          cols={[
            { label: 'Hoy', display: clp(K.compraHoy), value: K.ratioCompraVenta, target: COSTO_BM },
            { label: `Acum. ${K.diasAcum} días`, display: clp(K.compraAcum), value: K.ratioCompraVenta, target: COSTO_BM },
            { label: 'Proyectado', display: clp(K.compraProj), value: K.ratioCompraVenta, target: COSTO_BM },
          ]} markerLabel="límite" />

        <KpiCard name="OPEX" higherIsBetter={false}
          status={statusRatio(K.opexPct, 25, 28)}
          subtitle={`${K.opexPct.toFixed(1)}% sobre venta neta · benchmark 25%`}
          onEdit={() => setEditFijos(true)}
          cols={[
            { label: 'Hoy', display: clp(K.opexHoy), value: K.opexPct, target: 25 },
            { label: `Acum. ${K.diasAcum} días`, display: clp(K.opexAcum), value: K.opexPct, target: 25 },
            { label: 'Proyectado', display: clp(K.opexProj), value: K.opexPct, target: 25 },
          ]} markerLabel="límite" />
      </div>

      {/* Leyenda de barras */}
      <div className="flex items-center gap-4 text-xs text-white/70">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#378ADD' }} /> sobre meta / bajo límite</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#E24B4A' }} /> bajo meta / sobre límite</span>
      </div>

      {/* Utilidad Neta — solo Proyectado destacado + tendencia 6 meses (Prompt 6) */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            <div className="text-center md:text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Utilidad Neta · Proyectado</p>
              <p className="font-display font-bold leading-none mt-2" style={{ fontSize: '3.4rem', color: (K.utilProj < 0 ? '#E24B4A' : '#378ADD') }}>
                {clp(K.utilProj)}
              </p>
              <p className="text-sm font-semibold mt-2" style={{ color: (K.margenProj < 0 ? '#E24B4A' : '#1D9E75') }}>
                Margen {K.margenProj.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-1">Utilidad neta · últimos 6 meses</p>
              <UtilidadTrend data={utilidad6m} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reubicación: Utilidad Objetivo + Costo Directo de Compra (Prompt 8) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-noa-orange/5 border-noa-orange/30"><CardContent className="pt-5 relative">
          <button onClick={() => setEditCfg(true)} className="absolute top-3 right-3 text-gray-400 hover:text-noa-navy" title="Editar objetivo">
            <Pencil className="w-4 h-4" />
          </button>
          <p className="text-3xl font-bold font-display text-noa-orange-dk">{UTIL_OBJETIVO}% de utilidad</p>
          <p className="text-2xl font-bold text-noa-navy mt-1">{clp((K.ventaProj || 0) * UTIL_OBJETIVO / 100)}</p>
          <p className="text-xs text-gray-500 mt-1">{UTIL_OBJETIVO}% de la venta proyectada · meta {clp(META_MENSUAL)}</p>
        </CardContent></Card>

        <Card><CardContent className="pt-5 relative">
          <button onClick={() => setEditCfg(true)} className="absolute top-3 right-3 text-gray-400 hover:text-noa-navy" title="Editar benchmark de costo directo">
            <Pencil className="w-4 h-4" />
          </button>
          <p className="text-3xl font-bold font-display text-noa-navy">{pct(K.ratioCompraVenta)}</p>
          <p className="text-base font-semibold text-noa-navy mt-1">Costo directo de compra</p>
          <p className="text-xs text-gray-500 mt-1">benchmark {COSTO_BM}%</p>
        </CardContent></Card>
      </div>

      {/* Panel de alertas — Compra / Óptimo / Fuga (resumen: top 4 por criticidad) */}
      <div>
        <p className="text-base font-semibold text-white flex items-center gap-1.5 mb-3"><AlertTriangle className="w-4 h-4 text-noa-orange" /> Panel de alertas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {sortBySeverity(ALERTAS).slice(0, 4).map((a) => <AlertCard key={a.producto} a={a} />)}
        </div>
      </div>

      {editCfg && (
        <EditMetaDialog cfg={cfg} onClose={() => setEditCfg(false)} onSave={(next) => {
          setCfg(next); try { localStorage.setItem('noa_dash_cfg', JSON.stringify(next)); } catch {} setEditCfg(false);
        }} />
      )}
      {editFijos && (
        <EditFijosDialog fijos={fijos} onClose={() => setEditFijos(false)} onSave={(vals) => {
          const merged = saveOpexFijos(vals); setFijos(merged); setEditFijos(false);
        }} />
      )}
    </div>
  );
}

// Tendencia de utilidad neta (línea + área, referencia en 0, último punto destacado)
function UtilidadTrend({ data = [] }) {
  const lastVal = data.length ? data[data.length - 1].val : 0;
  const lastColor = lastVal < 0 ? '#E24B4A' : '#378ADD';
  const renderDot = (props) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return null;
    const isLast = index === data.length - 1;
    return isLast
      ? <circle key={index} cx={cx} cy={cy} r={5} fill={lastColor} stroke="#fff" strokeWidth={2} />
      : <circle key={index} cx={cx} cy={cy} r={2.5} fill="#94A3B8" />;
  };
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lastColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={lastColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="4 4" />
        <Tooltip formatter={(v) => clp(v)} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Area type="monotone" dataKey="val" stroke="#64748B" strokeWidth={2} fill="url(#utilGrad)" dot={renderDot} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EditMetaDialog({ cfg, onClose, onSave }) {
  const [utilPct, setUtilPct] = useState(cfg.utilPct);
  const [metaMensual, setMetaMensual] = useState(cfg.metaMensual);
  const [costoDirectoBM, setCostoDirectoBM] = useState(cfg.costoDirectoBM ?? 30);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="font-sans max-w-md">
        <DialogHeader><DialogTitle className="font-display text-noa-navy">Objetivo de utilidad y metas</DialogTitle></DialogHeader>
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
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Benchmark costo directo de compra (%)</label>
            <Input type="number" value={costoDirectoBM} onChange={(e) => setCostoDirectoBM(e.target.value)} />
            <p className="text-[11px] text-gray-400">Límite objetivo del costo directo sobre la venta neta.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" onClick={() => onSave({
            utilPct: Number(utilPct) || 15, metaMensual: Number(metaMensual) || 10000000, costoDirectoBM: Number(costoDirectoBM) || 30,
          })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Editor de Gastos Fijos (Prompt 9B — versión compacta)
function EditFijosDialog({ fijos, onClose, onSave }) {
  const [arriendo, setArriendo] = useState(fijos.arriendo || '');
  const [recursoHumano, setRecursoHumano] = useState(fijos.recursoHumano || '');
  const [administracion, setAdministracion] = useState(fijos.administracion || '');
  const lastMod = fijos.lastModified ? new Date(fijos.lastModified).toLocaleDateString('es-CL') : '—';
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="font-sans max-w-md">
        <DialogHeader><DialogTitle className="font-display text-noa-navy">Gastos fijos mensuales (OPEX)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><label className="text-sm text-gray-600">Arriendo</label>
            <Input type="number" value={arriendo} onChange={(e) => setArriendo(e.target.value)} placeholder="$ mensual" /></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Recurso Humano (remuneraciones brutas)</label>
            <Input type="number" value={recursoHumano} onChange={(e) => setRecursoHumano(e.target.value)} placeholder="$ mensual" /></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Administración fija</label>
            <Input type="number" value={administracion} onChange={(e) => setAdministracion(e.target.value)} placeholder="$ mensual" /></div>
          <p className="text-[11px] text-gray-400">Última modificación: {lastMod}. Los valores persisten mes a mes y alimentan el KPI OPEX.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" onClick={() => onSave({ arriendo, recursoHumano, administracion })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function statusVenta(real, necesario) { if (real >= necesario) return 'favorable'; if (real >= necesario * 0.9) return 'atencion'; return 'critico'; }
function statusRatio(val, bench, limite) { if (val <= bench) return 'favorable'; if (val <= limite) return 'atencion'; return 'critico'; }

// Barra con marcador de meta/límite al centro (50%). Azul si favorable, rojo si no.
function KpiBar({ value, target, higherIsBetter, markerLabel }) {
  const ratio = target > 0 ? value / target : 0;
  const fillPct = Math.max(3, Math.min(100, ratio * 50));
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

function KpiCard({ name, status, cols, higherIsBetter, markerLabel, subtitle, onEdit }) {
  const st = STATUS_STYLE[status] || STATUS_STYLE.favorable;
  return (
    <Card>
      <CardContent className="pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-900">{name}</p>
            {onEdit && <button onClick={onEdit} className="text-gray-300 hover:text-noa-navy" title="Configurar"><Pencil className="w-3.5 h-3.5" /></button>}
          </div>
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
        </div>
        {subtitle && <p className="text-[11px] text-gray-400 -mt-2 mb-3">{subtitle}</p>}
        <div className="grid grid-cols-3 gap-5">
          {cols.map((c, i) => (
            <div key={i}>
              <p className="text-lg font-semibold text-gray-600 mb-0.5">{c.label}</p>
              <p className="text-2xl font-bold text-gray-900 font-display">{c.display}</p>
              <KpiBar value={c.value} target={c.target} higherIsBetter={higherIsBetter} markerLabel={markerLabel} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
