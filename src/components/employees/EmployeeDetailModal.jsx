import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, DollarSign, FileText, Pencil, Save, X, BarChart3, TrendingUp, Coins, ShoppingCart, Loader2, Calendar } from 'lucide-react';
import { formatCurrency } from '@/components/utils/currencyHelper';
import { format } from 'date-fns';

const roleLabels = {
  waiter: 'Mesero/a', chef: 'Chef / Cocinero', bartender: 'Bartender',
  cashier: 'Cajero/a', host: 'Host / Recepción', manager: 'Gerente',
  assistant: 'Auxiliar', delivery: 'Repartidor', cleaning: 'Limpieza', other: 'Otro'
};

const roleColors = {
  waiter: 'bg-blue-100 text-blue-700', chef: 'bg-amber-100 text-amber-700',
  bartender: 'bg-purple-100 text-purple-700', cashier: 'bg-green-100 text-green-700',
  host: 'bg-pink-100 text-pink-700', manager: 'bg-red-100 text-red-700',
  assistant: 'bg-gray-100 text-gray-700', delivery: 'bg-orange-100 text-orange-700',
  cleaning: 'bg-teal-100 text-teal-700', other: 'bg-slate-100 text-slate-700'
};

const monthLabels = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic'
};

export default function EmployeeDetailModal({ open, onOpenChange, employee, restaurantIds, currency, onSave, classificationMode, employeeAreas }) {
  const isAreaMode = classificationMode === 'areas';
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');
  const [notes, setNotes] = useState('');
  const [role, setRole] = useState('other');
  const [area, setArea] = useState('');

  React.useEffect(() => {
    if (employee) {
      setPhone(employee.phone || '');
      setSalary(employee.salary || '');
      setNotes(employee.notes || '');
      setRole(employee.role || 'other');
      setArea(employee.area || '');
      setEditing(false);
    }
  }, [employee]);

  // Fetch sales directly for this employee — no backend function needed
  const targetRestaurantIds = restaurantIds?.length ? restaurantIds : (employee?.restaurant_id ? [employee.restaurant_id] : []);
  
  const { data: employeeSales, isLoading: perfLoading } = useQuery({
    queryKey: ['employeeDetailSales', employee?.name, targetRestaurantIds],
    queryFn: async () => {
      const sales = [];
      for (const rid of targetRestaurantIds) {
        const batch = await base44.entities.Sale.filter(
          { restaurant_id: rid, is_cancelled: false, waiter_name: employee.name },
          '-date_time', 2000
        );
        sales.push(...batch);
      }
      return sales;
    },
    enabled: !!employee?.name && open && targetRestaurantIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const stats = useMemo(() => {
    if (!employeeSales?.length) return null;
    const months = {};
    let sales = 0, tips = 0, transactions = 0, guests = 0;
    
    for (const s of employeeSales) {
      const amt = s.total_amount || 0;
      const tip = s.tip_amount || 0;
      sales += amt;
      tips += tip;
      transactions += 1;
      guests += (s.num_guests || 0);
      
      const dt = s.date_time || s.created_date;
      if (dt) {
        const mk = dt.substring(0, 7);
        if (!months[mk]) months[mk] = { month: mk, sales: 0, tips: 0, transactions: 0, guests: 0 };
        months[mk].sales += amt;
        months[mk].tips += tip;
        months[mk].transactions += 1;
        months[mk].guests += (s.num_guests || 0);
      }
    }
    
    return {
      sales, tips, transactions, guests,
      avgTicket: transactions > 0 ? Math.round(sales / transactions) : 0,
      tipPct: sales > 0 ? Math.round((tips / sales) * 1000) / 10 : 0,
      monthly: Object.values(months)
        .map(m => ({ ...m, avgTicket: m.transactions > 0 ? Math.round(m.sales / m.transactions) : 0 }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  }, [employeeSales]);

  if (!employee) return null;

  const handleSave = () => {
    onSave({
      ...employee,
      role, area, phone,
      salary: salary ? Number(salary) : undefined,
      notes
    });
    setEditing(false);
  };

  const formatMonth = (m) => {
    const [year, month] = m.split('-');
    return `${monthLabels[month] || month} ${year}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
              {employee.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold">{employee.name}</p>
              {editing ? (
                isAreaMode ? (
                  <Select value={area} onValueChange={setArea}>
                    <SelectTrigger className="h-7 text-xs w-44 mt-1"><SelectValue placeholder="Seleccionar área..." /></SelectTrigger>
                    <SelectContent>
                      {(employeeAreas || []).map((a) => (
                        <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-7 text-xs w-44 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              ) : (
                <Badge className={`${isAreaMode ? 'bg-teal-100 text-teal-700' : (roleColors[role] || roleColors.other)} border-0 text-xs mt-0.5`}>
                  {isAreaMode ? (area || 'Sin área') : (roleLabels[role] || role)}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Performance Stats */}
          {perfLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="ml-2 text-xs text-gray-400">Cargando historial...</span>
            </div>
          )}

          {!perfLoading && stats && stats.transactions > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] text-blue-600 font-medium">Ventas Totales</span>
                  </div>
                  <p className="font-bold text-blue-800 text-sm">{formatCurrency(stats.sales, currency)}</p>
                  <p className="text-[10px] text-blue-500">{stats.transactions} transacciones</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Coins className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] text-emerald-600 font-medium">Propinas Totales</span>
                  </div>
                  <p className="font-bold text-emerald-800 text-sm">{formatCurrency(stats.tips, currency)}</p>
                  <p className="text-[10px] text-emerald-500">{stats.tipPct.toFixed(1)}% sobre ventas</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] text-amber-600 font-medium">Ticket Promedio</span>
                  </div>
                  <p className="font-bold text-amber-800 text-sm">{formatCurrency(stats.avgTicket, currency)}</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-[10px] text-purple-600 font-medium">Transacciones</span>
                  </div>
                  <p className="font-bold text-purple-800 text-sm">{stats.transactions}</p>
                </div>
              </div>

              {/* Monthly History */}
              {stats.monthly?.length > 0 && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-bold text-gray-600 uppercase">Historial Mensual</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b bg-gray-50/50">
                          <th className="text-left py-2 px-4">Mes</th>
                          <th className="text-right py-2 px-3">Ventas</th>
                          <th className="text-right py-2 px-3">Txns</th>
                          <th className="text-right py-2 px-3">Ticket</th>
                          <th className="text-right py-2 px-3">Propinas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.monthly.map(m => (
                          <tr key={m.month} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                            <td className="py-2 px-4 font-medium text-gray-700">{formatMonth(m.month)}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(m.sales, currency)}</td>
                            <td className="text-right py-2 px-3 text-gray-500">{m.transactions}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(m.avgTicket, currency)}</td>
                            <td className="text-right py-2 px-3 text-emerald-600">{formatCurrency(m.tips, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {!perfLoading && (!stats || stats.transactions === 0) && (
            <div className="text-center py-4 text-gray-400 text-sm bg-gray-50 rounded-xl">
              No hay historial de ventas para este empleado
            </div>
          )}

          {/* Info fields */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Información del Empleado</span>
              {!editing ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-xs gap-1">
                  <Pencil className="w-3 h-3" /> Editar
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="text-xs gap-1">
                    <X className="w-3 h-3" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700">
                    <Save className="w-3 h-3" /> Guardar
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Phone className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-gray-500">Teléfono</Label>
                {editing ? (
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ej: +56 9 1234 5678" className="mt-1 h-8 text-sm" />
                ) : (
                  <p className="text-sm text-gray-900">{phone || <span className="text-gray-400 italic">No registrado</span>}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <DollarSign className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-gray-500">Salario Mensual</Label>
                {editing ? (
                  <Input type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="Ej: 500000" className="mt-1 h-8 text-sm" />
                ) : (
                  <p className="text-sm text-gray-900">
                    {salary ? formatCurrency(Number(salary), currency) : <span className="text-gray-400 italic">No registrado</span>}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-gray-500">Notas / Experiencia</Label>
                {editing ? (
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: 5 años de experiencia, manejo de barra..." className="mt-1 text-sm min-h-[60px]" />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {notes || <span className="text-gray-400 italic">Sin notas</span>}
                  </p>
                )}
              </div>
            </div>
          </div>

          {employee.restaurant_name && (
            <div className="text-xs text-gray-400 text-right pt-2 border-t">
              Restaurante: {employee.restaurant_name}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}