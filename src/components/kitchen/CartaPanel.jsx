import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Save, Search, X, ChevronUp, ChevronDown, MoreVertical, Coffee, CupSoda,
  Sandwich, Beef, Soup, Salad, IceCream, Croissant, Wine, Citrus, Star,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════
// Módulo "Carta" (Menu Manager) — Kingdom Coffee
// Edición inline de familias/productos con guardado masivo (batch save).
// La app no tiene backend real: GET /api/menu y PATCH /api/products/batch se
// simulan sobre localStorage (clave noa_carta_v2). El contrato de la vista
// (dirtyItems, localEdits, batch) se respeta tal cual la especificación.
// ════════════════════════════════════════════════════════════════════════

const STORE_KEY = 'noa_carta_v2';
const ACCENT = '#c17f2a';

const ICONS = {
  Coffee, CupSoda, Sandwich, Beef, Soup, Salad, IceCream, Croissant, Wine, Citrus,
};

// ── Semilla (GET /api/menu) ──
function seed() {
  const families = [
    { id: 'bebidas-frias', label: 'Bebidas frías', icon: 'CupSoda', allowedSizes: ['S', 'M', 'XL'], isVisible: true, sortOrder: 1 },
    { id: 'bebidas-calientes', label: 'Bebidas calientes', icon: 'Coffee', allowedSizes: ['S', 'M', 'XL'], isVisible: true, sortOrder: 2 },
    { id: 'limonadas', label: 'Limonadas', icon: 'Citrus', allowedSizes: ['S', 'M', 'XL'], isVisible: true, sortOrder: 3 },
    { id: 'jugos', label: 'Jugos naturales', icon: 'CupSoda', allowedSizes: ['U'], isVisible: true, sortOrder: 4 },
    { id: 'sandwich', label: 'Sandwiches', icon: 'Sandwich', allowedSizes: ['U'], isVisible: true, sortOrder: 5 },
    { id: 'burger', label: 'Burgers', icon: 'Beef', allowedSizes: ['U'], isVisible: true, sortOrder: 6 },
    { id: 'desayunos', label: 'Desayunos y brunch', icon: 'Croissant', allowedSizes: ['U'], isVisible: true, sortOrder: 7 },
    { id: 'crema-sopa', label: 'Cremas y sopas', icon: 'Soup', allowedSizes: ['U'], isVisible: true, sortOrder: 8 },
    { id: 'ensaladas', label: 'Ensaladas', icon: 'Salad', allowedSizes: ['U'], isVisible: true, sortOrder: 9 },
    { id: 'helados', label: 'Helados Pudú', icon: 'IceCream', allowedSizes: ['S', 'M', 'XL'], isVisible: true, sortOrder: 10 },
  ];
  let pid = 0;
  const mk = (familyId, name, description, prices, tags = [], isActive = true) =>
    ({ id: `p${++pid}`, familyId, name, description, prices, tags, isActive, sortOrder: pid, updatedAt: null });
  const products = [
    mk('bebidas-calientes', 'Espresso', 'Café de especialidad', { S: 1900, M: 2200, XL: 2600 }),
    mk('bebidas-calientes', 'Cappuccino', 'Espresso, leche y espuma', { S: 2800, M: 3200, XL: 3800 }, ['suggested']),
    mk('bebidas-calientes', 'Latte', 'Café con leche cremoso', { S: 3000, M: 3400, XL: 3900 }),
    mk('bebidas-calientes', 'Mocha', 'Café, chocolate y leche', { S: 3200, M: 3700, XL: 4200 }),
    mk('bebidas-frias', 'Iced Latte', 'Café helado con leche', { S: 3200, M: 3600, XL: 4100 }),
    mk('bebidas-frias', 'Cold Brew', 'Café de extracción en frío', { S: 3400, M: 3800, XL: 4300 }, ['suggested']),
    mk('bebidas-frias', 'Frappé sin azúcar', 'Café batido helado', { S: 3600, M: 4100, XL: 4600 }, ['sin-azucar']),
    mk('limonadas', 'Limonada menta-jengibre', 'Refrescante de la casa', { S: 3200, M: 3900, XL: 4500 }),
    mk('jugos', 'Jugo natural del día', 'Fruta de estación', { U: 3500 }),
    mk('sandwich', 'Salmo 91', 'Lomo, queso, palta y tomate en pan artesanal', { U: 8900 }, ['suggested']),
    mk('sandwich', 'Judas Iscariote', 'Mechada, cebolla caramelizada y queso', { U: 8500 }, ['suggested']),
    mk('sandwich', 'Frutos del Edén', 'Vegetariano de la huerta', { U: 7200 }),
    mk('sandwich', 'María Magdalena', 'Pollo, palta y mayo de la casa', { U: 7900 }),
    mk('sandwich', 'Lomo a lo Pobre', 'Lomo, huevo, cebolla y papas', { U: 9500 }),
    mk('burger', 'Kingburg', 'Doble carne, cheddar y salsa Kingdom', { U: 9900 }, ['suggested']),
    mk('burger', 'Rey David', 'Carne, tocino y queso azul', { U: 9500 }),
    mk('burger', 'Mechada Romana', 'Mechada, rúcula y parmesano', { U: 9200 }),
    mk('burger', 'Tierra Prometida', 'Hamburguesa vegetal', { U: 8500 }, ['gluten-free']),
    mk('desayunos', 'Tostada campestre', 'Pan de masa madre, palta y huevo', { U: 6500 }),
    mk('desayunos', 'Tostada salmón ahumado', 'Salmón, queso crema y eneldo', { U: 8200 }, ['suggested']),
    mk('desayunos', 'Paila sureña', 'Huevos, longaniza y tomate', { U: 7500 }),
    mk('desayunos', 'Omelette queso tocino', 'Tres huevos, queso y tocino', { U: 6900 }),
    mk('crema-sopa', 'Zapallo asado emperador', 'Crema de zapallo asado', { U: 5900 }, ['keto']),
    mk('crema-sopa', 'Consomé de pollo', 'Caldo de la casa con huevo pochado', { U: 5500 }),
    mk('ensaladas', 'Salmo Salad', 'Mix verde, salmón y palta', { U: 8500 }, ['sin-azucar']),
    mk('ensaladas', 'César', 'Clásica con pollo y crutones', { U: 7500 }),
    mk('helados', 'Helado Pudú', '1, 2 o 3 sabores', { S: 2500, M: 3500, XL: 4500 }),
  ];
  return { families, products };
}

