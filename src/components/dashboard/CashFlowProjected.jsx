// Flujo de Caja Proyectado — calendario mensual horizontal de compromisos de
// pago (egresos) y recaudación (ingresos) con cálculo de saldos en cascada.
// Persistencia local (base44 está mockeado): localStorage por restaurante+mes.
// Edición inline con auto-guardado por campo. Spec: NOA · módulo Flujo de Caja.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Info, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ACCENT = '#c17f2a';
const STORE_KEY = 'noa_cashflow_v1';

function fmtCLP(n) {
  if (!n || Number.isNaN(n)) return '$0';
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? '-' : '') + '$' + abs.toLocaleString('es-CL');
}
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function genId() { return 'c' + Math.random().toString(36).slice(2, 9) + (performance.now() | 0); }

function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; } }
function saveAll(obj) { try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch { /* cuota */ } }

// Semilla demo para el mes en curso: saldo inicial + algunos compromisos y
// recaudación, para que el calendario no aparezca vacío en la presentación.
function buildSeed(y, m) {
  const dim = daysInMonth(y, m);
  const days = {};
  const addComp = (d, nombre, monto) => {
    if (d > dim) return;
    const k = String(d);
    if (!days[k]) days[k] = { compromisos: [], recaudacion: 0 };
    days[k].compromisos.push({ id: genId(), nombre, monto, sortOrder: days[k].compromisos.length });
  };
  const addRec = (d, monto) => {
    if (d > dim) return;
    const k = String(d);
    if (!days[k]) days[k] = { compromisos: [], recaudacion: 0 };
    days[k].recaudacion = monto;
  };
  // Recaudación: días hábiles (lun–sáb) con depósito de ventas
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(y, m, d).getDay();
    if (dow !== 0) addRec(d, 1700000 + ((d * 53) % 9) * 50000);
  }
  // Compromisos de pago típicos del mes
  addComp(2, 'Insumos del Mar SPA', 612000);
  addComp(5, 'Arriendo local', 1700000);
  addComp(8, 'Distribuidora de Café', 480000);
  addComp(12, 'Carnes y Fiambres Ltda.', 398000);
  addComp(15, 'Servicios básicos (luz/agua/gas)', 745000);
  addComp(20, 'Marketing digital', 1000000);
  addComp(25, 'Higiene e Inocuidad', 393000);
  addComp(28, 'Anticipo proveedores varios', 900000);
  addComp(dim >= 30 ? 30 : dim, 'Remuneraciones', 15000000);
  return { saldoInicial: 27767783, days };
}

function emptyMonth() { return { saldoInicial: 0, days: {} }; }

