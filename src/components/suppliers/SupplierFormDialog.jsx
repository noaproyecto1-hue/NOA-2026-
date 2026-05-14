import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Truck, Plus, X, Check, Edit, DollarSign, Building2, Package, ShoppingBag
} from "lucide-react";
import { normalizeSupplyCategories } from '@/components/utils/supplyCategoryHelper';
import SupplierContactsList from '@/components/suppliers/SupplierContactsList';

const paymentMethodLabels = {
  efectivo: '💵 Efectivo',
  transferencia: '🏦 Transferencia',
  tarjeta: '💳 Tarjeta',
  cheque: '📄 Cheque'
};

const paymentTermsLabels = {
  contado: 'Al contado',
  '7_dias': 'Pago a 7 días',
  '15_dias': 'Pago a 15 días',
  '30_dias': 'Pago a 30 días'
};

const emptyForm = {
  name: '', tax_id: '', contact_phone: '', contact_email: '',
  payment_method: 'transferencia', payment_terms: 'contado',
  supplier_type: 'supply',
  supply_categories: [], opex_categories: [], contacts: [], notes: ''
};

export default function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  rawSupplyCategories = [],
  costCenters = [],
  onSubmit
}) {
  const [form, setForm] = useState(emptyForm);
  const isEditing = !!supplier;

  // Separate food cost categories from cost center categories
  const normalized = useMemo(() => normalizeSupplyCategories(rawSupplyCategories), [rawSupplyCategories]);
  const foodCostCategories = useMemo(() => normalized.filter(c => c.cost_type === 'food_cost').map(c => c.name), [normalized]);
  const costCenterSupplyCategories = useMemo(() => normalized.filter(c => c.cost_type === 'cost_center'), [normalized]);

  useEffect(() => {
    if (open) {
      if (supplier) {
        setForm({
          name: supplier.name || '',
          tax_id: supplier.tax_id || '',
          contact_phone: supplier.contact_phone || '',
          contact_email: supplier.contact_email || '',
          payment_method: supplier.payment_method || 'transferencia',
          payment_terms: supplier.payment_terms || 'contado',
          supplier_type: supplier.supplier_type || 'supply',
          supply_categories: (supplier.supply_categories || []).map(c => typeof c === 'string' ? c : c?.name || '').filter(Boolean),
          opex_categories: supplier.opex_categories || [],
          contacts: supplier.contacts || [],
          notes: supplier.notes || ''
        });
      } else {
        setForm({ ...emptyForm });
      }
    }
  }, [open, supplier]);

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSubmit(form);
  };

  const addSupplyCategory = (cat) => {
    if (cat && !form.supply_categories.includes(cat)) {
      setForm(f => ({ ...f, supply_categories: [...f.supply_categories, cat] }));
    }
  };

  const removeSupplyCategory = (cat) => {
    setForm(f => ({ ...f, supply_categories: f.supply_categories.filter(c => c !== cat) }));
  };

  const addOpexCategory = (centerName, category) => {
    const exists = (form.opex_categories || []).some(oc => oc.cost_center === centerName && oc.category === (category || ''));
    if (!exists) {
      setForm(f => ({ ...f, opex_categories: [...(f.opex_categories || []), { cost_center: centerName, category: category || '' }] }));
    }
  };

  const removeOpexCategory = (idx) => {
    setForm(f => ({ ...f, opex_categories: f.opex_categories.filter((_, i) => i !== idx) }));
  };

  const showSupplySection = form.supplier_type === 'supply' || form.supplier_type === 'both';
  const showOpexSection = form.supplier_type === 'opex' || form.supplier_type === 'both';
  const opexCostCenters = costCenters.filter(cc => cc.type === 'opex');

  // Which food cost categories are not yet added
  const availableFoodCost = foodCostCategories.filter(c => !form.supply_categories.includes(c));
  // Which cost-center supply categories are not yet added (show as supply_categories too)
  const availableCCSupply = costCenterSupplyCategories.filter(c => !form.supply_categories.includes(c.name));

  // Determine badge color for a category
  const getCategoryInfo = (catName) => {
    const cc = costCenterSupplyCategories.find(c => c.name === catName);
    if (cc) return { isCostCenter: true, centerName: cc.cost_center_name };
    return { isCostCenter: false, centerName: '' };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isEditing ? 'bg-amber-500' : 'bg-teal-500'}`}>
              {isEditing ? <Edit className="w-4 h-4 text-white" /> : <Truck className="w-4 h-4 text-white" />}
            </div>
            {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? `Modificando: ${form.name}` : 'Registra un nuevo proveedor para tu restaurante'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Nombre / Empresa *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Distribuidora Sur" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">RUT / NIT</Label>
              <Input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="12.345.678-9" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Teléfono</Label>
              <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+56 9 1234 5678" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Email</Label>
              <Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="proveedor@email.com" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Método de Pago</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentMethodLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Condición de Pago</Label>
              <Select value={form.payment_terms} onValueChange={v => setForm(f => ({ ...f, payment_terms: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentTermsLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Supplier Type */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs text-gray-500 font-semibold">Tipo de Proveedor</Label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setForm(f => ({ ...f, supplier_type: 'supply' }))}
                className={`p-3 rounded-xl border-2 text-center transition-all ${form.supplier_type === 'supply' ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <ShoppingBag className={`w-5 h-5 mx-auto mb-1 ${form.supplier_type === 'supply' ? 'text-emerald-600' : 'text-gray-400'}`} />
                <p className={`text-xs font-semibold ${form.supplier_type === 'supply' ? 'text-emerald-700' : 'text-gray-600'}`}>Insumos</p>
                <p className="text-[10px] text-gray-400">Suministros</p>
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, supplier_type: 'opex' }))}
                className={`p-3 rounded-xl border-2 text-center transition-all ${form.supplier_type === 'opex' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <Building2 className={`w-5 h-5 mx-auto mb-1 ${form.supplier_type === 'opex' ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className={`text-xs font-semibold ${form.supplier_type === 'opex' ? 'text-blue-700' : 'text-gray-600'}`}>Gasto Op.</p>
                <p className="text-[10px] text-gray-400">OPEX</p>
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, supplier_type: 'both' }))}
                className={`p-3 rounded-xl border-2 text-center transition-all ${form.supplier_type === 'both' ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <Package className={`w-5 h-5 mx-auto mb-1 ${form.supplier_type === 'both' ? 'text-purple-600' : 'text-gray-400'}`} />
                <p className={`text-xs font-semibold ${form.supplier_type === 'both' ? 'text-purple-700' : 'text-gray-600'}`}>Ambos</p>
                <p className="text-[10px] text-gray-400">Mixto</p>
              </button>
            </div>
          </div>

          {/* Supply Categories — grouped by Food Cost vs Cost Center */}
          {showSupplySection && (
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                Categorías de Insumos
              </Label>
              <p className="text-[10px] text-gray-400 -mt-1">
                Según tu configuración, cada categoría se clasifica automáticamente como Food Cost o Centro de Costos.
              </p>
              
              {/* Selected categories with visual distinction */}
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {form.supply_categories.map(cat => {
                  const info = getCategoryInfo(cat);
                  return (
                    <Badge key={cat} variant="secondary" className={`pl-2 pr-1 py-1 border-0 gap-1 ${
                      info.isCostCenter
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      <span className="text-xs">{cat}</span>
                      {info.isCostCenter && (
                        <span className="text-[9px] opacity-70">({info.centerName})</span>
                      )}
                      <button type="button" onClick={() => removeSupplyCategory(cat)} className={`rounded-full p-0.5 ${info.isCostCenter ? 'hover:bg-amber-200' : 'hover:bg-emerald-200'}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
                {form.supply_categories.length === 0 && (
                  <span className="text-xs text-gray-400 italic">Sin categorías asignadas</span>
                )}
              </div>

              {/* Dropdown to add — grouped */}
              {(availableFoodCost.length > 0 || availableCCSupply.length > 0) && (
                <Select value="" onValueChange={v => addSupplyCategory(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Agregar categoría de insumo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFoodCost.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50">
                          💰 Food Cost
                        </div>
                        {availableFoodCost.map(c => (
                          <SelectItem key={c} value={c}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                              {c}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {availableCCSupply.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider bg-amber-50 mt-1">
                          🏢 Centro de Costos
                        </div>
                        {availableCCSupply.map(c => (
                          <SelectItem key={c.name} value={c.name}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                              {c.name}
                              <span className="text-[10px] text-gray-400">→ {c.cost_center_name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}

              {/* Legend */}
              {form.supply_categories.length > 0 && (
                <div className="flex items-center gap-4 text-[10px] text-gray-400 pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Food Cost
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Centro de Costos
                  </span>
                </div>
              )}
            </div>
          )}

          {/* OPEX Categories (Cost Centers) */}
          {showOpexSection && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Centros de Costo OPEX
              </Label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {(form.opex_categories || []).map((oc, idx) => {
                  const hasCategory = oc.category && oc.category.trim();
                  return (
                    <Badge key={idx} variant="secondary" className={`pl-2 pr-1 py-1 border-0 gap-1 ${hasCategory ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                      <span className="text-xs">{oc.cost_center}{hasCategory ? ` → ${oc.category}` : ''}</span>
                      {!hasCategory && <span className="text-[9px] opacity-60">(general)</span>}
                      <button type="button" onClick={() => removeOpexCategory(idx)} className={`rounded-full p-0.5 ${hasCategory ? 'hover:bg-indigo-200' : 'hover:bg-orange-200'}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
                {(form.opex_categories || []).length === 0 && (
                  <span className="text-xs text-gray-400 italic">Sin centros de costo asignados</span>
                )}
              </div>
              {opexCostCenters.length > 0 ? (
                <Select value="" onValueChange={v => {
                  const [center, cat] = v.split('|||');
                  addOpexCategory(center, cat || '');
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Agregar centro de costo..." /></SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const withSubs = opexCostCenters.filter(cc => cc.categories?.length > 0);
                      const withoutSubs = opexCostCenters.filter(cc => !cc.categories?.length);
                      const items = [];
                      withSubs.forEach(cc => {
                        items.push(
                          <div key={`header-${cc.name}`} className="px-2 py-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50">
                            {cc.name}
                          </div>
                        );
                        cc.categories.forEach(subcat => {
                          items.push(
                            <SelectItem key={`${cc.name}-${subcat}`} value={`${cc.name}|||${subcat}`}>
                              <span className="flex items-center gap-1.5">
                                <span className="text-gray-400">↳</span> {subcat}
                              </span>
                            </SelectItem>
                          );
                        });
                      });
                      if (withoutSubs.length > 0) {
                        items.push(
                          <div key="header-sin-cat" className="px-2 py-1.5 text-[10px] font-bold text-orange-500 uppercase tracking-wider bg-orange-50 mt-1 border-t border-orange-200">
                            ⚠ Sin subcategorías
                          </div>
                        );
                        withoutSubs.forEach(cc => {
                          items.push(
                            <SelectItem key={cc.name} value={`${cc.name}|||`}>
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-orange-300 flex-shrink-0" />
                                {cc.name}
                              </span>
                            </SelectItem>
                          );
                        });
                      }
                      return items;
                    })()}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[10px] text-gray-400 italic">Configura centros de costo en la pestaña "Costos"</p>
              )}
            </div>
          )}

          {/* Contacts / Vendedores */}
          <div className="pt-2 border-t">
            <SupplierContactsList
              contacts={form.contacts}
              onChange={(contacts) => setForm(f => ({ ...f, contacts }))}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1 pt-2 border-t">
            <Label className="text-xs text-gray-500">Notas</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas adicionales..." className="h-9" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.name.trim()}
            className={isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-teal-600 hover:bg-teal-700'}
          >
            {isEditing ? <><Edit className="w-4 h-4 mr-1.5" /> Actualizar</> : <><Check className="w-4 h-4 mr-1.5" /> Crear Proveedor</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}