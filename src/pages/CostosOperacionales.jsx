import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Wallet, Loader2, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check, AlertTriangle,
} from 'lucide-react';

function clp(n) { return (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }); }
function fdate(v) { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString('es-CL'); }

// Centros de costo / familias de OpEx
const CENTROS = ['PAYROLL/RRHH', 'REAL STATE/RENTA', 'GASTOS FIJOS', 'ADMINISTRACIÓN', 'MARKETING', 'OTROS'];

// Colores corporativos NOA + paleta de apoyo por centro de costo
function CENTER_COLOR(name) {
  const n = (name || '').toUpperCase();
  if (n.includes('RRHH') || n.includes('PAYROLL')) return '#0C1B33'; // navy
  if (n.includes('RENTA') || n.includes('REAL STATE')) return '#F59E0B'; // naranja firma
  if (n.includes('GASTOS FIJOS') || n.includes('OPERAC')) return '#0EA5E9'; // info
  if (n.includes('ADMIN')) return '#16A34A'; // success
  if (n.includes('MARKETING')) return '#EC4899'; // rosa
  return '#64748B'; // slate
}
const TYPE_TO_CENTER = {
  payroll: 'PAYROLL/RRHH', rent: 'REAL STATE/RENTA', utilities: 'GASTOS FIJOS', insurance: 'GASTOS FIJOS',
  maintenance: 'ADMINISTRACIÓN', licenses: 'ADMINISTRACIÓN', technology: 'ADMINISTRACIÓN', marketing: 'MARKETING', other: 'OTROS',
};

