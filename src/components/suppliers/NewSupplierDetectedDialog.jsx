import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Truck, Plus, X, Package, Building2, CheckCircle2 } from "lucide-react";

export default function NewSupplierDetectedDialog({
  open, onOpenChange, supplierData, restaurant, onSave,
}) {
  const config = restaurant?.config || {};
  const rawSupplyCategories = config.supply_categories || [];
  const foodCostCats = rawSupplyCategories
    .filter(c => (typeof c === 'string') || (c?.cost_type !== 'cost_center'))
    .map(c => typeof c === 'string' ? c : c?.name || '')
    .filter(Boolean);
  const ccSupplyCats = rawSupplyCategories
    .filter(c => typeof c === 'object' && c?.cost_type === 'cost_center')
    .map(c => ({ name: c.name, cost_center_name: c.cost_center_name || '' }));
  const allSupplyCatNames = foodCostCats.concat(ccSupplyCats.map(c => c.name));
  const opexCenters = (config.cost_centers || []).filter(c => c.type === 'opex');

  const [form, setForm] = useState(() => ({
    name: supplierData?.name || '',
    tax_id: supplierData?.tax_id || '',
    contact_phone: supplierData?.contact_phone || '',
    contact_email: supplierData?.contact_email || '',
    payment_method: supplierData?.payment_method || 'transferencia',
    payment_terms: supplierData?.payment_terms || 'contado',
    supplier_type: supplierData?.suggested_type || 'supply',
    supply_categories: supplierData?.supply_categories || [],
    opex_categories: supplierData?.opex_categories || [],
    supply_items: supplierData?.supply_items || [],
  }));

  // Re-sync form when supplierData changes (dialog re-opens with new data)
  React.useEffect(() => {
    if (supplierData && open) {
      setForm({
        name: supplierData.name || '',
        tax_id: supplierData.tax_id || '',
        contact_phone: supplierData.contact_phone || '',
        contact_email: supplierData.contact_email || '',
        payment_method: supplierData.payment_method || 'transferencia',
        payment_terms: supplierData.payment_terms || 'contado',
        supplier_type: supplierData.suggested_type || 'supply',
        supply_categories: supplierData.supply_categories || [],
        opex_categories: supplierData.opex_categories || [],
        supply_items: supplierData.supply_items || [],
      });
      setSelectedCenter('');
      setSelectedSubcat('');
    }
  }, [supplierData, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addSupplyCategory = (cat) => {
    if (!cat || form.supply_categories.includes(cat)) return;
    set('supply_categories', [...form.supply_categories, cat]);
  };

  const removeSupplyCategory = (cat) => {
    set('supply_categories', form.supply_categories.filter(c => c !== cat));
  };

  const addOpexCategory = (center, subcat) => {
    const exists = form.opex_categories.some(
      oc => oc.cost_center === center && oc.category === (subcat || '')
    );
    if (exists) return;
    set('opex_categories', [...form.opex_categories, { cost_center: center, category: subcat || '' }]);
  };

  const removeOpexCategory = (idx) => {
    set('opex_categories', form.opex_categories.filter((_, i) => i !== idx));
  };

  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedSubcat, setSelectedSubcat] = useState('');
  const centerObj = opexCenters.find(c => c.name === selectedCenter);
  const centerSubs = centerObj?.categories || [];

  const handleSave = () => {
    onSave({
      restaurant_id: restaurant?.id,
      name: form.name,
      tax_id: form.tax_id,
      contact_phone: form.contact_phone,
      contact_email: form.contact_email,
      payment_method: form.payment_method,
      payment_terms: form.payment_terms,
      supplier_type: form.supplier_type,
      supply_categories: form.supplier_type !== 'opex' ? form.supply_categories : [],
      opex_categories: form.supplier_type !== 'supply' ? form.opex_categories : [],
      supply_items: form.supplier_type !== 'opex' ? form.supply_items : [],
      is_active: true,
    });
    onOpenChange(false);
  };

  const showSupply = form.supplier_type === 'supply' || form.supplier_type === 'both';
  const showOpex = form.supplier_type === 'opex' || form.supplier_type === 'both';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            Nuevo proveedor detectado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info banner */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
            <p className="text-xs text-violet-700">
              La IA detectó que <strong>{form.name}</strong> es un proveedor nuevo.
              Configúralo para que futuras facturas se clasifiquen automáticamente.
            </p>
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Nombre</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">RUT</Label>
              <Input value={form.tax_id} onChange={e => set('tax_id', e.target.value)} className="h-9 text-sm" placeholder="12.345.678-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Teléfono</Label>
              <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="h-9 text-sm" placeholder="+56 9..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Email</Label>
              <Input value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className="h-9 text-sm" placeholder="contacto@..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Método de pago</Label>
              <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Condición de pago</Label>
              <Select value={form.payment_terms} onValueChange={v => set('payment_terms', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contado">Contado</SelectItem>
                  <SelectItem value="7_dias">7 días</SelectItem>
                  <SelectItem value="15_dias">15 días</SelectItem>
                  <SelectItem value="30_dias">30 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Supplier type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Tipo de proveedor</Label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => set('supplier_type', 'supply')}
                className={`p-3 rounded-xl border-2 text-center transition-all ${form.supplier_type === 'supply' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <Package className={`w-5 h-5 mx-auto mb-1 ${form.supplier_type === 'supply' ? 'text-amber-600' : 'text-gray-400'}`} />
                <p className="text-xs font-semibold">Insumos</p>
                <p className="text-[10px] text-gray-400">Food cost</p>
              </button>
              <button type="button" onClick={() => set('supplier_type', 'opex')}
                className={`p-3 rounded-xl border-2 text-center transition-all ${form.supplier_type === 'opex' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <Building2 className={`w-5 h-5 mx-auto mb-1 ${form.supplier_type === 'opex' ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className="text-xs font-semibold">OPEX</p>
                <p className="text-[10px] text-gray-400">Gastos op.</p>
              </button>
              <button type="button" onClick={() => set('supplier_type', 'both')}
                className={`p-3 rounded-xl border-2 text-center transition-all ${form.supplier_type === 'both' ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <Truck className={`w-5 h-5 mx-auto mb-1 ${form.supplier_type === 'both' ? 'text-violet-600' : 'text-gray-400'}`} />
                <p className="text-xs font-semibold">Ambos</p>
                <p className="text-[10px] text-gray-400">Mixto</p>
              </button>
            </div>
          </div>

          {/* Detected supply items */}
          {showSupply && form.supply_items?.length > 0 && (
            <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200/60">
              <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Insumos detectados en esta factura
              </p>
              <div className="flex flex-wrap gap-1.5">
                {form.supply_items.map((item, i) => (
                  <Badge key={i} className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Supply categories */}
          {showSupply && allSupplyCatNames.length > 0 && (
            <div className="space-y-2 bg-amber-50/70 rounded-xl p-3 border border-amber-200/60">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> Categorías de insumos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {form.supply_categories.map(cat => (
                  <Badge key={cat} className="bg-amber-100 text-amber-800 border-amber-200 gap-1 pr-1">
                    {cat}
                    <button onClick={() => removeSupplyCategory(cat)} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={addSupplyCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Agregar categoría" /></SelectTrigger>
                <SelectContent>
                  {allSupplyCatNames.filter(c => !form.supply_categories.includes(c)).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* OPEX categories */}
          {showOpex && opexCenters.length > 0 && (
            <div className="space-y-2 bg-blue-50/70 rounded-xl p-3 border border-blue-200/60">
              <p className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Centros de costo OPEX
              </p>
              {form.opex_categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.opex_categories.map((oc, i) => (
                    <Badge key={i} className="bg-blue-100 text-blue-800 border-blue-200 gap-1 pr-1">
                      {oc.cost_center}{oc.category ? ` → ${oc.category}` : ''}
                      <button onClick={() => removeOpexCategory(i)} className="hover:text-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Select value={selectedCenter} onValueChange={v => { setSelectedCenter(v); setSelectedSubcat(''); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Centro de costo" /></SelectTrigger>
                  <SelectContent>
                    {opexCenters.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {centerSubs.length > 0 ? (
                  <Select value={selectedSubcat} onValueChange={setSelectedSubcat}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subcategoría" /></SelectTrigger>
                    <SelectContent>
                      {centerSubs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center text-[10px] text-gray-400 pl-2">Sin subcategorías</div>
                )}
              </div>
              {selectedCenter && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (centerSubs.length > 0 && !selectedSubcat) return;
                    addOpexCategory(selectedCenter, selectedSubcat);
                    setSelectedCenter('');
                    setSelectedSubcat('');
                  }}
                  disabled={centerSubs.length > 0 && !selectedSubcat}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="w-3 h-3" /> Agregar
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Omitir
          </Button>
          <Button onClick={handleSave} className="flex-1 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Guardar proveedor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}