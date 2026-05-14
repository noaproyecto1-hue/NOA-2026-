import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, DollarSign, ShoppingCart } from "lucide-react";
import { formatCurrency, getCurrencySymbol } from '@/components/utils/currencyHelper';
import SupplierSearchInput from '@/components/suppliers/SupplierSearchInput';
import SupplyStockItems from './SupplyStockItems';
import { getCategoryNames } from '@/components/utils/supplyCategoryHelper';

export default function SupplyPurchaseForm({
  defaultValues = {},
  restaurant,
  supplyItems = [],
  suppliers = [],
  currency = 'USD',
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false
}) {
  // Inicializar stock items desde defaultValues
  const initStockItems = () => {
    // Si tiene invoice_items guardados (factura multi-item), usarlos
    if (defaultValues.invoice_items && defaultValues.invoice_items.length > 0) {
      return defaultValues.invoice_items.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const sub = parseFloat(item.subtotal) || 0;
        const up = qty > 0 && sub > 0 ? Math.round((sub / qty) * 100) / 100 : 0;
        return {
          name: item.name || '',
          quantity: qty,
          received_quantity: item.received_quantity != null ? parseFloat(item.received_quantity) : null,
          unit: item.unit || 'kg',
          subtotal: sub,
          unit_price: up,
          category: item.category || '',
        };
      });
    }
    // Si tiene un solo insumo con nombre, mostrarlo como item
    if (defaultValues.supply_item_name && defaultValues.quantity_purchased > 0) {
      const qty = parseFloat(defaultValues.quantity_purchased) || 0;
      const sub = parseFloat(defaultValues.subtotal) || 0;
      const up = qty > 0 && sub > 0 ? Math.round((sub / qty) * 100) / 100 : 0;
      return [{
        name: defaultValues.supply_item_name,
        quantity: qty,
        received_quantity: defaultValues.quantity_received != null ? parseFloat(defaultValues.quantity_received) : null,
        unit: defaultValues.unit_of_measure || 'kg',
        subtotal: sub,
        unit_price: up,
        category: defaultValues.supply_category || '',
      }];
    }
    return [];
  };

  const [stockItems, setStockItems] = useState(initStockItems);

  // Auto-calcular subtotal desde los items de stock
  const handleStockItemsChange = (newItems) => {
    setStockItems(newItems);
    // Sumar subtotales de items (qty * unit_price) con precisión de 2 decimales
    const itemsTotal = newItems.reduce((sum, si) => {
      const qty = parseFloat(si.quantity) || 0;
      const up = parseFloat(si.unit_price) || 0;
      return sum + parseFloat((qty * up).toFixed(2));
    }, 0);
    if (itemsTotal > 0) {
      setForm(f => ({ ...f, subtotal: itemsTotal }));
    }
  };

  const [form, setForm] = useState({
    restaurant_id: defaultValues.restaurant_id || '',
    date: defaultValues.date || new Date().toISOString().split('T')[0],
    supply_category: defaultValues.supply_category || '',
    supply_item_name: defaultValues.supply_item_name || '',
    quantity_purchased: defaultValues.quantity_purchased || '',
    unit_of_measure: defaultValues.unit_of_measure || 'kg',
    subtotal: defaultValues.subtotal || '',
    manual_unit_price: defaultValues.manual_unit_price || '',
    is_tax_exempt: defaultValues.is_tax_exempt || false,
    supplier: defaultValues.supplier || '',
    supplier_tax_id: defaultValues.supplier_tax_id || '',
    invoice_number: defaultValues.invoice_number || '',
    payment_status: defaultValues.payment_status || 'pagado',
    payment_date: defaultValues.payment_date || defaultValues.date || new Date().toISOString().split('T')[0],
    notes: defaultValues.notes || '',
    supply_type: defaultValues.supply_type || 'ingredients',
  });
  
  const config = restaurant?.config || {};
  const supplyCategories = getCategoryNames(config.supply_categories || []);
  const taxRate = form.is_tax_exempt ? 0 : (config.default_tax_rate || 19);

  // Cálculos en tiempo real
  const subtotal = parseFloat(form.subtotal) || 0;
  const taxAmount = form.is_tax_exempt ? 0 : Math.round(subtotal * (taxRate / 100));
  const totalCost = subtotal + taxAmount;


  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validStockItems = stockItems.filter(si => si.name && si.quantity > 0);
    
    // Si hay exactamente 1 stock item, usarlo como item principal
    const singleItem = validStockItems.length === 1 ? validStockItems[0] : null;

    // Build mapped items for persistence on the entity
    const mappedItems = validStockItems.map(si => ({
      name: si.name,
      quantity: si.quantity,
      received_quantity: si.received_quantity != null ? si.received_quantity : si.quantity,
      unit: si.unit || 'kg',
      subtotal: si.subtotal || 0,
      category: si.category || form.supply_category || '',
    }));

    // Auto-derive supply_category from stock items (prefer item category over form)
    const derivedCategory = (validStockItems.length > 0 && validStockItems[0].category) 
      ? validStockItems[0].category 
      : (form.supply_category || '');

    onSubmit({
      ...form,
      supply_category: derivedCategory,
      subtotal,
      // Si hay un solo item de stock, usar sus datos como item principal
      supply_item_name: singleItem ? singleItem.name : '',
      quantity_purchased: singleItem ? singleItem.quantity : 0,
      quantity_received: singleItem ? (singleItem.received_quantity != null ? singleItem.received_quantity : singleItem.quantity) : 0,
      unit_of_measure: singleItem ? (singleItem.unit || 'kg') : (form.unit_of_measure || 'unidad'),
      // Persist items on the entity for later editing
      invoice_items: mappedItems.length > 0 ? mappedItems : null,
      // Pass items for stock update logic in the mutation
      _invoice_items: validStockItems.length > 0 ? mappedItems : null,
      _editType: 'supply'
    });
  };

  const sym = getCurrencySymbol(currency);

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      {/* Fecha de compra — esquina superior derecha */}
      <div className="flex justify-end pb-3">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-gray-400 uppercase tracking-wider block text-right">Fecha compra</Label>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="h-8 text-xs w-40" required style={{ fontVariantNumeric: 'tabular-nums' }} />
        </div>
      </div>

      {/* Sección de Insumos para Stock (multi-item) */}
      <div className="pb-4 border-t border-gray-100 pt-4">
        <SupplyStockItems
          items={stockItems}
          onChange={handleStockItemsChange}
          supplyItems={supplyItems}
          restaurantId={form.restaurant_id}
          currency={currency}
          supplyCategories={supplyCategories}
        />
      </div>

      {/* Sección 2: Montos */}
      <div className="space-y-3 py-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" /> Montos
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-gray-500">Monto Neto (sin IVA) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{sym}</span>
              <Input type="number" step="0.01" value={form.subtotal} onChange={e => set('subtotal', e.target.value)} placeholder="0" className="h-9 text-sm pl-10" required />
            </div>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch checked={form.is_tax_exempt} onCheckedChange={v => set('is_tax_exempt', v)} />
            <span className="text-xs text-gray-500">Exento IVA</span>
          </div>
        </div>

        {/* Resumen calculado */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-100">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Neto</p>
              <p className="text-sm font-bold text-gray-800">{formatCurrency(subtotal, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">IVA ({taxRate}%)</p>
              <p className="text-sm font-bold text-amber-600">{formatCurrency(taxAmount, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total</p>
              <p className="text-sm font-extrabold text-gray-900">{formatCurrency(totalCost, currency)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 3: Proveedor y Pago */}
      <div className="space-y-3 py-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5" /> Proveedor y pago
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
            <Label className="text-xs text-gray-500">Fecha pago</Label>
            <Input 
              type="date" 
              value={form.payment_date} 
              onChange={e => set('payment_date', e.target.value)} 
              className="h-9 text-sm"
              disabled={form.payment_status !== 'pagado'}
              min={form.date}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Detalle / Notas</Label>
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Ej: 5kg tomates, 2 lechugas" rows={2} className="text-sm resize-none" />
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-10 text-sm">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="flex-1 h-10 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md">
          {isLoading ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Guardando...</> : (isEditing ? 'Actualizar Compra' : 'Registrar Compra')}
        </Button>
      </div>
    </form>
  );
}