export default function CostosOperacionales() {
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });
  const rid = user?.restaurant_ids?.[0];

  const { data: opex = [], isLoading } = useQuery({
    queryKey: ['costos-op', rid],
    queryFn: async () => {
      const all = rid ? await base44.entities.OpEx.filter({ restaurant_id: rid }) : await base44.entities.OpEx.list();
      return all || [];
    },
    enabled: true, staleTime: 60 * 1000,
  });

  // Ventas para % sobre venta
  const { data: sales = [] } = useQuery({
    queryKey: ['costos-op-sales', rid],
    queryFn: async () => {
      const all = rid ? await base44.entities.Sale.filter({ restaurant_id: rid }) : await base44.entities.Sale.list();
      return (all || []).filter((s) => !s.is_cancelled);
    },
    enabled: true, staleTime: 2 * 60 * 1000,
  });

  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState(null);

  const now = new Date();
  const ventaMes = useMemo(() => sales.filter((s) => { const d = new Date(s.date_time); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); }).reduce((a, s) => a + (Number(s.total_amount) || 0), 0), [sales]);

  // Agrupa OpEx por centro de costo
  const grupos = useMemo(() => {
    const map = {};
    for (const o of opex) {
      const center = o.cost_center_name || TYPE_TO_CENTER[o.type] || 'OTROS';
      if (!map[center]) map[center] = { name: center, total: 0, entries: [] };
      map[center].total += Number(o.amount) || 0;
      map[center].entries.push(o);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [opex]);

  const totalOpex = grupos.reduce((s, g) => s + g.total, 0);

  async function saveExpense(data) {
    const payload = {
      restaurant_id: rid, cost_center_name: data.center, type: 'other',
      amount: Number(data.amount) || 0, date: data.date, payment_status: data.payment_status,
      description: data.description, invoice_number: data.invoice_number || '',
    };
    if (data.id) await base44.entities.OpEx.update(data.id, payload);
    else await base44.entities.OpEx.create(payload);
    setForm(null);
    queryClient.invalidateQueries({ queryKey: ['costos-op'] });
  }
  async function removeExpense(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    await base44.entities.OpEx.delete(id);
    queryClient.invalidateQueries({ queryKey: ['costos-op'] });
  }

  if (isLoading) return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando costos…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-noa-navy flex items-center gap-2 font-display"><Wallet className="w-6 h-6 text-noa-orange" /> Costos Operacionales</h1>
          <p className="text-gray-600 mt-1">Gastos por centro de costo. Pincha una familia para ver sus facturas.</p>
        </div>
        <Button className="bg-noa-navy hover:bg-noa-navy-mid" onClick={() => setForm({ center: CENTROS[0], amount: '', date: new Date().toISOString().slice(0, 10), payment_status: 'pagado', description: '', invoice_number: '' })}>
          <Plus className="w-4 h-4 mr-1.5" /> Agregar gasto manual
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MiniStat label="Total costos operacionales" value={clp(totalOpex)} highlight />
        <MiniStat label="Centros de costo" value={grupos.length} />
        <MiniStat label="% sobre venta del mes" value={ventaMes > 0 ? `${(totalOpex / ventaMes * 100).toFixed(0)}%` : '—'} />
      </div>

      {grupos.length === 0 ? (
        <div className="text-center py-12 text-gray-500"><Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">No hay costos registrados. Agrega uno con "Agregar gasto manual".</p></div>
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Centro de costo / Familia</TableHead>
              <TableHead className="text-right">Facturas</TableHead>
              <TableHead className="text-right">% sobre venta</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {grupos.map((g) => {
                const isOpen = expanded[g.name];
                const pctVenta = ventaMes > 0 ? g.total / ventaMes * 100 : 0;
                const color = CENTER_COLOR(g.name);
                return (
                  <React.Fragment key={g.name}>
                    <TableRow className="cursor-pointer transition-colors" style={{ background: isOpen ? `${color}10` : undefined }} onClick={() => setExpanded((e) => ({ ...e, [g.name]: !e[g.name] }))}>
                      <TableCell className="font-medium" style={{ borderLeft: `4px solid ${color}` }}>
                        <span className="inline-flex items-center gap-1.5 text-noa-navy">
                          {isOpen ? <ChevronDown className="w-4 h-4" style={{ color }} /> : <ChevronRight className="w-4 h-4" style={{ color }} />}
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          {g.name} <span className="text-gray-400 text-xs">({g.entries.length})</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">{g.entries.length}</TableCell>
                      <TableCell className="text-right text-xs font-semibold" style={{ color }}>{pctVenta.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-xs font-bold" style={{ color }}>{clp(g.total)}</TableCell>
                    </TableRow>
                    {isOpen && g.entries.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((o) => (
                      <TableRow key={o.id} className="bg-gray-50/50">
                        <TableCell className="pl-10 text-xs text-gray-700">
                          {o.description || o.invoice_number || 'Gasto'} <span className="text-gray-400">· {fdate(o.date)}</span>
                          {o.payment_status && <Badge variant="outline" className="ml-2 text-[10px]">{o.payment_status}</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 text-right">{o.invoice_number || '—'}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs font-medium">{clp(o.amount)}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setForm({ id: o.id, center: o.cost_center_name || 'OTROS', amount: o.amount, date: (o.date || '').slice(0, 10), payment_status: o.payment_status || 'pagado', description: o.description || '', invoice_number: o.invoice_number || '' }); }}><Pencil className="w-3.5 h-3.5 text-gray-500" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removeExpense(o.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {form && (
        <Dialog open onOpenChange={() => setForm(null)}>
          <DialogContent className="font-sans">
            <DialogHeader><DialogTitle className="font-display text-noa-navy">{form.id ? 'Editar gasto' : 'Agregar gasto manual'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Centro de costo / Familia</Label>
                <Select value={form.center} onValueChange={(v) => setForm((f) => ({ ...f, center: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CENTROS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Monto</Label><Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Fecha</Label><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>N° documento (opcional)</Label><Input value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Estado de pago</Label>
                  <Select value={form.payment_status} onValueChange={(v) => setForm((f) => ({ ...f, payment_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="pagado">Pagado</SelectItem><SelectItem value="pendiente">Pendiente</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ej: Arriendo local junio" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
              <Button className="bg-noa-navy hover:bg-noa-navy-mid" onClick={() => saveExpense(form)}><Check className="w-4 h-4 mr-1.5" /> Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

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
