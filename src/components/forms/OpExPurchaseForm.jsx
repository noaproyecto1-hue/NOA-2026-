import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Building2, DollarSign, CreditCard } from "lucide-react";
import { formatCurrency, getCurrencySymbol } from '@/components/utils/currencyHelper';
import SupplierSearchInput from '@/components/suppliers/SupplierSearchInput';

export default function OpExPurchaseForm({
  defaultValues = {},
  restaurant,
  suppliers = [],
  currency = 'USD',
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false
}) {
  const [form, setForm] = useState({
    restaurant_id: defaultValues.restaurant_id || '',
    date: defaultValues.date || new Date().toISOString().split('T')[0],
    type: defaultValues.type || 'other',
    cost_center_name: defaultValues.cost_center_name || '',
    category: defaultValues.category || '',
    description: defaultValues.description || '',
    supplier: defaultValues.supplier || '',
    supplier_tax_id: defaultValues.supplier_tax_id || '',
    invoice_number: defaultValues.invoice_number || '',
    subtotal: defaultValues.subtotal || '',
    is_tax_exempt: defaultValues.is_tax_exempt || false,
    payment_status: defaultValues.payment_status || 'pagado',
    payment_date: defaultValues.payment_date || defaultValues.date || new Date().toISOString().split('T')[0],
    payment_due_date: defaultValues.payment_due_date || '',
  });

  const config = restaurant?.config || {};
  const taxRate = form.is_tax_exempt ? 0 : (config.default_tax_rate || 19);

  // Centros de costo OPEX
  const opexCostCenters = useMemo(() =>
    (config.cost_centers || []).filter(c => c.type === 'opex'),
    [config]
  );

  // Categorías del centro seleccionado
  const selectedCenter = useMemo(() =>
    opexCostCenters.find(c => c.name === form.cost_center_name),
    [opexCostCenters, form.cost_center_name]
  );
  const centerCategories = selectedCenter?.categories || [];

  // Cálculos
  const subtotal = parseFloat(form.subtotal) || 0;
  const taxAmount = form.is_tax_exempt ? 0 : Math.round(subtotal * (taxRate / 100));
  const totalAmount = subtotal + taxAmount;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const sym = getCurrencySymbol(currency);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.cost_center_name) return;
    onSubmit({
      ...form,
      type: form.type || 'other',
      subtotal,
      payment_due_date: form.payment_due_date || '',
      _editType: 'opex'
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      {/* Sección 1: Centro de costo */}
      <div className="space-y-3 pb-4">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Centro de costo
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Centro de Costo *</Label>
            <Select value={form.cost_center_name} onValueChange={v => { set('cost_center_name', v); set('category', ''); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {opexCostCenters.length > 0 
                  ? opexCostCenters.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)
                  : ['Alquiler','Servicios','Nómina','Marketing','Mantenimiento','Tecnología','Otros'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </div>
          {centerCategories.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Categoría</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Subcategoría" /></SelectTrigger>
                <SelectContent>
                  {centerCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Fecha gasto *</Label>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="h-9 text-sm" required style={{ fontVariantNumeric: 'tabular-nums' }} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Descripción</Label>
          <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detalle del gasto" rows={2} className="text-sm resize-none" />
        </div>
      </div>

      {/* Sección 2: Montos */}
      <div className="space-y-3 py-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" /> Montos
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Monto Neto (sin IVA) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{sym}</span>
              <Input type="number" step="0.01" value={form.subtotal} onChange={e => set('subtotal', e.target.value)} placeholder="0" className="h-9 text-sm pl-10" required />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={form.is_tax_exempt} onCheckedChange={v => set('is_tax_exempt', v)} />
            <span className="text-xs text-gray-500 pb-1">Exento IVA</span>
          </div>
        </div>

        {/* Resumen calculado */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Neto</p>
              <p className="text-sm font-bold text-gray-800">{formatCurrency(subtotal, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">IVA ({taxRate}%)</p>
              <p className="text-sm font-bold text-blue-600">{formatCurrency(taxAmount, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total</p>
              <p className="text-sm font-extrabold text-gray-900">{formatCurrency(totalAmount, currency)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 3: Proveedor y Pago */}
      <div className="space-y-3 py-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" /> Proveedor y pago
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Proveedor</Label>
            <SupplierSearchInput
              suppliers={suppliers}
              value={form.supplier}
              taxIdValue={form.supplier_tax_id}
              onChange={(v) => set('supplier', v)}
              onTaxIdChange={(v) => set('supplier_tax_id', v)}
              onSupplierSelect={(supplier) => {
                if (supplier.payment_terms === '15_dias' || supplier.payment_terms === '30_dias' || supplier.payment_terms === '60_dias') {
                  set('payment_status', 'pendiente');
                }
                // Auto-rellenar centro de costo y categoría desde las opex_categories del proveedor
                if (supplier.opex_categories?.length > 0) {
                  const opexCats = supplier.opex_categories;
                  // Si ya hay categoría escrita, buscar match con opex_categories del proveedor
                  const currentCat = (form.category || '').toLowerCase().trim();
                  let pick = null;
                  if (currentCat) {
                    pick = opexCats.find(oc => (oc.category || '').toLowerCase().trim() === currentCat)
                      || opexCats.find(oc => (oc.category || '').toLowerCase().includes(currentCat) || currentCat.includes((oc.category || '').toLowerCase()));
                  }
                  if (!pick) pick = opexCats[0];
                  
                  if (pick.cost_center) {
                    setForm(f => ({
                      ...f,
                      cost_center_name: pick.cost_center,
                      category: pick.category || f.category
                    }));
                  }
                }
              }}
              placeholder="Buscar proveedor..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">RUT Proveedor</Label>
            <Input value={form.supplier_tax_id} onChange={e => set('supplier_tax_id', e.target.value)} placeholder="12.345.678-9" className="h-9 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">No. Factura</Label>
            <Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="Factura" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Estado *</Label>
            <Select value={form.payment_status} onValueChange={v => {
              set('payment_status', v);
              if (v === 'pagado' && !form.payment_date) set('payment_date', form.date);
            }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagado">✅ Pagado</SelectItem>
                <SelectItem value="pendiente">⏳ Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-gray-500">
              {form.payment_status === 'pagado' ? 'Fecha pago' : 'Fecha vencimiento'}
            </Label>
            {form.payment_status === 'pagado' ? (
              <Input 
                type="date" 
                value={form.payment_date} 
                onChange={e => set('payment_date', e.target.value)} 
                className="h-9 text-sm"
                min={form.date}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            ) : (
              <Input 
                type="date" 
                value={form.payment_due_date} 
                onChange={e => set('payment_due_date', e.target.value)} 
                className="h-9 text-sm"
                min={form.date}
                placeholder="Fecha de vencimiento"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            )}
          </div>
        </div>
        
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-10 text-sm">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="flex-1 h-10 text-sm bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md">
          {isLoading ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Guardando...</> : (isEditing ? 'Actualizar Gasto' : 'Registrar Gasto')}
        </Button>
      </div>
    </form>
  );
}