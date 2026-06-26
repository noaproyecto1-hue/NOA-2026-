// Módulo compartido del Panel de Alertas (formato Compra / Óptimo / Fuga).
// Lo usan tanto el resumen del Dashboard (top 4) como la vista completa
// (botón "Alertas" de la barra superior). Mantener una sola fuente para que
// ambos muestren EXACTAMENTE el mismo formato y datos.

import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export function clp(n) {
  return (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

export const STATUS_STYLE = {
  favorable: { color: '#1D9E75', bg: '#E1F5EE', label: 'Favorable', dot: '#1D9E75' },
  atencion: { color: '#BA7517', bg: '#FAEEDA', label: 'Atención', dot: '#F59E0B' },
  critico: { color: '#7A1212', bg: '#F7D5D5', label: 'Crítico', dot: '#7A1212' },
};

const PILL_STYLE = {
  Robo: { bg: '#FCEBEB', border: '#F09595', color: '#A32D2D' },
  Desviación: { bg: '#FAEEDA', border: '#FAC775', color: '#633806' },
  Merma: { bg: '#E1F5EE', border: '#9FE1CB', color: '#085041' },
  Precio: { bg: '#E6F1FB', border: '#85B7EB', color: '#0C447C' },
  Óptimo: { bg: '#E1F5EE', border: '#9FE1CB', color: '#1D9E75' },
};

const ACCIONES = {
  Robo: 'Posible robo interno. Audita stock vs. compras y restringe accesos a bodega.',
  Desviación: 'Consumo sobre lo óptimo. Revisa porciones y estandariza la receta.',
  Merma: 'Merma elevada. Revisa manipulación, almacenamiento y vida útil.',
  Precio: 'Alza de precio sobre el histórico. Renegocia o cotiza proveedor alternativo.',
  Óptimo: 'Sin acción requerida. El consumo y el costo de este insumo están dentro del rango óptimo.',
};

// Orden de criticidad: crítico (0) → atención (1) → favorable (2).
const ESTADO_RANK = { critico: 0, atencion: 1, favorable: 2 };

// Dataset de alertas del sistema (Kingdom Coffee). El resumen del Dashboard
// toma las 4 primeras tras ordenar; la vista completa muestra todas.
export const ALERTAS = [
  // 🔴 CRÍTICO
  { producto: 'Lomo vetado', tipo: 'Robo', sev: 82, estado: 'critico',
    compra: { monto: 485000, cant: '12 kg' }, optimo: { monto: 323000, cant: '8 kg' }, fuga: { monto: 162000, cant: '4 kg' } },
  { producto: 'Salmón ahumado', tipo: 'Robo', sev: 74, estado: 'critico',
    compra: { monto: 612000, cant: '14 kg' }, optimo: { monto: 437000, cant: '10 kg' }, fuga: { monto: 175000, cant: '4 kg' } },
  { producto: 'Carne mechada', tipo: 'Desviación', sev: 67, estado: 'critico',
    compra: { monto: 398000, cant: '22 kg' }, optimo: { monto: 290000, cant: '16 kg' }, fuga: { monto: 108000, cant: '6 kg' } },
  { producto: 'Queso cheddar', tipo: 'Robo', sev: 63, estado: 'critico',
    compra: { monto: 268000, cant: '30 kg' }, optimo: { monto: 188000, cant: '21 kg' }, fuga: { monto: 80000, cant: '9 kg' } },
  { producto: 'Pan ciabatta', tipo: 'Desviación', sev: 60, estado: 'critico',
    compra: { monto: 152000, cant: '600 u' }, optimo: { monto: 99000, cant: '390 u' }, fuga: { monto: 53000, cant: '210 u' } },
  // 🟡 ATENCIÓN
  { producto: 'Aceite de oliva virgen', tipo: 'Desviación', sev: 58, estado: 'atencion',
    compra: { monto: 124000, cant: '18 lt' }, optimo: { monto: 96000, cant: '14 lt' }, fuga: { monto: 28000, cant: '4 lt' } },
  { producto: 'Palta Hass', tipo: 'Precio', sev: 49, estado: 'atencion',
    compra: { monto: 168000, cant: '$3.360/kg' }, optimo: { monto: 132000, cant: '$2.640/kg' }, fuga: { monto: 36000, cant: '+$720/kg' } },
  { producto: 'Tocino ahumado', tipo: 'Merma', sev: 45, estado: 'atencion',
    compra: { monto: 196000, cant: '16 kg' }, optimo: { monto: 152000, cant: '12,5 kg' }, fuga: { monto: 44000, cant: '3,5 kg' } },
  { producto: 'Salmón fresco', tipo: 'Merma', sev: 41, estado: 'atencion',
    compra: { monto: 378000, cant: '9 kg' }, optimo: { monto: 336000, cant: '8 kg' }, fuga: { monto: 42000, cant: '1 kg' } },
  { producto: 'Camarón pelado', tipo: 'Merma', sev: 39, estado: 'atencion',
    compra: { monto: 224000, cant: '8 kg' }, optimo: { monto: 182000, cant: '6,5 kg' }, fuga: { monto: 42000, cant: '1,5 kg' } },
  { producto: 'Queso crema', tipo: 'Merma', sev: 38, estado: 'atencion',
    compra: { monto: 142000, cant: '24 kg' }, optimo: { monto: 118000, cant: '20 kg' }, fuga: { monto: 24000, cant: '4 kg' } },
  { producto: 'Mantequilla', tipo: 'Precio', sev: 36, estado: 'atencion',
    compra: { monto: 98000, cant: '$7.840/kg' }, optimo: { monto: 78000, cant: '$6.240/kg' }, fuga: { monto: 20000, cant: '+$1.600/kg' } },
  { producto: 'Tomate rama', tipo: 'Precio', sev: 35, estado: 'atencion',
    compra: { monto: 89000, cant: '$4.450/kg' }, optimo: { monto: 66000, cant: '$3.300/kg' }, fuga: { monto: 23000, cant: '+$1.150/kg' } },
  { producto: 'Pan brioche', tipo: 'Desviación', sev: 31, estado: 'atencion',
    compra: { monto: 96000, cant: '320 u' }, optimo: { monto: 78000, cant: '260 u' }, fuga: { monto: 18000, cant: '60 u' } },
  { producto: 'Harina sin polvos', tipo: 'Desviación', sev: 29, estado: 'atencion',
    compra: { monto: 64000, cant: '80 kg' }, optimo: { monto: 52000, cant: '65 kg' }, fuga: { monto: 12000, cant: '15 kg' } },
  { producto: 'Leche condensada', tipo: 'Precio', sev: 27, estado: 'atencion',
    compra: { monto: 72000, cant: '$3.600/u' }, optimo: { monto: 58000, cant: '$2.900/u' }, fuga: { monto: 14000, cant: '+$700/u' } },
  // 🟢 FAVORABLE (informativo, sin acción)
  { producto: 'Café en grano', tipo: 'Precio', sev: 6, estado: 'favorable',
    compra: { monto: 272000, cant: '$6.800/kg' }, optimo: { monto: 268000, cant: '$6.700/kg' }, fuga: { monto: 4000, cant: '−$100/kg' } },
  { producto: 'Pollo grillado', tipo: 'Óptimo', sev: 4, estado: 'favorable',
    compra: { monto: 210000, cant: '40 kg' }, optimo: { monto: 206000, cant: '39 kg' }, fuga: { monto: 4000, cant: '1 kg' } },
  { producto: 'Leche entera', tipo: 'Óptimo', sev: 3, estado: 'favorable',
    compra: { monto: 132000, cant: '180 lt' }, optimo: { monto: 130000, cant: '178 lt' }, fuga: { monto: 2000, cant: '2 lt' } },
  { producto: 'Azúcar', tipo: 'Óptimo', sev: 3, estado: 'favorable',
    compra: { monto: 58000, cant: '120 kg' }, optimo: { monto: 57000, cant: '118 kg' }, fuga: { monto: 1000, cant: '2 kg' } },
  { producto: 'Huevos', tipo: 'Óptimo', sev: 5, estado: 'favorable',
    compra: { monto: 96000, cant: '200 u' }, optimo: { monto: 92000, cant: '190 u' }, fuga: { monto: 4000, cant: '10 u' } },
  { producto: 'Tomate cherry', tipo: 'Óptimo', sev: 4, estado: 'favorable',
    compra: { monto: 84000, cant: '12 kg' }, optimo: { monto: 81000, cant: '11,5 kg' }, fuga: { monto: 3000, cant: '0,5 kg' } },
];

// Ordena por criticidad y, dentro del mismo estado, por severidad descendente.
export function sortBySeverity(arr) {
  return [...arr].sort((a, b) => {
    const r = (ESTADO_RANK[a.estado] ?? 1) - (ESTADO_RANK[b.estado] ?? 1);
    return r !== 0 ? r : (b.sev || 0) - (a.sev || 0);
  });
}

export function AlertCard({ a }) {
  const [open, setOpen] = useState(false);
  const pill = PILL_STYLE[a.tipo] || PILL_STYLE.Precio;
  const st = STATUS_STYLE[a.estado] || STATUS_STYLE.atencion;
  const fugaPct = a.compra.monto > 0 ? (a.fuga.monto / a.compra.monto) * 100 : 0;
  const optimoPct = a.compra.monto > 0 ? (a.optimo.monto / a.compra.monto) * 100 : 0;
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
