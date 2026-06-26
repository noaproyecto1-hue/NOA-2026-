// Vista completa de Alertas (botón "Alertas" de la barra superior).
// Muestra TODAS las alertas activas del sistema en el mismo formato del
// resumen del Dashboard (Compra / Óptimo / Fuga), ordenadas y agrupadas de
// mayor a menor criticidad: 🔴 Crítico → 🟡 Atención → 🟢 Favorable.

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { AlertCard, ALERTAS, STATUS_STYLE } from '@/components/dashboard/alerts/alertsShared';

const GRUPOS = [
  { estado: 'critico', emoji: '🔴', titulo: 'Crítico', desc: 'Requiere acción inmediata (robo, desviación severa).' },
  { estado: 'atencion', emoji: '🟡', titulo: 'Atención', desc: 'Vigilar de cerca (merma elevada, precio sobre histórico).' },
  { estado: 'favorable', emoji: '🟢', titulo: 'Favorable', desc: 'Sin acción requerida — informativo.' },
];

export default function AlertsFullView() {
  const total = ALERTAS.length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-noa-orange/15 rounded-xl flex items-center justify-center border border-noa-orange/30">
          <ShieldAlert className="w-5 h-5 text-noa-orange" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight font-display">Centro de Alertas</h2>
          <p className="text-xs text-white/60 font-medium">
            {total} alertas activas · ordenadas de mayor a menor criticidad
          </p>
        </div>
      </div>

      {GRUPOS.map(({ estado, emoji, titulo, desc }) => {
        const items = ALERTAS.filter((a) => a.estado === estado).sort((a, b) => (b.sev || 0) - (a.sev || 0));
        if (items.length === 0) return null;
        const st = STATUS_STYLE[estado];
        return (
          <div key={estado}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">{emoji}</span>
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: st.dot }}>{titulo}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{items.length}</span>
              <span className="text-[11px] text-white/50">· {desc}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((a) => <AlertCard key={a.producto} a={a} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
