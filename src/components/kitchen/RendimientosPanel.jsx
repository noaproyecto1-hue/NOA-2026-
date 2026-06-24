import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Download, Pencil, Trash2, Check, Gauge } from 'lucide-react';

// ── Módulo Rendimientos (Prompt 15) — antes "VUM" (Prompt 14) ──
// Dashboard editable que transforma la hoja de cálculo en una vista interactiva.
// VUM = Valor Neto ÷ Cantidad Útil. Valor Neto = Valor Bruto ÷ 1.19 (calculado).
// Cant. Útil = Cantidad × (1 − Merma%) × (1 − Reducción%) (calculado).

const CATEGORIAS = [
  'Proteínas', 'Frutas y Verduras', 'Especias', 'Harina y Granos', 'Lácteos',
  'Chocolates y Salsas', 'Pan y Papas', 'Aceites y Salsas', 'Syrup y Chai', 'Packaging', 'Helados',
];

const clp = (n) => (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const num = (n, d = 2) => (Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: d });

function mapCategoria(raw) {
  const c = (raw || '').toLowerCase();
  for (const cat of CATEGORIAS) if (c === cat.toLowerCase()) return cat;
  if (/(prote|carne|pollo|pescado|res|cerdo|salm)/.test(c)) return 'Proteínas';
  if (/(fruta|verdura|vegetal|tomate)/.test(c)) return 'Frutas y Verduras';
  if (/(especia|condimento|sal\b|pimienta)/.test(c)) return 'Especias';
  if (/(harina|grano|arroz|fideo|legumbre)/.test(c)) return 'Harina y Granos';
  if (/(l[áa]cteo|leche|queso|crema|mantequilla|huevo)/.test(c)) return 'Lácteos';
  if (/(chocolate|salsa|cacao)/.test(c)) return 'Chocolates y Salsas';
  if (/(pan|papa)/.test(c)) return 'Pan y Papas';
  if (/(aceite|oliva)/.test(c)) return 'Aceites y Salsas';
  if (/(syrup|chai|jarabe)/.test(c)) return 'Syrup y Chai';
  if (/(packaging|envase|empaque)/.test(c)) return 'Packaging';
  if (/(helado|gelato)/.test(c)) return 'Helados';
  return 'Especias';
}

function loadRend(supplyItems) {
  try {
    const stored = JSON.parse(localStorage.getItem('noa_rendimientos') || 'null');
    if (stored && stored.length) return stored;
  } catch {}
  // Semilla desde insumos existentes
  return (supplyItems || []).slice(0, 60).map((s, i) => ({
    id: s.id || `rend-${i}`,
    name: s.name || 'Insumo',
    brand: s.brand || '',
    supplier: s.supplier || '',
    buyForm: s.unit || 'unidad',
    cantidad: Number(s.package_qty) || 1,
    unidad: s.unit || 'kg',
    valorBruto: Number(s.cost_per_unit) || 0,
    merma: 0,
    reduccion: 0,
    category: mapCategoria(s.category),
  }));
}
function saveRend(rows) { try { localStorage.setItem('noa_rendimientos', JSON.stringify(rows)); } catch {} }

// Cálculos derivados
function calc(r) {
  const valorNeto = (Number(r.valorBruto) || 0) / 1.19;
  const cantUtil = (Number(r.cantidad) || 0) * (1 - (Number(r.merma) || 0) / 100) * (1 - (Number(r.reduccion) || 0) / 100);
  let vum = 0, estado = null;
  if (valorNeto === 0) estado = { label: 'Sin precio', cls: 'bg-gray-100 text-gray-500' };
  else if (cantUtil === 0) estado = { label: 'Sin rendimiento', cls: 'bg-red-100 text-red-700' };
  else { vum = valorNeto / cantUtil; if (!Number.isFinite(vum)) estado = { label: 'Completar datos', cls: 'bg-orange-100 text-orange-700' }; }
  return { valorNeto, cantUtil, vum, estado };
}

