import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, Pencil, Eye, Coffee, UtensilsCrossed, Check } from 'lucide-react';

// ── Módulo Carta (Prompt 13 del informe) ──
// Carta digital visual, dinámica y editable. Dos páginas (Bebidas / Comidas),
// fondo oscuro, títulos naranja dorado, badges especiales. Precios con IVA.
// Persistencia en localStorage; sincroniza el precio con la receta si existe el callback.

const PAGINA_BEBIDAS = [
  'Bebidas Frías', 'Bebidas Calientes', 'Chocolates', 'Té e Infusiones', 'Limonadas',
  'Jugos Naturales', 'Mocktails', 'Cervezas', 'Sin Cafeína',
];
const PAGINA_COMIDAS = [
  'Sandwich', 'Burger', 'Desayunos y Brunch', 'Ceviche & Tártaro', 'Crema & Sopa',
  'Ensaladas', 'Kids', 'Keto', 'Helados Pudú', 'Pastelería', 'Bollería',
];

const BADGE_STYLE = {
  '⭐ Muy pedido': { bg: 'rgba(245,158,11,0.18)', color: '#F59E0B', border: 'rgba(245,158,11,0.4)' },
  '⭐⭐ El más pedido': { bg: 'rgba(245,158,11,0.28)', color: '#FBBF24', border: 'rgba(245,158,11,0.6)' },
  'KETO': { bg: 'rgba(34,197,94,0.18)', color: '#4ADE80', border: 'rgba(34,197,94,0.4)' },
  'Sin Azúcar': { bg: 'rgba(59,130,246,0.18)', color: '#60A5FA', border: 'rgba(59,130,246,0.4)' },
  'Gluten Free': { bg: 'rgba(168,85,247,0.18)', color: '#C084FC', border: 'rgba(168,85,247,0.4)' },
};
const BADGE_OPCIONES = Object.keys(BADGE_STYLE);

// Semilla por defecto (usa nombres reales del informe en Comidas).
function semilla() {
  const mk = (name, desc, precio, badges = []) => ({ id: `${name}-${Math.random().toString(36).slice(2, 7)}`, name, desc, precio, badges });
  return {
    'Sandwich': [
      mk('Salmo 91', 'Lomo, queso, palta y tomate en pan artesanal', 8900, ['⭐⭐ El más pedido']),
      mk('Judas Iscariote', 'Mechada, cebolla caramelizada y queso', 8500, ['⭐ Muy pedido']),
      mk('Frutos del Edén', 'Vegetariano de la huerta', 7200),
      mk('María Magdalena', 'Pollo, palta y mayo de la casa', 7900),
      mk('Lomo a lo Pobre', 'Lomo, huevo, cebolla y papas', 9500),
    ],
    'Burger': [
      mk('Kingburg', 'Doble carne, cheddar y salsa Kingdom', 9900, ['⭐⭐ El más pedido']),
      mk('Rey David', 'Carne, tocino y queso azul', 9500),
      mk('Mechada Romana', 'Mechada, rúcula y parmesano', 9200),
      mk('Tierra Prometida', 'Hamburguesa vegetal', 8500, ['Gluten Free']),
    ],
    'Desayunos y Brunch': [
      mk('Tostada Campestre', 'Pan de masa madre, palta y huevo', 6500),
      mk('Tostada Salmón Ahumado', 'Salmón, queso crema y eneldo', 8200, ['⭐ Muy pedido']),
      mk('Tostada Silvestre', 'Champiñones y queso de cabra', 6900),
      mk('Paila Sureña', 'Huevos, longaniza y tomate', 7500),
      mk('Paila Gringa', 'Huevos, tocino y queso', 7500),
      mk('Quesadilla Lomo Queso', 'Lomo y queso fundido', 7800),
      mk('Quesadilla Salmón Ahumado', 'Salmón y queso', 8400),
      mk('Omelette Queso Tocino', 'Tres huevos, queso y tocino', 6900),
      mk('Omelette Salmón Ahumado', 'Tres huevos y salmón', 8200),
    ],
    'Ceviche & Tártaro': [
      mk('Ceviche de Pedro', 'Pescado fresco, cilantro y leche de tigre', 9800),
      mk('Tártaro Galileo', 'Tártaro de res con yema curada', 9900),
    ],
    'Crema & Sopa': [
      mk('Zapallo Asado Emperador', 'Crema de zapallo asado', 5900, ['KETO']),
      mk('Consomé de Pollo y Huevo Pochado', 'Caldo de la casa', 5500),
    ],
    'Ensaladas': [
      mk('Salmo Salad', 'Mix verde, salmón y palta', 8500, ['Sin Azúcar']),
      mk('César', 'Clásica con pollo y crutones', 7500),
    ],
    'Kids': [
      mk('Once Kids', 'Sandwich, jugo y postre', 5500),
      mk('Cajita Kingdom', 'Nuggets, papas y bebida', 5900),
    ],
    'Helados Pudú': [
      mk('Helado Simple', '1 sabor', 2500),
      mk('Helado Doble', '2 sabores', 3500),
      mk('Helado Triple', '3 sabores', 4500),
    ],
    'Bebidas Calientes': [
      mk('Espresso', 'Café de especialidad', 2200),
      mk('Cappuccino', 'Espresso, leche y espuma', 3200, ['⭐ Muy pedido']),
      mk('Latte', 'Café con leche cremoso', 3400),
    ],
    'Bebidas Frías': [
      mk('Iced Latte', 'Café helado con leche', 3600),
      mk('Cold Brew', 'Café de extracción en frío', 3800),
    ],
    'Limonadas': [
      mk('Limonada Menta-Jengibre', 'Refrescante de la casa', 3900),
    ],
    'Jugos Naturales': [
      mk('Jugo Natural del día', 'Fruta de estación', 3500),
    ],
  };
}