export default function CashFlowProjected() {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });
  const businessId = user?.restaurant_ids?.[0] || 'rest_demo_1';

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState(emptyMonth);
  const [confirmDel, setConfirmDel] = useState(null); // `${day}:${id}`
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);
  const scrollRef = useRef(null);

  const monthKey = `${year}-${month}`;

  // Carga del mes (localStorage). Si no existe, semilla solo para el mes real
  // en curso; meses nuevos arrancan vacíos con saldo inicial 0.
  useEffect(() => {
    const all = loadAll();
    const stored = all?.[businessId]?.[monthKey];
    if (stored) {
      setData(stored);
    } else {
      const isCurrentReal = year === now.getFullYear() && month === now.getMonth();
      setData(isCurrentReal ? buildSeed(year, month) : emptyMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, monthKey]);

  // Persistencia + indicador de guardado
  const persist = useCallback((next) => {
    setData(next);
    const all = loadAll();
    if (!all[businessId]) all[businessId] = {};
    all[businessId][monthKey] = next;
    saveAll(all);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  }, [businessId, monthKey]);

  // Cálculo en cascada
  const daily = useMemo(() => {
    const dim = daysInMonth(year, month);
    const res = [];
    let saldo = Number(data.saldoInicial) || 0;
    for (let d = 1; d <= dim; d++) {
      const day = data.days?.[String(d)] || { compromisos: [], recaudacion: 0 };
      const totalEgresos = (day.compromisos || []).reduce((a, c) => a + (Number(c.monto) || 0), 0);
      const recaudacion = Number(day.recaudacion) || 0;
      const flujoNeto = recaudacion - totalEgresos;
      const saldoFinal = saldo + flujoNeto;
      res.push({ day, d, saldo, totalEgresos, recaudacion, flujoNeto, saldoFinal });
      saldo = saldoFinal;
    }
    return res;
  }, [data, year, month]);

  const resumen = useMemo(() => {
    const totalEgr = daily.reduce((a, x) => a + x.totalEgresos, 0);
    const totalRec = daily.reduce((a, x) => a + x.recaudacion, 0);
    const saldoFinal = daily.length ? daily[daily.length - 1].saldoFinal : (Number(data.saldoInicial) || 0);
    const flujoNeto = saldoFinal - (Number(data.saldoInicial) || 0);
    return { totalEgr, totalRec, saldoFinal, flujoNeto };
  }, [daily, data.saldoInicial]);

  // Scroll automático al día de hoy si es el mes en curso
  useEffect(() => {
    const isCurrentReal = year === now.getFullYear() && month === now.getMonth();
    if (isCurrentReal && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-day="${now.getDate()}"]`);
      if (el) el.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, daily.length]);

  // --- mutadores ---
  const ensureDay = (obj, d) => {
    const k = String(d);
    if (!obj.days) obj.days = {};
    if (!obj.days[k]) obj.days[k] = { compromisos: [], recaudacion: 0 };
    return obj.days[k];
  };
  const clone = () => ({ saldoInicial: data.saldoInicial, days: JSON.parse(JSON.stringify(data.days || {})) });

  const setSaldoInicial = (v) => { const n = { ...data, saldoInicial: v }; persist(n); };
  const addCompromiso = (d) => {
    const n = clone(); const day = ensureDay(n, d);
    day.compromisos.push({ id: genId(), nombre: '', monto: 0, sortOrder: day.compromisos.length });
    persist(n);
  };
  const updateNombre = (d, id, nombre) => {
    const n = clone(); const day = ensureDay(n, d);
    const c = day.compromisos.find((x) => x.id === id); if (c) c.nombre = nombre;
    persist(n);
  };
  const updateMonto = (d, id, monto) => {
    const n = clone(); const day = ensureDay(n, d);
    const c = day.compromisos.find((x) => x.id === id); if (c) c.monto = monto;
    persist(n);
  };
  const delCompromiso = (d, id) => {
    const n = clone(); const day = ensureDay(n, d);
    day.compromisos = day.compromisos.filter((x) => x.id !== id);
    persist(n); setConfirmDel(null);
  };
  const updateRec = (d, monto) => {
    const n = clone(); const day = ensureDay(n, d); day.recaudacion = monto;
    persist(n);
  };

  const changeMonth = (delta) => {
    let m = month + delta, y = year;
    if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; }
    setYear(y); setMonth(m);
  };

  const dim = daysInMonth(year, month);

  return (
    <div className="rounded-2xl bg-white p-4 sm:p-5 text-gray-900 shadow-xl" style={{ fontSize: 13 }}>
      <style>{`
        .cf-mny{border:0.5px solid #e9c27a;background:#faeeda;border-radius:4px;padding:3px 7px;font-size:12px;font-weight:500;color:#633806;width:100%;outline:none;text-align:right}
        .cf-mny:focus{border-color:${ACCENT};background:#fdf3e3}
        .cf-rec{border:0.5px solid #9fe1cb;background:#e1f5ee;border-radius:4px;padding:3px 7px;font-size:12px;font-weight:500;color:#085041;width:120px;outline:none;text-align:right}
        .cf-rec:focus{border-color:#1d9e75}
        .cf-name{border:none;background:transparent;font-size:12px;color:#111827;flex:1;outline:none;min-width:0}
        .cf-name:focus{background:#f3f4f6;border-radius:3px;padding:1px 4px}
        .cf-name::placeholder{color:#9ca3af}
        .cf-pos{color:#0f6e56}.cf-neg{color:#a32d2d}
        .cf-scroll::-webkit-scrollbar{height:8px}
        .cf-scroll::-webkit-scrollbar-thumb{background:#d4d4d8;border-radius:4px}
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 mb-4 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 font-display">Flujo de caja proyectado</h1>
          <p className="text-xs text-gray-500 mt-0.5">Ingresa compromisos de pago y recaudación diaria</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <Check className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="border border-gray-200 rounded-lg p-1.5 hover:bg-gray-50" aria-label="Mes anterior"><ChevronLeft className="w-4 h-4" /></button>
            <div className="text-sm font-semibold min-w-[120px] text-center">{MONTHS[month]} {year}</div>
            <button onClick={() => changeMonth(1)} className="border border-gray-200 rounded-lg p-1.5 hover:bg-gray-50" aria-label="Mes siguiente"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Saldo inicial */}
      <div className="flex items-center gap-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5">
        <label className="text-xs text-gray-500 whitespace-nowrap">Saldo inicial del mes ($)</label>
        <MoneyInput
          value={Number(data.saldoInicial) || 0}
          onChange={setSaldoInicial}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold w-44 text-right bg-white outline-none focus:border-[#c17f2a]"
        />
        <span className="text-[11px] ml-auto px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: '#eaf3de', color: '#27500a', border: '0.5px solid #97c459' }}>
          <Info className="w-3 h-3" /> Saldo de apertura
        </span>
      </div>

      {/* Resumen mensual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        <SummaryCard label="Total egresos del mes" value={fmtCLP(-resumen.totalEgr)} color="#a32d2d" />
        <SummaryCard label="Total recaudación" value={fmtCLP(resumen.totalRec)} color="#0f6e56" />
        <SummaryCard label="Flujo neto del mes" value={fmtCLP(resumen.flujoNeto)} color={resumen.flujoNeto >= 0 ? '#0f6e56' : '#a32d2d'} />
        <SummaryCard label="Saldo cierre proyectado" value={fmtCLP(resumen.saldoFinal)} color={resumen.saldoFinal >= 0 ? '#0f6e56' : '#a32d2d'} />
      </div>

      {/* Grid de días */}
      <div className="cf-scroll overflow-x-auto pb-2" ref={scrollRef} style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-2.5" style={{ minWidth: 'max-content' }}>
          {daily.map((row) => {
            const d = row.d;
            const date = new Date(year, month, d);
            const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === d;
            const negativo = row.saldoFinal < 0;
            return (
              <div
                key={d}
                data-day={d}
                className="rounded-xl border bg-white flex-shrink-0 overflow-hidden"
                style={{ width: 220, borderColor: isToday ? ACCENT : '#e5e7eb', borderWidth: isToday ? 1.5 : 0.5, borderLeft: negativo ? '3px solid #e24b4a' : undefined }}
              >
                {/* Zona A — header */}
                <div className="flex items-center justify-between px-3 py-2" style={{ background: ACCENT }}>
                  <span className="text-[10px] font-medium text-white/85 uppercase tracking-wide">{DOW[date.getDay()]}</span>
                  <span className="text-[15px] font-medium text-white">{d} {MONTHS[month].slice(0, 3)}</span>
                </div>

                {/* Zona B — saldo disponible */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <span className="text-[10px] text-gray-500">Saldo disponible</span>
                  <span className={`text-xs font-semibold ${row.saldo >= 0 ? 'cf-pos' : 'cf-neg'}`}>{fmtCLP(row.saldo)}</span>
                </div>

                {/* Zona C — compromisos */}
                <div className="text-[10px] font-medium uppercase tracking-wide px-3 py-1" style={{ color: '#854f0b', background: '#faeeda', borderBottom: '0.5px solid #e9c27a' }}>Compromisos de pago</div>
                <div className="px-3 py-2">
                  {(row.day.compromisos || []).map((c) => {
                    const delKey = `${d}:${c.id}`;
                    if (confirmDel === delKey) {
                      return (
                        <div key={c.id} className="mb-2 pb-2 border-b border-gray-100 flex items-center justify-between gap-2 text-xs">
                          <span className="text-gray-600">¿Eliminar?</span>
                          <span className="flex gap-1">
                            <button onClick={() => delCompromiso(d, c.id)} className="px-2 py-0.5 rounded bg-red-500 text-white">Sí</button>
                            <button onClick={() => setConfirmDel(null)} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">No</button>
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div key={c.id} className="mb-2 pb-2 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <input
                            className="cf-name"
                            placeholder="Nombre proveedor / acreedor"
                            defaultValue={c.nombre}
                            onBlur={(e) => { if (e.target.value !== c.nombre) updateNombre(d, c.id, e.target.value); }}
                            aria-label={`Nombre compromiso día ${d}`}
                          />
                          <button className="text-gray-400 hover:text-red-500" onClick={() => setConfirmDel(delKey)} aria-label="Eliminar compromiso"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: '#faeeda', color: '#854f0b' }}>Monto $</span>
                          <MoneyInput value={Number(c.monto) || 0} onChange={(v) => updateMonto(d, c.id, v)} className="cf-mny" />
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => addCompromiso(d)} className="flex items-center justify-center gap-1 text-[11px] w-full mt-1.5 py-1.5 rounded-lg border border-dashed" style={{ color: ACCENT, borderColor: '#e9c27a' }}>
                    <Plus className="w-3 h-3" /> Agregar compromiso
                  </button>
                </div>
                {/* Footer egresos */}
                <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#fff8ee', borderTop: '0.5px solid #e9c27a' }}>
                  <span className="text-[10px] font-medium" style={{ color: '#854f0b' }}>Total egresos del día</span>
                  <span className="text-[13px] font-semibold" style={{ color: '#633806' }}>{fmtCLP(row.totalEgresos)}</span>
                </div>

                {/* Zona D — recaudación */}
                <div className="text-[10px] font-medium uppercase tracking-wide px-3 py-1" style={{ color: '#085041', background: '#e1f5ee', borderTop: '0.5px solid #e5e7eb', borderBottom: '0.5px solid #9fe1cb' }}>Recaudación</div>
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] text-gray-500 whitespace-nowrap">Ingreso cuenta corriente</label>
                    <MoneyInput value={Number(row.day.recaudacion) || 0} onChange={(v) => updateRec(d, v)} className="cf-rec" />
                  </div>
                </div>

                {/* Zona E — saldo del día */}
                <div className="text-[10px] font-medium uppercase tracking-wide px-3 py-1" style={{ color: '#0c447c', background: '#e6f1fb', borderTop: '0.5px solid #e5e7eb', borderBottom: '0.5px solid #b5d4f4' }}>Saldo del día</div>
                <div className="px-3 py-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Flujo neto diario</span>
                    <span className={`text-xs font-semibold ${row.flujoNeto >= 0 ? 'cf-pos' : 'cf-neg'}`}>{fmtCLP(row.flujoNeto)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
                    <span className="text-[11px] font-medium text-gray-700">Saldo de cierre</span>
                    <span className={`text-[13px] font-semibold ${row.saldoFinal >= 0 ? 'cf-pos' : 'cf-neg'}`}>{fmtCLP(row.saldoFinal)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div className="text-base font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

// Input de monto en CLP: formateado al perder foco, dígitos al editar.
function MoneyInput({ value, onChange, className }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const display = focused ? draft : (value ? '$' + value.toLocaleString('es-CL') : '');
  return (
    <input
      className={className}
      inputMode="numeric"
      placeholder="$0"
      value={display}
      onFocus={(e) => { setFocused(true); setDraft(value ? String(value) : ''); requestAnimationFrame(() => e.target.select()); }}
      onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setDraft(v); onChange(parseInt(v, 10) || 0); }}
      onBlur={() => setFocused(false)}
    />
  );
}