function loadMenu() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && raw.families && raw.products) return raw;
  } catch {}
  const s = seed();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
  return s;
}

// ── Helpers de precio ──
const fmtPrice = (n) => `$${(Number(n) || 0).toLocaleString('es-CL')}`;
const parsePrice = (str) => {
  const digits = String(str ?? '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
};

const SIZE_LABEL = { S: 'S', M: 'M', XL: 'XL', U: 'Precio' };

const PILLS = [
  { id: 'all', label: 'Todos' },
  { id: 'suggested', label: '★ Sugeridos' },
  { id: 'keto', label: 'Keto / sin azúcar' },
];

const TAG_BADGE = {
  suggested: { label: '★ Sugerido', bg: '#FEF3C7', color: '#92400E' },
  keto: { label: 'Keto', bg: '#E1F5EE', color: '#085041' },
  'gluten-free': { label: 'Gluten free', bg: '#EDE7FB', color: '#4C2A86' },
  'sin-azucar': { label: 'Sin azúcar', bg: '#E6F1FB', color: '#0C447C' },
};

export default function CartaPanel({ onUpdateRecipePrice }) {
  const [families, setFamilies] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado de cambios
  const [dirtyItems, setDirtyItems] = useState(() => new Set());
  const [localEdits, setLocalEdits] = useState(() => new Map());
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Filtros / colapsado (memoria de sesión)
  const [search, setSearch] = useState('');
  const [pill, setPill] = useState('all');
  const [collapsed, setCollapsed] = useState({}); // familyId -> bool (default: todas abiertas)

  // Carga inicial (GET /api/menu simulado)
  useEffect(() => {
    const t = setTimeout(() => {
      const { families: f, products: p } = loadMenu();
      setFamilies(f.slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setProducts(p);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, []);

  // Aviso al salir con cambios pendientes
  useEffect(() => {
    const handler = (e) => {
      if (dirtyItems.size > 0) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyItems]);

  // Producto "efectivo" = base + ediciones locales
  const effective = useCallback((p) => {
    const e = localEdits.get(p.id);
    return e ? { ...p, ...e, prices: { ...p.prices, ...(e.prices || {}) } } : p;
  }, [localEdits]);

  // Marca un producto como editado
  const markDirty = useCallback((id, patch) => {
    setDirtyItems((prev) => { const n = new Set(prev); n.add(id); return n; });
    setLocalEdits((prev) => {
      const n = new Map(prev);
      const cur = n.get(id) || {};
      const merged = { ...cur, ...patch };
      if (patch.prices) merged.prices = { ...(cur.prices || {}), ...patch.prices };
      n.set(id, merged);
      return n;
    });
    setSaved(false);
  }, []);

  const setField = useCallback((id, field, value) => markDirty(id, { [field]: value }), [markDirty]);
  const setPrice = useCallback((id, size, value) => markDirty(id, { prices: { [size]: value } }), [markDirty]);

  // ── Batch save (PATCH /api/products/batch simulado) ──
  const handleSave = useCallback(() => {
    if (dirtyItems.size === 0) { setSaved(true); setTimeout(() => setSaved(false), 2000); return; }
    setSaveError(false);
    try {
      const next = products.map((p) => {
        if (!dirtyItems.has(p.id)) return p;
        const e = localEdits.get(p.id) || {};
        return { ...p, ...e, prices: { ...p.prices, ...(e.prices || {}) }, updatedAt: Date.now() };
      });
      // Persistencia (simula la transacción del backend)
      localStorage.setItem(STORE_KEY, JSON.stringify({ families, products: next }));
      setProducts(next);
      // Sincroniza precio con la receta asociada, si existe el callback
      if (onUpdateRecipePrice) {
        next.forEach((p) => {
          if (dirtyItems.has(p.id)) {
            const precio = p.prices.U ?? p.prices.M ?? p.prices.S ?? p.prices.XL;
            if (precio != null) onUpdateRecipePrice(p.name, precio);
          }
        });
      }
      setDirtyItems(new Set());
      setLocalEdits(new Map());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 4000);
    }
  }, [dirtyItems, localEdits, products, families, onUpdateRecipePrice]);

  // Mutaciones estructurales (duplicar / mover / ocultar / eliminar)
  const duplicateProduct = useCallback((p) => {
    const id = `p_new_${Date.now()}`;
    const copy = { ...p, id, name: `${effective(p).name} (copia)`, updatedAt: null };
    setProducts((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      const n = prev.slice(); n.splice(idx + 1, 0, copy); return n;
    });
    markDirty(id, { name: copy.name });
  }, [effective, markDirty]);

  const moveProduct = useCallback((p, familyId) => {
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, familyId } : x));
    markDirty(p.id, { familyId });
  }, [markDirty]);

  const toggleActive = useCallback((p) => {
    const val = !effective(p).isActive;
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, isActive: val } : x));
    markDirty(p.id, { isActive: val });
  }, [effective, markDirty]);

  const deleteProduct = useCallback((p) => {
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    setDirtyItems((prev) => { const n = new Set(prev); n.add(p.id); return n; });
    setLocalEdits((prev) => { const n = new Map(prev); n.set(p.id, { _deleted: true }); return n; });
    setSaved(false);
  }, []);

  // ── Filtrado (cliente) ──
  const matchesBusqueda = (p, q) => {
    if (!q) return true;
    const e = effective(p); const ql = q.toLowerCase();
    return (e.name || '').toLowerCase().includes(ql) || (e.description || '').toLowerCase().includes(ql);
  };
  const matchesTag = (p, active) => {
    if (active === 'all') return true;
    const tags = effective(p).tags || [];
    if (active === 'suggested') return tags.includes('suggested');
    if (active === 'keto') return tags.includes('keto') || tags.includes('sin-azucar');
    return true;
  };

  const visibleByFamily = useMemo(() => {
    const map = {};
    for (const f of families) {
      map[f.id] = products
        .filter((p) => p.familyId === f.id && !(localEdits.get(p.id)?._deleted))
        .filter((p) => matchesBusqueda(p, search) && matchesTag(p, pill))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [families, products, search, pill, localEdits]);

  const hayResultados = families.some((f) => (visibleByFamily[f.id] || []).length > 0);

  return (
    <div className="font-sans">
      {/* 1. Top bar */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-3 mb-2 bg-white/95 backdrop-blur-sm border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-noa-navy">Carta</h1>
          <p className="text-xs text-gray-500">Edita directamente cualquier campo</p>
        </div>
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
          style={{ background: saved ? '#1D9E75' : ACCENT }}
        >
          <Save className="w-4 h-4" /> {saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>

      {/* 2. Barra de cambios pendientes */}
      {dirtyItems.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: '#FEF6E0', border: '1px solid #FAC775', color: '#7A5A12' }}>
          <span>{dirtyItems.size} producto{dirtyItems.size !== 1 ? 's' : ''} con cambios sin guardar</span>
          <button onClick={handleSave} className="rounded-md border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: '#FAC775', color: '#7A5A12' }}>Guardar ahora</button>
        </div>
      )}

      {saveError && (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: '#FCEBEB', border: '1px solid #F09595', color: '#A32D2D' }}>
          No se pudieron guardar los cambios. Intenta nuevamente.
        </div>
      )}

      {/* 3. Búsqueda + pills */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..." aria-label="Buscar producto"
            className="w-full h-10 pl-9 pr-9 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-noa-navy"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PILLS.map((pl) => (
            <button key={pl.id} onClick={() => setPill(pl.id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={pill === pl.id
                ? { background: ACCENT, color: '#fff', borderColor: ACCENT }
                : { background: '#fff', color: '#475569', borderColor: '#e5e7eb' }}>
              {pl.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Familias */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : !hayResultados ? (
        <div className="text-center py-16 text-gray-500">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No se encontraron productos que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {families.map((f) => {
            const items = visibleByFamily[f.id] || [];
            if (items.length === 0) return null;
            const isOpen = !collapsed[f.id];
            const Icon = ICONS[f.icon] || Coffee;
            const tableId = `tabla-${f.id}`;
            return (
              <div key={f.id} className="rounded-xl border border-gray-100 overflow-hidden bg-white">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [f.id]: !c[f.id] }))}
                  aria-expanded={isOpen} aria-controls={tableId}
                  className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                  style={{ borderRadius: 0 }}
                >
                  <Icon className="w-5 h-5" style={{ color: ACCENT }} />
                  <span className="font-semibold text-noa-navy">{f.label}</span>
                  <span className="ml-auto text-xs text-gray-400">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {isOpen && (
                  <ProductTable
                    tableId={tableId} family={f} items={items} effective={effective}
                    dirtyItems={dirtyItems} onField={setField} onPrice={setPrice}
                    families={families}
                    onDuplicate={duplicateProduct} onMove={moveProduct}
                    onToggleActive={toggleActive} onDelete={deleteProduct}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tabla de productos de una familia ──
function ProductTable({ tableId, family, items, effective, dirtyItems, onField, onPrice, families, onDuplicate, onMove, onToggleActive, onDelete }) {
  const sizes = family.allowedSizes || ['U'];
  return (
    <div className="overflow-hidden">
      <table id={tableId} className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
            <th scope="col" className="py-2 px-4 font-medium">Nombre</th>
            <th scope="col" className="py-2 px-4 font-medium">Descripción</th>
            {sizes.map((s) => (
              <th key={s} scope="col" className="py-2 px-2 font-medium text-right w-[84px]">{SIZE_LABEL[s]}</th>
            ))}
            <th scope="col" className="py-2 px-2 w-10" aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <ProductRow
              key={p.id} product={effective(p)} rawId={p.id} sizes={sizes}
              dirty={dirtyItems.has(p.id)} onField={onField} onPrice={onPrice}
              families={families} onDuplicate={() => onDuplicate(p)} onMove={(fid) => onMove(p, fid)}
              onToggleActive={() => onToggleActive(p)} onDelete={() => onDelete(p)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Fila de producto con edición inline ──
function ProductRow({ product, rawId, sizes, dirty, onField, onPrice, families, onDuplicate, onMove, onToggleActive, onDelete }) {
  const [nameErr, setNameErr] = useState(false);
  const inactivo = !product.isActive;

  const inputBase = 'w-full bg-transparent border border-transparent rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:bg-amber-50/60';
  const focusStyle = (e) => { e.target.style.borderColor = ACCENT; };
  const blurStyle = (e) => { e.target.style.borderColor = 'transparent'; };

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors" style={inactivo ? { opacity: 0.5 } : undefined}>
      {/* Nombre */}
      <td className="py-1 px-4 align-middle">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dirty ? ACCENT : 'transparent' }} aria-hidden="true" />
          <div className="relative flex-1 min-w-[120px]">
            <input
              type="text" defaultValue={product.name} aria-label={`Nombre del producto ${product.name}`}
              className={inputBase + ' font-medium'} onFocus={focusStyle}
              onChange={(e) => { setNameErr(false); onField(rawId, 'name', e.target.value); }}
              onBlur={(e) => {
                blurStyle(e);
                if (!e.target.value.trim()) { setNameErr(true); e.target.value = product.name; onField(rawId, 'name', product.name); }
              }}
            />
            {nameErr && <span className="absolute left-2 -bottom-4 text-[10px] text-red-600">El nombre no puede estar vacío</span>}
          </div>
          {inactivo && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 shrink-0">Oculto</span>}
          {(product.tags || []).filter((t) => TAG_BADGE[t]).slice(0, 2).map((t) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: TAG_BADGE[t].bg, color: TAG_BADGE[t].color }}>{TAG_BADGE[t].label}</span>
          ))}
        </div>
      </td>
      {/* Descripción */}
      <td className="py-1 px-4 align-middle">
        <input
          type="text" defaultValue={product.description} placeholder="Descripción corta..."
          aria-label={`Descripción de ${product.name}`} className={inputBase + ' text-gray-600'}
          onFocus={focusStyle} onBlur={blurStyle}
          onChange={(e) => onField(rawId, 'description', e.target.value)}
        />
      </td>
      {/* Precios */}
      {sizes.map((s) => {
        const val = product.prices?.[s];
        return (
          <td key={s} className="py-1 px-2 align-middle text-right">
            <input
              type="text" inputMode="numeric"
              defaultValue={val != null ? fmtPrice(val) : ''} placeholder="—"
              data-value={val != null ? val : ''}
              aria-label={`Precio ${SIZE_LABEL[s]} de ${product.name}`}
              className={inputBase + ' text-right w-[72px] tabular-nums'}
              onFocus={(e) => { focusStyle(e); e.target.select(); }}
              onChange={(e) => {
                const n = parsePrice(e.target.value);
                e.target.value = n != null ? fmtPrice(n) : '';
                e.target.dataset.value = n != null ? n : '';
                onPrice(rawId, s, n);
              }}
              onBlur={(e) => { blurStyle(e); if (!e.target.value.trim()) { e.target.dataset.value = ''; onPrice(rawId, s, null); } }}
            />
          </td>
        );
      })}
      {/* Acciones */}
      <td className="py-1 px-2 align-middle text-right">
        <ActionsMenu
          product={product} families={families}
          onDuplicate={onDuplicate} onMove={onMove} onToggleActive={onToggleActive} onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

// ── Menú contextual (⋮) ──
function ActionsMenu({ product, families, onDuplicate, onMove, onToggleActive, onDelete }) {
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [moving, setMoving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setConfirmDel(false); setMoving(false); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const otras = families.filter((f) => f.id !== product.familyId);

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Acciones de ${product.name}`}
        className="text-gray-300 hover:text-[color:var(--acc)] p-1 rounded" style={{ '--acc': ACCENT }}>
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-52 rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm text-gray-700">
          {confirmDel ? (
            <div className="px-3 py-2">
              <p className="text-xs text-gray-600 mb-2">¿Confirmar eliminación?</p>
              <div className="flex gap-2">
                <button onClick={() => { setConfirmDel(false); setOpen(false); }} className="flex-1 rounded border px-2 py-1 text-xs">Cancelar</button>
                <button onClick={() => { onDelete(); setOpen(false); }} className="flex-1 rounded px-2 py-1 text-xs text-white" style={{ background: '#A32D2D' }}>Eliminar</button>
              </div>
            </div>
          ) : moving ? (
            <div className="px-3 py-2">
              <p className="text-xs text-gray-500 mb-1">Mover a:</p>
              <select autoFocus className="w-full h-8 rounded border border-gray-200 text-xs text-gray-900 px-1"
                onChange={(e) => { if (e.target.value) { onMove(e.target.value); setOpen(false); } }} defaultValue="">
                <option value="" disabled>Elige familia…</option>
                {otras.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          ) : (
            <>
              <MenuItem onClick={() => { onDuplicate(); setOpen(false); }}>Duplicar producto</MenuItem>
              <MenuItem onClick={() => setMoving(true)}>Mover a otra familia</MenuItem>
              <MenuItem onClick={() => { onToggleActive(); setOpen(false); }}>
                {product.isActive ? 'Ocultar de la carta pública' : 'Mostrar en la carta'}
              </MenuItem>
              <div className="my-1 border-t border-gray-100" />
              <MenuItem danger onClick={() => setConfirmDel(true)}>Eliminar producto</MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 ${danger ? 'text-red-600' : ''}`}>
      {children}
    </button>
  );
}