function loadCarta() {
  try {
    const c = JSON.parse(localStorage.getItem('noa_carta') || 'null');
    return c || semilla();
  } catch { return semilla(); }
}
function saveCarta(c) { try { localStorage.setItem('noa_carta', JSON.stringify(c)); } catch {} }

const clp = (n) => (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function CartaPanel({ onUpdateRecipePrice }) {
  const [carta, setCarta] = useState(loadCarta);
  const [pagina, setPagina] = useState('bebidas');
  const [editing, setEditing] = useState(null); // { section, item }
  const [preview, setPreview] = useState(false);
  const cartaRef = useRef(null);

  const secciones = pagina === 'bebidas' ? PAGINA_BEBIDAS : PAGINA_COMIDAS;
  const mitad = Math.ceil(secciones.length / 2);
  const colA = secciones.slice(0, mitad);
  const colB = secciones.slice(mitad);

  function persist(next) { setCarta(next); saveCarta(next); }

  function guardarPrecio(section, item, precio, badges) {
    const next = { ...carta };
    next[section] = (next[section] || []).map((it) => it.id === item.id ? { ...it, precio: Number(precio) || 0, badges } : it);
    persist(next);
    onUpdateRecipePrice?.(item.name, Number(precio) || 0);
    setEditing(null);
  }

  async function descargarPDF() {
    if (!cartaRef.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const canvas = await html2canvas(cartaRef.current, { scale: 2, backgroundColor: '#0b0d12' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, w, h);
    pdf.save(`Carta-${pagina}-Kingdom.pdf`);
  }

  const Seccion = ({ titulo }) => {
    const items = carta[titulo] || [];
    return (
      <div className="mb-6">
        <h3 className="text-[15px] font-bold mb-2 pb-1" style={{ color: '#E0A53F', borderBottom: '1px solid rgba(224,165,63,0.3)', fontFamily: '"Bricolage Grotesque", sans-serif' }}>{titulo}</h3>
        {items.length === 0 ? (
          <p className="text-[11px] text-white/30 italic py-1">Sin productos en esta sección.</p>
        ) : items.map((it) => (
          <div key={it.id} className="group flex items-start justify-between gap-2 py-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-semibold text-white">{it.name}</span>
                {(it.badges || []).map((b) => {
                  const s = BADGE_STYLE[b] || {};
                  return <span key={b} className="text-[9px] px-1.5 py-0.5 rounded-full border" style={{ background: s.bg, color: s.color, borderColor: s.border }}>{b}</span>;
                })}
              </div>
              {it.desc && <p className="text-[11px] text-white/45 leading-snug">{it.desc}</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[13px] font-bold" style={{ color: '#E0A53F' }}>{clp(it.precio)}</span>
              {!preview && (
                <button onClick={() => setEditing({ section: titulo, item: it })}
                  className="opacity-0 group-hover:opacity-100 transition text-white/50 hover:text-white" title="Editar precio">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de acciones */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-lg border bg-white p-1">
          <button onClick={() => setPagina('bebidas')} className={`px-3 py-1.5 rounded-md text-sm inline-flex items-center gap-1.5 ${pagina === 'bebidas' ? 'bg-noa-navy text-white' : 'text-gray-600'}`}>
            <Coffee className="w-4 h-4" /> Página 1 — Bebidas
          </button>
          <button onClick={() => setPagina('comidas')} className={`px-3 py-1.5 rounded-md text-sm inline-flex items-center gap-1.5 ${pagina === 'comidas' ? 'bg-noa-navy text-white' : 'text-gray-600'}`}>
            <UtensilsCrossed className="w-4 h-4" /> Página 2 — Comidas
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview((p) => !p)}>
            <Eye className="w-4 h-4 mr-1.5" /> {preview ? 'Salir de vista previa' : 'Vista previa'}
          </Button>
          <Button size="sm" className="bg-noa-navy hover:bg-noa-navy-mid" onClick={descargarPDF}>
            <Download className="w-4 h-4 mr-1.5" /> Descargar carta
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-500">Los precios se muestran con IVA incluido (precio de venta al público). Editar un precio aquí actualiza también la receta asociada.</p>

      {/* Carta (renderizada en componente, no imagen) */}
      <div ref={cartaRef} className="rounded-2xl p-6 md:p-8" style={{ background: 'linear-gradient(160deg, #0b0d12 0%, #14181f 100%)' }}>
        <div className="text-center mb-6">
          <p className="text-2xl font-bold" style={{ color: '#E0A53F', fontFamily: '"Bricolage Grotesque", sans-serif' }}>Kingdom Coffee</p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/40 mt-1">{pagina === 'bebidas' ? 'Bebidas' : 'Comidas'}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
          <div>{colA.map((s) => <Seccion key={s} titulo={s} />)}</div>
          <div>{colB.map((s) => <Seccion key={s} titulo={s} />)}</div>
        </div>
        <p className="text-center text-[10px] text-white/25 mt-4">NOA · Copiloto Gastronómico</p>
      </div>

      {editing && (
        <EditPrecioDialog
          data={editing}
          onClose={() => setEditing(null)}
          onSave={(precio, badges) => guardarPrecio(editing.section, editing.item, precio, badges)}
        />
      )}
    </div>
  );
}

function EditPrecioDialog({ data, onClose, onSave }) {
  const { item } = data;
  const [precio, setPrecio] = useState(item.precio || '');
  const [badges, setBadges] = useState(item.badges || []);
  const toggle = (b) => setBadges((arr) => arr.includes(b) ? arr.filter((x) => x !== b) : [...arr, b]);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="font-sans max-w-md">
        <DialogHeader><DialogTitle className="font-display text-noa-navy">{item.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Precio (con IVA)</label>
            <Input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-gray-600">Badges</label>
            <div className="flex flex-wrap gap-1.5">
              {BADGE_OPCIONES.map((b) => (
                <button key={b} onClick={() => toggle(b)}
                  className={`text-[11px] px-2 py-1 rounded-full border ${badges.includes(b) ? 'bg-noa-navy text-white border-noa-navy' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" onClick={() => onSave(precio, badges)}><Check className="w-4 h-4 mr-1.5" /> Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
