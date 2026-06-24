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

// Config de metas (editable). Todo se rige por la utilidad objetivo (default 15%).
function loadDashCfg() {
  try {
    const c = JSON.parse(localStorage.getItem('noa_dash_cfg') || '{}');
    return { utilPct: c.utilPct ?? 15, metaMensual: c.metaMensual ?? 10000000, costoDirectoBM: c.costoDirectoBM ?? 30 };
  } catch { return { utilPct: 15, metaMensual: 10000000, costoDirectoBM: 30 }; }
}

// ── MODO PRESENTACIÓN — Dataset demo "Casa Mediterránea" (CAMBIOS_REV4) ──
// Números fijos día 26/30. Coherencia: 61.100.000 − 19.552.000 − 16.191.500 − 17.719.000 = 7.637.500 ✓
// NOA Score del demo = 76 · Atención (fórmula ponderada OPEX/Food/Labor/Tendencia del PDF
// de presentación). Fuera de DEMO_MODE el score se deriva de la utilidad EBITDA (Prompt 1).
const DEMO_MODE = true;
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
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ── NOA Score desde utilidad EBITDA (Prompt 1) ──
// Escala lineal: 0% util → 25 · 5% → 50 · 10% → 75 · 15%+ → 100. (5 pts por 1% de utilidad)
function noaScoreFromUtil(utilPct) {
  if (utilPct >= 15) return 100;
  return Math.round(Math.max(0, 25 + 5 * utilPct) * 10) / 10;
}
// Categorías (Prompt 1): 75-100 Favorable · 50-74 Atención · 0-49 Riesgo · negativo Crítico.
function noaZonaFromScore(score, utilPct) {
  if (utilPct < 0) return 'critico';
  if (score >= 75) return 'favorable';
  if (score >= 50) return 'atencion';
  return 'riesgo';
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

export default function DashboardOverview({ sales = [], supplyCosts = [], opexByType = {}, restaurantId, tz = 'America/Santiago' }) {
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
  const META_DIARIA = DEMO_MODE ? DEMO_CASA.metaDiaria : META_MENSUAL / daysInMonth;
  const UTIL_OBJETIVO = DEMO_MODE ? DEMO_CASA.utilPct : cfg.utilPct;
  const COSTO_BM = cfg.costoDirectoBM;
  const utilidadObjetivoMonto = META_MENSUAL * UTIL_OBJETIVO / 100;

  // Ventas reales de Fudo (cache KV) para la Venta del día
  const { data: fudoSync = { sales: [] }, isFetching: fudoFetching } = useQuery({
    queryKey: ['overview-fudo-sync'],
    queryFn: async () => { const r = await fetch('/__fudo/sync-pull'); return r.ok ? await r.json() : { sales: [] }; },
    staleTime: 60 * 1000,
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
    const ventas = (fudoSync.sales || []).filter((s) => !s.is_cancelled && (s.date_time || '').slice(0, 10) === today);
    const bruto = ventas.reduce((a, s) => a + (Number(s.total_amount) || 0), 0);
    return { bruto, neto: Math.round(bruto / 1.19), count: ventas.length, hasFudo: (fudoSync.sales || []).length > 0 };
  }, [fudoSync, today]);
  const ventaColor = ventaCard.bruto >= META_DIARIA ? '#1D9E75' : ventaCard.bruto >= META_DIARIA * 0.7 ? '#F59E0B' : '#DC2626';
  const ventaPct = META_DIARIA > 0 ? Math.min(100, ventaCard.bruto / META_DIARIA * 100) : 0;

  // ── Cálculo de KPIs sobre VENTA NETA (Prompt 5 + Prompt 9) ──
  const M = useMemo(() => {
    const saleDay = (s) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s.date_time)); } catch { return ''; } };

    // Venta neta diaria (bruto Fudo / 1.19)
    const netByDay = {};
    for (const s of sales) { if (s.is_cancelled) continue; const d = saleDay(s); if (!d) continue; netByDay[d] = (netByDay[d] || 0) + (Number(s.total_amount) || 0) / 1.19; }
    const diasConVenta = Object.keys(netByDay).filter((d) => netByDay[d] > 0);
    const diasPrevios = diasConVenta.filter((d) => d < today);                 // excluye hoy
    const ventaNetaAcum = diasConVenta.reduce((a, d) => a + netByDay[d], 0);   // incluye hoy
    const ventaNetaHoy = netByDay[today] || 0;
    // Promedio diario "Hoy" = promedio de días cerrados (sin hoy, sin días en $0)
    const promedioHastaAyer = diasPrevios.length ? diasPrevios.reduce((a, d) => a + netByDay[d], 0) / diasPrevios.length : 0;
    const promedioDiarioReal = diasConVenta.length ? ventaNetaAcum / diasConVenta.length : 0;
    const diasOperacionProy = daysInMonth - sundaysInMonth(now.getFullYear(), now.getMonth());
    const ventaProj = promedioDiarioReal * diasOperacionProy;
    const promedioNecesario = META_MENSUAL / Math.max(1, diasOperacionProy);

    // Compras (incl IVA, todos los días calendario)
    const compraAcum = supplyCosts.reduce((a, c) => a + (Number(c.total_cost) || 0), 0);
    const compraHoy = supplyCosts.filter((c) => (c.date || '').slice(0, 10) === today).reduce((a, c) => a + (Number(c.total_cost) || 0), 0);
    const diasConCompra = new Set(supplyCosts.map((c) => (c.date || '').slice(0, 10)).filter(Boolean)).size || 1;
    const compraProj = (compraAcum / diasConCompra) * daysInMonth;

    // OPEX desde Gastos Fijos + variables (Prompt 9 Sec 3)
    const fijosTot = totalFijos(fijos);
    const fijosDiario = fijosTot / daysInMonth;
    const variablesByType = Object.entries(opexByType).filter(([t]) => ['marketing', 'logistics', 'office', 'other', 'variable'].includes(t));
    const variablesTot = variablesByType.reduce((a, [, v]) => a + v, 0);
    const variablesDiario = variablesTot / Math.max(1, dayOfMonth);
    const opexHoy = fijosDiario + variablesDiario;
    const opexAcum = fijosDiario * dayOfMonth + variablesTot;
    const opexProj = fijosTot + variablesDiario * daysInMonth;

    // Utilidad sobre venta neta
    const utilHoy = ventaNetaHoy - compraHoy - opexHoy;
    const utilAcum = ventaNetaAcum - compraAcum - opexAcum;
    const utilProj = ventaProj - compraProj - opexProj;

    const ratioCompraVenta = ventaNetaAcum > 0 ? compraAcum / ventaNetaAcum * 100 : 0;
    const opexPct = ventaNetaAcum > 0 ? opexAcum / ventaNetaAcum * 100 : 0;
    const margenNeto = ventaNetaAcum > 0 ? utilAcum / ventaNetaAcum * 100 : 0;
    const margenHoy = ventaNetaHoy > 0 ? utilHoy / ventaNetaHoy * 100 : 0;
    const margenProj = ventaProj > 0 ? utilProj / ventaProj * 100 : 0;

    return {
      ventaHoy: ventaNetaHoy, ventaAcum: ventaNetaAcum, ventaProj, ventaDiaProm: promedioDiarioReal,
      promedioHastaAyer, promedioNecesario,
      compraHoy, compraAcum, compraProj, ratioCompraVenta,
      opexHoy, opexAcum, opexProj, opexPct,
      utilHoy, utilAcum, utilProj, margenHoy, margenNeto, margenProj,
      diasAcum: diasConVenta.length || dayOfMonth,
    };
  }, [sales, supplyCosts, opexByType, fijos, today, dayOfMonth, daysInMonth, now, META_MENSUAL, tz]);

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

  // NOA Score: en demo se fija a 76/Atención (CAMBIOS_REV4); fuera de demo deriva de la utilidad (Prompt 1).
  const noa = useMemo(() => {
    const utilPct = K.margenNeto || 0;
    if (DEMO_MODE) return { score: DEMO_CASA.noaScore, zona: DEMO_CASA.noaZona, utilPct };
    const score = noaScoreFromUtil(utilPct);
    const zona = noaZonaFromScore(score, utilPct);
    return { score, zona, utilPct };
  }, [K.margenNeto]);
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
    const netByMonth = {};
    for (const s of (fudoSync.sales || [])) {
      if (s.is_cancelled) continue;
      const k = (s.date_time || '').slice(0, 7); if (!k) continue;
      netByMonth[k] = (netByMonth[k] || 0) + (Number(s.total_amount) || 0) / 1.19;
    }
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const ventaNeta = netByMonth[k] || 0;
      out.push({ label: MESES[d.getMonth()], val: Math.round(ventaNeta * (K.margenNeto || 0) / 100) });
    }
    if (out.length) out[out.length - 1].val = Math.round(K.utilProj || out[out.length - 1].val);
    return out;
  }, [fudoSync, now, K.margenNeto, K.utilProj]);

  return (
    <div ref={rootRef} className="space-y-6 font-sans">
      {/* Leyenda de zonas + botón Actualizar (Prompt 3: Favorable / Atención / Crítico) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs text-gray-600">
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
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">KPIs</p>
        <span className="text-xs text-gray-500">Período: {DEMO_MODE ? DEMO_CASA.periodo : `mes en curso · día ${K.diasAcum}`}</span>
      </div>
      <div className="space-y-2">
        {/* Promedio de Venta Diaria (Prompt 4) */}
        <KpiCard name="PROMEDIO DE VENTA DIARIA" higherIsBetter
          status={statusVenta(K.ventaDiaProm, K.promedioNecesario)}
          subtitle={`${K.promedioNecesario > 0 ? ((K.ventaDiaProm / K.promedioNecesario) * 100).toFixed(0) : 0}% del promedio esperado`}
          cols={[
            { label: 'Hoy', display: clp(K.ventaHoy), value: K.ventaHoy, target: K.promedioNecesario },
            { label: `Acum. ${K.diasAcum} días`, display: clp(K.ventaDiaProm), value: K.ventaDiaProm, target: K.promedioNecesario },
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
      <div className="flex items-center gap-4 text-xs text-gray-600">
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
          <p className="text-sm font-semibold text-noa-navy mt-1">{clp(utilidadObjetivoMonto)}</p>
          <p className="text-xs text-gray-500 mt-1">objetivo mensual · meta {clp(META_MENSUAL)}</p>
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

      {/* Panel de alertas — Compra / Óptimo / Fuga */}
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

// ── Panel de alertas (dataset demo: Casa Mediterránea, junio 2026) ──
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
  const Row = ({ label, cant, children }) => (
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