export default function RendimientosPanel({ supplyItems = [] }) {
  const [rows, setRows] = useState(() => loadRend(supplyItems));
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState(null);

  function persist(next) { setRows(next); saveRend(next); }
  function updateCell(id, field, value) {
    persist(rows.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }
  function remove(r) {
    if (!confirm(`¿Eliminar el insumo "${r.name}"?`)) return;
    persist(rows.filter((x) => x.id !== r.id));
  }
  function saveEdit(form) {
    if (form.id) persist(rows.map((r) => r.id === form.id ? form : r));
    else persist([{ ...form, id: `rend-${Date.now()}` }, ...rows]);
    setEditing(null);
  }

  const filtered = useMemo(() => rows.filter((r) => {
    const mc = cat === 'all' || r.category === cat;
    const q = search.trim().toLowerCase();
    const ms = !q || (r.name || '').toLowerCase().includes(q) || (r.brand || '').toLowerCase().includes(q) || (r.supplier || '').toLowerCase().includes(q);
    return mc && ms;
  }), [rows, cat, search]);

  function exportCSV() {
    const head = ['Nombre', 'Categoría', 'Marca', 'Proveedor', 'Forma compra', 'Cantidad', 'Unidad', 'Valor Bruto', 'Valor Neto', 'Merma %', 'Reducción %', 'Cant. Útil', 'VUM'];
    const lines = [head.join(';')];
    for (const r of rows) {
      const c = calc(r);
      lines.push([r.name, r.category, r.brand, r.supplier, r.buyForm, r.cantidad, r.unidad, Math.round(r.valorBruto), Math.round(c.valorNeto), r.merma, r.reduccion, num(c.cantUtil), num(c.vum)].join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Rendimientos-NOA.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const EditNum = ({ r, field, suffix }) => (
    <input
      type="number"
      defaultValue={r[field]}
      onBlur={(e) => updateCell(r.id, field, Number(e.target.value) || 0)}
      className="w-16 bg-transparent text-right text-xs border-b border-transparent hover:border-gray-300 focus:border-noa-navy focus:outline-none"
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre, marca o proveedor" className="pl-9 w-64" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1.5" /> Exportar</Button>
          <Button size="sm" className="bg-noa-navy hover:bg-noa-navy-mid" onClick={() => setEditing({ id: '', name: '', brand: '', supplier: '', buyForm: '', cantidad: 1, unidad: 'kg', valorBruto: 0, merma: 0, reduccion: 0, category: CATEGORIAS[0] })}>
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo insumo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Insumos" value={rows.length} />
        <Stat label="Resultados" value={filtered.length} highlight />
        <Stat label="Categorías" value={new Set(rows.map((r) => r.category)).size} />
        <Stat label="Con alerta" value={rows.filter((r) => calc(r).estado).length} />
      </div>

      <div className="overflow-x-auto border rounded-lg bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="py-2 px-3">Nombre</th><th className="py-2 px-3">Categoría</th>
              <th className="py-2 px-3">Marca / Proveedor</th>
              <th className="py-2 px-3 text-right">Cant.</th><th className="py-2 px-3">Unidad</th>
              <th className="py-2 px-3 text-right">V. Bruto</th><th className="py-2 px-3 text-right">V. Neto</th>
              <th className="py-2 px-3 text-right">Merma%</th><th className="py-2 px-3 text-right">Reduc.%</th>
              <th className="py-2 px-3 text-right">Cant. Útil</th>
              <th className="py-2 px-3 text-right">VUM</th>
              <th className="py-2 px-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => {
              const c = calc(r);
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="py-1.5 px-3 font-medium text-noa-navy">{r.name}</td>
                  <td className="py-1.5 px-3"><Badge variant="outline" className="text-[10px]">{r.category}</Badge></td>
                  <td className="py-1.5 px-3 text-gray-600">{r.brand || '—'}{r.supplier ? ` · ${r.supplier}` : ''}</td>
                  <td className="py-1.5 px-3 text-right"><EditNum r={r} field="cantidad" /></td>
                  <td className="py-1.5 px-3 text-gray-600">{r.unidad}</td>
                  <td className="py-1.5 px-3 text-right"><EditNum r={r} field="valorBruto" /></td>
                  <td className="py-1.5 px-3 text-right text-gray-500">{clp(c.valorNeto)}</td>
                  <td className="py-1.5 px-3 text-right"><EditNum r={r} field="merma" /></td>
                  <td className="py-1.5 px-3 text-right"><EditNum r={r} field="reduccion" /></td>
                  <td className="py-1.5 px-3 text-right text-gray-700">{num(c.cantUtil)}</td>
                  <td className="py-1.5 px-3 text-right font-bold" style={{ color: '#2563EB' }}>
                    {c.estado ? <Badge className={`text-[10px] ${c.estado.cls}`}>{c.estado.label}</Badge> : clp(c.vum)}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <div className="inline-flex gap-1">
                      <button onClick={() => setEditing(r)} className="text-gray-400 hover:text-noa-navy" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(r)} className="text-gray-400 hover:text-red-500" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="text-center text-gray-400 py-8">
                <Gauge className="w-8 h-8 mx-auto mb-2 opacity-40" />No hay insumos. Crea el primero con "Nuevo insumo".
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span>VUM destacado en azul = Valor Neto ÷ Cant. Útil.</span>
        <span className="inline-flex items-center gap-1"><Badge className="bg-red-100 text-red-700 text-[10px]">Sin rendimiento</Badge> Cant. Útil = 0</span>
        <span className="inline-flex items-center gap-1"><Badge className="bg-gray-100 text-gray-500 text-[10px]">Sin precio</Badge> Valor Neto = 0</span>
      </div>

      {editing && <EditRendDialog form={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-noa-orange/30 bg-noa-orange/5' : 'bg-white'}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-xl font-bold font-display ${highlight ? 'text-noa-navy' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function EditRendDialog({ form, onClose, onSave }) {
  const [f, setF] = useState(form);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const c = calc(f);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="font-sans max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-noa-navy">{form.id ? 'Editar insumo' : 'Nuevo insumo'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><label className="text-sm text-gray-600">Nombre</label>
            <Input value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Categoría</label>
            <Select value={f.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Unidad</label>
            <Input value={f.unidad} onChange={(e) => set('unidad', e.target.value)} /></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Marca</label>
            <Input value={f.brand} onChange={(e) => set('brand', e.target.value)} /></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Proveedor</label>
            <Input value={f.supplier} onChange={(e) => set('supplier', e.target.value)} /></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Cantidad</label>
            <Input type="number" value={f.cantidad} onChange={(e) => set('cantidad', Number(e.target.value) || 0)} /></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Valor Bruto (con IVA)</label>
            <Input type="number" value={f.valorBruto} onChange={(e) => set('valorBruto', Number(e.target.value) || 0)} /></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Merma %</label>
            <Input type="number" value={f.merma} onChange={(e) => set('merma', Number(e.target.value) || 0)} /></div>
          <div className="space-y-1"><label className="text-sm text-gray-600">Reducción %</label>
            <Input type="number" value={f.reduccion} onChange={(e) => set('reduccion', Number(e.target.value) || 0)} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3 text-center">
          <div><p className="text-[10px] text-gray-500">Valor Neto</p><p className="text-sm font-semibold">{clp(c.valorNeto)}</p></div>
          <div><p className="text-[10px] text-gray-500">Cant. Útil</p><p className="text-sm font-semibold">{num(c.cantUtil)}</p></div>
          <div><p className="text-[10px] text-gray-500">VUM</p><p className="text-sm font-bold" style={{ color: '#2563EB' }}>{c.estado ? c.estado.label : clp(c.vum)}</p></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-noa-navy hover:bg-noa-navy-mid" disabled={!f.name.trim()} onClick={() => onSave(f)}><Check className="w-4 h-4 mr-1.5" /> Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
