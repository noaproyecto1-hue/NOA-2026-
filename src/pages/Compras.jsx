import React, { useState, useMemo } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  AlertCircle, Loader2, FileText, ArrowLeft, Search, Building2, Receipt,
  TrendingUp, Layers, Boxes, Plus, Pencil, Trash2, ChevronRight, ChevronDown, X, Check,
} from 'lucide-react';

// ───────── helpers ─────────
function clp(n) { return (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }); }
function clpK(n) { const v = Number(n) || 0; return v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`; }
function fdate(v) { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString('es-CL'); }
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function loadSiiOverrides() {
  try {
    const sii = (JSON.parse(localStorage.getItem('noa_integrations') || '{}')).sii || {};
    const out = {};
    for (const k of ['rutEmpresa', 'rutCertificado', 'password', 'apiKey', 'ambiente', 'certBase64']) if (sii[k]) out[k] = sii[k];
    return out;
  } catch { return {}; }
}

// ───────── main ─────────
export default function Compras() {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });
  const rid = user?.restaurant_ids?.[0];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-noa-navy font-display">Compras</h1>
        <p className="text-gray-600 mt-1">Gasto por familia de insumos, catálogo de insumos y facturas del SII.</p>
      </div>

      <Tabs defaultValue="familia">
        <TabsList>
          <TabsTrigger value="familia"><Layers className="w-4 h-4 mr-1.5" /> Por familia</TabsTrigger>
          <TabsTrigger value="insumos"><Boxes className="w-4 h-4 mr-1.5" /> Insumos</TabsTrigger>
          <TabsTrigger value="facturas"><Receipt className="w-4 h-4 mr-1.5" /> Facturas SII</TabsTrigger>
        </TabsList>
        <TabsContent value="familia" className="mt-4"><PorFamilia rid={rid} /></TabsContent>
        <TabsContent value="insumos" className="mt-4"><InsumosCRUD rid={rid} /></TabsContent>
        <TabsContent value="facturas" className="mt-4"><FacturasSII /></TabsContent>
      </Tabs>
    </div>
  );
}

// ═════════════ TAB 1: Por familia de insumos ═════════════
function PorFamilia({ rid }) {
  const { data: costs = [] } = useQuery({
    queryKey: ['compras-familia-costs', rid],
    queryFn: async () => {
      const all = rid ? await base44.entities.SupplyCost.filter({ restaurant_id: rid }) : await base44.entities.SupplyCost.list();
      return (all || []).filter((c) => c.supply_type !== 'opex');
    },
    enabled: true, staleTime: 2 * 60 * 1000,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ['compras-familia-sales', rid],
    queryFn: async () => {
      const all = rid ? await base44.entities.Sale.filter({ restaurant_id: rid }) : await base44.entities.Sale.list();
      return (all || []).filter((s) => !s.is_cancelled);
    },
    enabled: true, staleTime: 2 * 60 * 1000,
  });

  const [expanded, setExpanded] = useState({});

  // Últimos 6 meses del año actual hasta el mes vigente
  const now = new Date();
  const year = now.getFullYear();
  const monthsCols = useMemo(() => {
    const cols = [];
    for (let m = Math.max(0, now.getMonth() - 5); m <= now.getMonth(); m++) cols.push(m);
    return cols;
  }, [now]);

  // Ventas por mes (para % sobre venta)
  const salesByMonth = useMemo(() => {
    const map = {};
    for (const s of sales) {
      const d = new Date(s.date_time);
      if (d.getFullYear() === year) map[d.getMonth()] = (map[d.getMonth()] || 0) + (Number(s.total_amount) || 0);
    }
    return map;
  }, [sales, year]);

  // Agrupa por familia → mes → monto, y por insumo dentro de familia
  const familias = useMemo(() => {
    const fam = {};
    for (const c of costs) {
      const d = new Date(c.date);
      if (d.getFullYear() !== year) continue;
      const m = d.getMonth();
      const famName = c.supply_category || 'Sin familia';
      const itemName = c.supply_item_name || c.supply_name || '—';
      const amount = Number(c.subtotal) || Number(c.total_cost) || 0;
      if (!fam[famName]) fam[famName] = { name: famName, byMonth: {}, items: {} };
      fam[famName].byMonth[m] = (fam[famName].byMonth[m] || 0) + amount;
      if (!fam[famName].items[itemName]) fam[famName].items[itemName] = { name: itemName, byMonth: {} };
      fam[famName].items[itemName].byMonth[m] = (fam[famName].items[itemName].byMonth[m] || 0) + amount;
    }
    // Total por familia para ordenar
    return Object.values(fam).map((f) => ({
      ...f,
      total: Object.values(f.byMonth).reduce((a, b) => a + b, 0),
      itemsList: Object.values(f.items).sort((a, b) =>
        Object.values(b.byMonth).reduce((x, y) => x + y, 0) - Object.values(a.byMonth).reduce((x, y) => x + y, 0)),
    })).sort((a, b) => b.total - a.total);
  }, [costs, year]);

  // Determina color de celda según % sobre venta vs promedio de la familia
  function cellColor(famPctList, pct, monthIdx) {
    if (monthIdx === now.getMonth()) return 'text-noa-info'; // mes actual = azul
    if (!pct || famPctList.length < 2) return 'text-green-600';
    const avg = famPctList.reduce((a, b) => a + b, 0) / famPctList.length;
    if (pct > avg * 1.30) return 'text-red-600';        // alerta de costo
    if (pct > avg * 1.15) return 'text-orange-600';     // leve desviación
    return 'text-green-600';                             // normal
  }

  if (familias.length === 0) {
    return <EmptyData msg="No hay compras registradas este año. Importa facturas en 'Ventas y Compras' o registra insumos comprados." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-noa-navy font-display">Compras por familia de insumos</h2>
        <p className="text-sm text-gray-500">Gasto mensual y % sobre venta · {year}</p>
      </div>

      <div className="overflow-x-auto border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Familia</TableHead>
              {monthsCols.map((m) => (
                <TableHead key={m} className={`text-right ${m === now.getMonth() ? 'text-noa-info' : ''}`}>
                  {MONTHS[m]}{m === now.getMonth() ? ' •' : ''}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {familias.map((f) => {
              const famPctList = monthsCols.map((m) => salesByMonth[m] ? (f.byMonth[m] || 0) / salesByMonth[m] * 100 : 0).filter((x) => x > 0);
              const isOpen = expanded[f.name];
              return (
                <React.Fragment key={f.name}>
                  <TableRow className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded((e) => ({ ...e, [f.name]: !e[f.name] }))}>
                    <TableCell className="font-medium text-noa-navy">
                      <span className="inline-flex items-center gap-1.5">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        {f.name} <span className="text-gray-400 text-xs">({f.itemsList.length})</span>
                      </span>
                    </TableCell>
                    {monthsCols.map((m) => {
                      const amount = f.byMonth[m] || 0;
                      const pct = salesByMonth[m] ? amount / salesByMonth[m] * 100 : 0;
                      return (
                        <TableCell key={m} className="text-right">
                          <div className="text-xs font-semibold text-gray-900">{amount ? clpK(amount) : '—'}</div>
                          {pct > 0 && <div className={`text-[11px] ${cellColor(famPctList, pct, m)}`}>{pct.toFixed(1)}%</div>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {isOpen && f.itemsList.map((it) => (
                    <TableRow key={`${f.name}-${it.name}`} className="bg-gray-50/50">
                      <TableCell className="pl-10 text-xs text-gray-700">{it.name}</TableCell>
                      {monthsCols.map((m) => {
                        const amount = it.byMonth[m] || 0;
                        const pct = salesByMonth[m] ? amount / salesByMonth[m] * 100 : 0;
                        return (
                          <TableCell key={m} className="text-right">
                            <div className="text-[11px] text-gray-700">{amount ? clpK(amount) : '—'}</div>
                            {pct > 0 && <div className="text-[10px] text-gray-400">{pct.toFixed(2)}%</div>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-600" /> ≤ umbral normal</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-600" /> leve desviación</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /> alerta de costo</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-noa-info" /> mes actual</span>
      </div>
    </div>
  );
}

// ═════════════ TAB 2: Insumos CRUD ═════════════
function InsumosCRUD({ rid }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | {} (nuevo) | item (editar)
  const [famModal, setFamModal] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['insumos-crud', rid],
    queryFn: async () => {
      const all = rid ? await base44.entities.SupplyItem.filter({ restaurant_id: rid }) : await base44.entities.SupplyItem.list();
      return all || [];
    },
    enabled: true, staleTime: 60 * 1000,
  });

  // Familias = categorías distintas + extras guardadas en localStorage
  const extraFams = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('noa_familias_extra') || '[]'); } catch { return []; }
  }, [famModal, items]);
  const familias = useMemo(() => {
    const set = new Set(extraFams);
    for (const i of items) if (i.category) set.add(i.category);
    return [...set].sort();
  }, [items, extraFams]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
  }, [items, search]);

  async function remove(item) {
    if (!confirm(`¿Eliminar el insumo "${item.name}"?`)) return;
    await base44.entities.SupplyItem.delete(item.id);
    queryClient.invalidateQueries({ queryKey: ['insumos-crud'] });
  }

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando insumos…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar insumo o familia" className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFamModal(true)}><Layers className="w-4 h-4 mr-1.5" /> Familias</Button>
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1.5" /> Nuevo insumo</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MiniStat label="Insumos totales" value={items.length} />
        <MiniStat label="Familias" value={familias.length} />
        <MiniStat label="Resultados" value={filtered.length} highlight />
      </div>

      {filtered.length === 0 ? (
        <EmptyData msg="No hay insumos. Crea el primero con 'Nuevo insumo'." />
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead><TableHead>Familia</TableHead><TableHead>Unidad</TableHead>
                <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Stock mín.</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead><TableHead>Proveedor</TableHead><TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((it) => (
                <TableRow key={it.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-noa-navy">{it.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{it.category || '—'}</Badge></TableCell>
                  <TableCell className="text-xs">{it.unit || '—'}</TableCell>
                  <TableCell className="text-right text-xs">{it.stock ?? '—'}</TableCell>
                  <TableCell className="text-right text-xs">{it.min_stock ?? '—'}</TableCell>
                  <TableCell className="text-right text-xs">{it.cost_per_unit ? clp(it.cost_per_unit) : '—'}</TableCell>
                  <TableCell className="text-xs">{it.supplier || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(it)}><Pencil className="w-4 h-4 text-gray-500" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(it)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing !== null && (
        <InsumoForm item={editing} familias={familias} rid={rid}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: ['insumos-crud'] }); }} />
      )}
      {famModal && <FamiliasModal familias={familias} items={items} onClose={() => setFamModal(false)} />}
    </div>
  );
}

function InsumoForm({ item, familias, rid, onClose, onSaved }) {
  const isNew = !item.id;
  const [form, setForm] = useState({
    name: item.name || '', category: item.category || '', unit: item.unit || 'kg',
    stock: item.stock ?? '', min_stock: item.min_stock ?? '', cost_per_unit: item.cost_per_unit ?? '', supplier: item.supplier || '',
    newCategory: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const category = form.newCategory.trim() || form.category;
    if (!form.name.trim() || !category) { alert('Nombre y familia son obligatorios'); return; }
    setSaving(true);
    try {
      const payload = {
        restaurant_id: rid, name: form.name.trim(), category, unit: form.unit,
        stock: Number(form.stock) || 0, min_stock: Number(form.min_stock) || 0,
        cost_per_unit: Number(form.cost_per_unit) || 0, supplier: form.supplier.trim(), is_active: true,
      };
      if (isNew) await base44.entities.SupplyItem.create(payload);
      else await base44.entities.SupplyItem.update(item.id, payload);
      // Persistir familia nueva
      if (form.newCategory.trim()) {
        try {
          const extra = JSON.parse(localStorage.getItem('noa_familias_extra') || '[]');
          if (!extra.includes(category)) localStorage.setItem('noa_familias_extra', JSON.stringify([...extra, category]));
        } catch {}
      }
      onSaved();
    } catch (err) { alert('Error: ' + err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="font-sans">
        <DialogHeader><DialogTitle className="font-display text-noa-navy">{isNew ? 'Nuevo insumo' : 'Editar insumo'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej: Filete de vacuno" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Familia *</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>{familias.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>…o nueva familia</Label>
              <Input value={form.newCategory} onChange={(e) => set('newCategory', e.target.value)} placeholder="Ej: Proteína animal" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Unidad</Label>
              <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['kg', 'gr', 'lt', 'ml', 'und', 'caja', 'docena'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)} /></div>
            <div className="space-y-1"><Label>Stock mín.</Label><Input type="number" value={form.min_stock} onChange={(e) => set('min_stock', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Costo unitario</Label><Input type="number" value={form.cost_per_unit} onChange={(e) => set('cost_per_unit', e.target.value)} /></div>
            <div className="space-y-1"><Label>Proveedor</Label><Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Guardar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FamiliasModal({ familias, items, onClose }) {
  const [list, setList] = useState(familias);
  const [nueva, setNueva] = useState('');

  function add() {
    const n = nueva.trim();
    if (!n || list.includes(n)) return;
    const next = [...list, n];
    setList(next);
    try { const extra = JSON.parse(localStorage.getItem('noa_familias_extra') || '[]'); localStorage.setItem('noa_familias_extra', JSON.stringify([...new Set([...extra, n])])); } catch {}
    setNueva('');
  }
  function remove(f) {
    const count = items.filter((i) => i.category === f).length;
    if (count > 0) { alert(`No puedes eliminar "${f}": tiene ${count} insumo(s). Reasígnalos primero.`); return; }
    setList(list.filter((x) => x !== f));
    try { const extra = JSON.parse(localStorage.getItem('noa_familias_extra') || '[]'); localStorage.setItem('noa_familias_extra', JSON.stringify(extra.filter((x) => x !== f))); } catch {}
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="font-sans">
        <DialogHeader><DialogTitle className="font-display text-noa-navy">Familias de insumos</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva familia (ej: Proteína animal)" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" onClick={add}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {list.map((f) => {
            const count = items.filter((i) => i.category === f).length;
            return (
              <div key={f} className="flex items-center justify-between px-3 py-2 rounded border bg-gray-50">
                <span className="text-sm">{f} <span className="text-gray-400 text-xs">({count})</span></span>
                <Button variant="ghost" size="icon" onClick={() => remove(f)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════ TAB 3: Facturas SII ═════════════
function firstOfMonthISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthsInRange(fromISO, toISO) {
  const from = new Date(fromISO + 'T00:00:00'), to = new Date(toISO + 'T00:00:00');
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];
  const months = []; const cur = new Date(from.getFullYear(), from.getMonth(), 1); const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) { months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 }); cur.setMonth(cur.getMonth() + 1); }
  return months;
}
async function fetchRcv(type, year, month) {
  const overrides = loadSiiOverrides(); const has = Object.keys(overrides).length > 0;
  const res = await fetch(`/__sii/rcv?type=${type}&year=${year}&month=${month}`, {
    method: has ? 'POST' : 'GET', headers: has ? { 'Content-Type': 'application/json' } : undefined, body: has ? JSON.stringify(overrides) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) { const d = json?.upstream ?? json?.error ?? `HTTP ${res.status}`; throw new Error(typeof d === 'string' ? d : JSON.stringify(d)); }
  return json;
}

function FacturasSII() {
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [af, setAf] = useState(from); const [at, setAt] = useState(to);
  const [search, setSearch] = useState('');
  const [view, setView] = useState({ kind: 'list' });

  const months = useMemo(() => monthsInRange(af, at), [af, at]);
  const queries = useQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: ['compras-rcv', year, month], queryFn: () => fetchRcv('compras', year, month),
      enabled: months.length > 0, retry: 0, staleTime: 5 * 60 * 1000,
    })),
  });
  const isLoading = queries.some((q) => q.isLoading || q.isFetching);
  const errors = queries.map((q, i) => q.error ? { ...months[i], error: q.error.message } : null).filter(Boolean);
  const rows = useMemo(() => {
    const all = [];
    queries.forEach((q, i) => (q.data?.data?.compras?.detalleCompras || []).forEach((d) => all.push({ ...d, __period: `${months[i].year}-${String(months[i].month).padStart(2, '0')}` })));
    return all;
  }, [queries, months]);
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => String(r.folio || '').toLowerCase().includes(q) || (r.razonSocial || '').toLowerCase().includes(q) || (r.rutProveedor || '').toLowerCase().includes(q));
  }, [rows, search]);

  if (view.kind === 'invoice') return <InvoiceDetail row={view.row} onBack={() => setView({ kind: 'list' })} onSupplier={(rut, name) => setView({ kind: 'supplier', rut, name })} />;
  if (view.kind === 'supplier') return <SupplierDetail rut={view.rut} name={view.name} allRows={rows} onBack={() => setView({ kind: 'list' })} onInvoice={(row) => setView({ kind: 'invoice', row })} />;

  return (
    <div className="space-y-4">
      <Card><CardContent className="pt-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label>Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div className="space-y-1"><Label>Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button onClick={() => { setAf(from); setAt(to); }} className="bg-noa-navy hover:bg-noa-navy-mid">Consultar</Button>
          <div className="flex-1 min-w-[200px] space-y-1"><Label>Buscar</Label>
            <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Folio, proveedor o RUT" className="pl-9" /></div>
          </div>
        </div>
      </CardContent></Card>

      <div className="flex items-center gap-3 text-sm text-gray-600">
        {isLoading && <><Loader2 className="w-4 h-4 animate-spin" /> Consultando…</>}
        {!isLoading && <><FileText className="w-4 h-4" /> {filtered.length} facturas</>}
      </div>

      {errors.length > 0 && <Alert variant="destructive"><AlertCircle className="w-4 h-4" /><AlertTitle>Errores</AlertTitle>
        <AlertDescription><ul className="list-disc pl-5 text-xs mt-1">{errors.map((e) => <li key={`${e.year}-${e.month}`}>{e.year}-{e.month}: {e.error}</li>)}</ul></AlertDescription></Alert>}

      {filtered.length > 0 && (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Folio</TableHead><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Proveedor</TableHead><TableHead className="text-right">Total bruto</TableHead><TableHead>Estado</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.slice(0, 300).map((r, i) => (
                <TableRow key={i} className="hover:bg-gray-50">
                  <TableCell><button className="text-noa-orange-dk font-medium hover:underline" onClick={() => setView({ kind: 'invoice', row: r })}>{r.folio}</button></TableCell>
                  <TableCell className="text-xs">{fdate(r.fechaEmision)}</TableCell>
                  <TableCell className="text-xs">{r.tipoDTEString || `DTE ${r.tipoDTE}`}</TableCell>
                  <TableCell><button className="text-noa-navy hover:underline text-left text-xs" onClick={() => setView({ kind: 'supplier', rut: r.rutProveedor, name: r.razonSocial })}>{r.razonSocial}<span className="block text-gray-400">{r.rutProveedor}</span></button></TableCell>
                  <TableCell className="text-right text-xs font-semibold">{clp(r.montoTotal)}</TableCell>
                  <TableCell><EstadoBadge estado={r.estado} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado }) {
  const e = (estado || '').toLowerCase();
  if (e.includes('confirm')) return <Badge className="bg-green-100 text-green-700 border-0">Confirmada</Badge>;
  if (e.includes('reclam')) return <Badge className="bg-red-100 text-red-700 border-0">Reclamada</Badge>;
  return <Badge variant="outline" className="text-xs">{estado || '—'}</Badge>;
}

function InvoiceDetail({ row, onBack, onSupplier }) {
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-noa-navy"><ArrowLeft className="w-4 h-4" /> Volver a facturas</button>
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-noa-navy flex items-center justify-center gap-2 font-display">{row.tipoDTEString || 'Factura Electrónica'} <FileText className="w-5 h-5 text-noa-orange" /></h1>
        <p className="text-lg font-semibold">Nº {row.folio} <EstadoBadge estado={row.estado} /></p>
        <p className="text-sm text-gray-500">Fecha de Emisión: {fdate(row.fechaEmision)}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="pt-5 space-y-1 text-sm">
          <p className="font-semibold text-gray-700 mb-2">Proveedor</p>
          <p><span className="text-gray-500">Razón social:</span> <button className="text-noa-navy hover:underline font-medium" onClick={() => onSupplier(row.rutProveedor, row.razonSocial)}>{row.razonSocial}</button></p>
          <p><span className="text-gray-500">RUT:</span> {row.rutProveedor}</p>
          <p><span className="text-gray-500">Tipo compra:</span> {row.tipoCompra || '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 space-y-1 text-sm">
          <p className="font-semibold text-gray-700 mb-2">Montos</p>
          <p className="flex justify-between"><span className="text-gray-500">Neto</span><span className="font-medium">{clp(row.montoNeto)}</span></p>
          <p className="flex justify-between"><span className="text-gray-500">Exento</span><span className="font-medium">{clp(row.montoExento)}</span></p>
          <p className="flex justify-between"><span className="text-gray-500">IVA</span><span className="font-medium">{clp(row.montoIvaRecuperable)}</span></p>
          <p className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">Total</span><span className="font-bold text-noa-navy">{clp(row.montoTotal)}</span></p>
        </CardContent></Card>
      </div>
    </div>
  );
}

function SupplierDetail({ rut, name, allRows, onBack, onInvoice }) {
  const supplierRows = useMemo(() => allRows.filter((r) => r.rutProveedor === rut), [allRows, rut]);
  const totalBruto = supplierRows.reduce((s, r) => s + (Number(r.montoTotal) || 0), 0);
  const chartData = useMemo(() => {
    const byDate = {};
    for (const r of supplierRows) { const d = (r.fechaEmision || '').slice(0, 10); if (d) byDate[d] = (byDate[d] || 0) + (Number(r.montoTotal) || 0); }
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).map(([f, total]) => ({ fecha: fdate(f), total }));
  }, [supplierRows]);
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-noa-navy"><ArrowLeft className="w-4 h-4" /> Volver</button>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-noa-navy/5"><Building2 className="w-6 h-6 text-noa-navy" /></div>
        <div><h1 className="text-xl font-bold text-noa-navy font-display">{name}</h1><p className="text-sm text-gray-500">RUT: {rut}</p></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MiniStat label="Facturas" value={supplierRows.length} />
        <MiniStat label="Total comprado" value={clp(totalBruto)} highlight />
      </div>
      {chartData.length > 1 && <Card><CardContent className="pt-6">
        <p className="text-sm font-semibold text-gray-700 mb-4">Total comprado en el tiempo</p>
        <ResponsiveContainer width="100%" height={260}><AreaChart data={chartData}>
          <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="fecha" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={clpK} /><Tooltip formatter={(v) => clp(v)} />
          <Area type="monotone" dataKey="total" stroke="#F59E0B" fill="url(#sg)" strokeWidth={2} />
        </AreaChart></ResponsiveContainer>
      </CardContent></Card>}
      <div className="overflow-x-auto border rounded-lg bg-white">
        <Table>
          <TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
          <TableBody>{supplierRows.map((r, i) => (
            <TableRow key={i}><TableCell><button className="text-noa-orange-dk font-medium hover:underline" onClick={() => onInvoice(r)}>{r.folio}</button></TableCell>
              <TableCell className="text-xs">{fdate(r.fechaEmision)}</TableCell><TableCell className="text-right text-xs font-semibold">{clp(r.montoTotal)}</TableCell><TableCell><EstadoBadge estado={r.estado} /></TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </div>
    </div>
  );
}

// ───────── shared ─────────
function MiniStat({ label, value, highlight }) {
  return (
    <Card className={highlight ? 'border-noa-orange/30 bg-noa-orange/5' : ''}>
      <CardContent className="pt-5">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-2xl font-bold font-display ${highlight ? 'text-noa-navy' : 'text-gray-900'}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
function EmptyData({ msg }) {
  return <div className="text-center py-12 text-gray-500"><Boxes className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">{msg}</p></div>;
}
