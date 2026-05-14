import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  CheckCircle2, AlertTriangle, Edit, Plus, Trash2, Package, Building2, Truck, Link2
} from "lucide-react";
import { formatCurrency, getCurrencySymbol } from '@/components/utils/currencyHelper';
import SupplySearchInput from './SupplySearchInput';
import OpExDetailSection from './OpExDetailSection';
import ReanalyzeFeedbackDialog from './ReanalyzeFeedbackDialog';

function MontoRow({ label, value, onChange, sym, disabled, textClass, bold }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const formatted = (value || 0).toLocaleString('es-CL');

  const startEdit = () => {
    if (disabled) return;
    setRaw(String(value || ''));
    setEditing(true);
  };

  const endEdit = () => {
    setEditing(false);
    onChange(parseFloat(raw) || 0);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <Label className={`text-xs whitespace-nowrap w-28 ${bold ? 'text-sm text-gray-700 font-bold' : 'text-gray-500'}`}>{label}</Label>
      <div className="flex-1">
        {editing ? (
          <Input
            type="number"
            autoFocus
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onBlur={endEdit}
            onKeyDown={e => e.key === 'Enter' && endEdit()}
            className={`${bold ? 'h-9' : 'h-8'} text-sm text-right font-medium`}
          />
        ) : (
          <div
            onClick={startEdit}
            className={`${bold ? 'h-9 text-sm font-extrabold' : 'h-8 text-sm font-medium'} ${textClass || ''} ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-white/80'} flex items-center justify-end px-3 rounded-md border border-input bg-background`}
          >
            {sym}{formatted}
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvoicePreviewForm({
  extractedData,
  invoiceType, // 'supply' | 'opex'
  restaurant,
  supplyItems = [],
  suppliers = [],
  currency = 'CLP',
  onConfirm,
  onBack,
}) {
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const config = restaurant?.config || {};
  // Normalize: extract name strings from supply_categories (can be objects or strings)
  const supplyCategories = (config.supply_categories || []).map(c => typeof c === 'string' ? c : c?.name || '').filter(Boolean);
  const opexCostCenters = (config.cost_centers || []).filter(c => c.type === 'opex');
  const sym = getCurrencySymbol(currency);

  // Estado editable inicializado desde extractedData
  const [form, setForm] = useState(() => {
    const d = extractedData || {};
    
    // Intentar matchear proveedor existente
    const normalizeRut = (rut) => (rut || '').replace(/[\.\s-]/g, '').toLowerCase().trim();
    const normalizeName = (name) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
    
    const matchedSupplier = suppliers.find(s => {
      if (d.supplier_tax_id && s.tax_id) {
        if (normalizeRut(d.supplier_tax_id) === normalizeRut(s.tax_id)) return true;
      }
      if (d.supplier_name && s.name) {
        if (normalizeName(s.name) === normalizeName(d.supplier_name)) return true;
      }
      if (d.supplier_name && s.name) {
        const extracted = normalizeName(d.supplier_name);
        const existing = normalizeName(s.name);
        if (extracted.length >= 4 && existing.length >= 4) {
          if (extracted.includes(existing) || existing.includes(extracted)) return true;
        }
        const extractedWords = extracted.split(' ').filter(w => w.length >= 4);
        const existingWords = existing.split(' ').filter(w => w.length >= 4);
        const commonWords = extractedWords.filter(w => existingWords.some(ew => ew.includes(w) || w.includes(ew)));
        if (commonWords.length >= 2) return true;
        if (extractedWords.length <= 2 && existingWords.length <= 2 && commonWords.length >= 1) return true;
      }
      return false;
    });

    // Validar consistencia de items: qty * unit_price ≈ subtotal
    // Si hay inconsistencia, intentar corregir el valor que parece erróneo
    const rawItems = d.items || [];
    const correctedItems = rawItems.map(item => {
      const qty = parseFloat(item.quantity) || 0;
      const up = parseFloat(item.unit_price) || 0;
      const sub = parseFloat(item.subtotal) || 0;
      
      if (qty > 0 && up > 0 && sub > 0) {
        const expectedSub = qty * up;
        const tolerance = Math.max(2, expectedSub * 0.01); // 1% or $2 tolerance
        
        if (Math.abs(sub - expectedSub) > tolerance) {
          // Inconsistency detected. Try to figure out which value is wrong.
          // If subtotal / qty gives a reasonable unit_price, fix unit_price
          const impliedUp = sub / qty;
          // If subtotal / unit_price gives a reasonable qty, fix qty
          const impliedQty = sub / up;
          
          // Heuristic: the subtotal from the invoice is usually the most reliable 
          // (it's the last column, clearly printed), so trust it and recalculate unit_price
          if (sub > up && sub > qty) {
            // Subtotal seems like the biggest number (makes sense), recalculate unit_price
            return { ...item, unit_price: Math.round((sub / qty) * 100) / 100 };
          }
          // Fallback: recalculate subtotal from qty * unit_price
          return { ...item, subtotal: Math.round(expectedSub) };
        }
      } else if (qty > 0 && up > 0 && sub === 0) {
        // Missing subtotal, calculate it
        return { ...item, subtotal: Math.round(qty * up) };
      } else if (qty > 0 && sub > 0 && up === 0) {
        // Missing unit_price, calculate it
        return { ...item, unit_price: Math.round((sub / qty) * 100) / 100 };
      } else if (up > 0 && sub > 0 && qty === 0) {
        // Missing quantity, calculate it
        const calcQty = sub / up;
        return { ...item, quantity: Math.round(calcQty * 100) / 100 };
      }
      return item;
    });

    // 🔴 VALIDACIÓN CRÍTICA: El RUT extraído NO puede ser el del restaurante (comprador)
    const normalizeRutFull = (rut) => (rut || '').replace(/[\.\s\-]/g, '').toLowerCase().trim();
    const restaurantRut = normalizeRutFull(restaurant?.tax_id);
    let extractedRut = matchedSupplier?.tax_id || d.supplier_tax_id || '';
    let _rutWarning = false;
    if (restaurantRut && normalizeRutFull(extractedRut) === restaurantRut) {
      extractedRut = ''; // Limpiar: la IA confundió el RUT del comprador con el del proveedor
      _rutWarning = true;
    }

    const initial = {
      supplier_name: matchedSupplier?.name || d.supplier_name || '',
      supplier_tax_id: extractedRut,
      _rutWarning,
      invoice_number: d.invoice_number || '',
      date: d.date || new Date().toISOString().split('T')[0],
      payment_method: matchedSupplier?.payment_method || d.payment_method || 'contado',
      is_tax_exempt: d.is_tax_exempt || false,
      subtotal_neto: d.subtotal_neto || 0,
      iva_amount: d.iva_amount || 0,
      total: d.total || 0,
      // Supply specific
      items: correctedItems,
      suggested_category: d.suggested_category || '',
      // OpEx specific
      description: d.description || d.notes || '',
      suggested_cost_center: d.suggested_cost_center || '',
      suggested_opex_category: d.suggested_category || '',
      // General
      notes: d.notes || '',
      payment_status: (matchedSupplier?.payment_terms && matchedSupplier.payment_terms !== 'contado') 
        ? 'pendiente' 
        : (d.payment_method === 'credito' || d.payment_method === 'crédito' ? 'pendiente' : 'pagado'),
      payment_due_date: d.payment_due_date || d.due_date || '',
      _matchedSupplier: matchedSupplier,
      _isNewSupplier: !matchedSupplier && !!d.supplier_name,
    };

    // Si hay proveedor matcheado con opex_categories, auto-rellenar centro de costo y categoría
    if (matchedSupplier && matchedSupplier.opex_categories?.length > 0) {
      const opexCats = matchedSupplier.opex_categories;
      
      // Si la IA extrajo una categoría, buscar si coincide con alguna del proveedor para elegir el centro correcto
      const extractedCat = (initial.suggested_opex_category || '').toLowerCase().trim();
      let bestMatch = null;
      
      if (extractedCat) {
        bestMatch = opexCats.find(oc => 
          (oc.category || '').toLowerCase().trim() === extractedCat
        );
        if (!bestMatch) {
          bestMatch = opexCats.find(oc => 
            (oc.category || '').toLowerCase().includes(extractedCat) || 
            extractedCat.includes((oc.category || '').toLowerCase())
          );
        }
      }
      
      if (bestMatch) {
        // La categoría extraída coincide con una del proveedor → usar su centro de costo
        initial.suggested_cost_center = bestMatch.cost_center;
        initial.suggested_opex_category = bestMatch.category || extractedCat;
      } else {
        // Sin match por categoría → usar el primer opex_category del proveedor
        const firstOpex = opexCats[0];
        if (!initial.suggested_cost_center && firstOpex.cost_center) {
          initial.suggested_cost_center = firstOpex.cost_center;
        }
        if (!initial.suggested_opex_category && firstOpex.category) {
          initial.suggested_opex_category = firstOpex.category;
        }
      }
    }

    return initial;
  });

  const set = (key, val) => setForm(f => {
    const newForm = { ...f, [key]: val };
    
    // Si cambia el nombre del proveedor, re-matchear y auto-rellenar opex
    if (key === 'supplier_name' && invoiceType === 'opex') {
      const normalizeName = (name) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const inputName = normalizeName(val);
      const matched = inputName.length >= 3 ? suppliers.find(s => {
        const sn = normalizeName(s.name);
        return sn === inputName || (sn.length >= 4 && inputName.length >= 4 && (sn.includes(inputName) || inputName.includes(sn)));
      }) : null;
      
      if (matched) {
        newForm._matchedSupplier = matched;
        newForm._isNewSupplier = false;
        if (matched.tax_id) newForm.supplier_tax_id = matched.tax_id;
        if (matched.opex_categories?.length > 0) {
          const currentCat = (newForm.suggested_opex_category || '').toLowerCase().trim();
          const bestCatMatch = currentCat 
            ? matched.opex_categories.find(oc => (oc.category || '').toLowerCase().includes(currentCat) || currentCat.includes((oc.category || '').toLowerCase()))
            : null;
          const pick = bestCatMatch || matched.opex_categories[0];
          newForm.suggested_cost_center = pick.cost_center || '';
          if (!newForm.suggested_opex_category && pick.category) {
            newForm.suggested_opex_category = pick.category;
          }
        }
      } else {
        newForm._matchedSupplier = null;
        newForm._isNewSupplier = !!val;
      }
    }
    
    return newForm;
  });

  // Recalcular totales cuando cambia neto o exento
  const recalcTotals = (neto, isExempt) => {
    const n = parseFloat(neto) || 0;
    const iva = isExempt ? 0 : Math.round(n * 0.19);
    setForm(f => ({ ...f, subtotal_neto: n, iva_amount: iva, total: n + iva, is_tax_exempt: isExempt }));
  };

  // Matchear items con insumos existentes — solo match EXACTO (nombre completo idéntico)
  const matchedItems = useMemo(() => {
    if (invoiceType !== 'supply') return [];
    return (form.items || []).map((item, idx) => {
      const itemName = (item.name || '').toLowerCase().trim();
      if (!itemName || itemName.length < 3) return { ...item, _matched: null, _suggestions: [], _useOriginalName: item._useOriginalName ?? true };

      // Solo match EXACTO: nombres idénticos
      const exactMatch = supplyItems.find(s => 
        (s.name || '').toLowerCase().trim() === itemName
      );

      // Sugerencias: insumos que contienen alguna palabra clave del item (para ofrecer como opción)
      // Buscar usando el nombre original si existe (por si ya seleccionó uno y quiere cambiar)
      const searchName = (item._originalName || item.name || '').toLowerCase().trim();
      const suggestions = exactMatch ? [] : supplyItems.filter(s => {
        const supplyName = (s.name || '').toLowerCase().trim();
        if (!supplyName || supplyName.length < 3) return false;
        // Ver si comparten alguna palabra significativa (3+ chars)
        const searchWords = searchName.split(/\s+/).filter(w => w.length >= 3);
        return searchWords.some(word => supplyName.includes(word));
      }).slice(0, 10);

      return { 
        ...item, 
        _matched: exactMatch, 
        _suggestions: suggestions,
        _useOriginalName: item._useOriginalName ?? true // por defecto usar nombre de factura
      };
    });
  }, [form.items, supplyItems, invoiceType]);

  const handleItemChange = (index, field, value) => {
    setForm(f => {
      const newItems = [...(f.items || [])];
      const item = { ...newItems[index], [field]: value };
      
      // Auto-cálculo: si cambian cantidad o precio unitario → recalcular subtotal
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? (parseFloat(value) || 0) : (parseFloat(item.quantity) || 0);
        const price = field === 'unit_price' ? (parseFloat(value) || 0) : (parseFloat(item.unit_price) || 0);
        if (qty > 0 && price > 0) {
          item.subtotal = Math.round(qty * price);
        }
      }
      // Si cambian subtotal y hay cantidad → recalcular precio unitario
      if (field === 'subtotal') {
        const qty = parseFloat(item.quantity) || 0;
        const sub = parseFloat(value) || 0;
        if (qty > 0 && sub > 0) {
          item.unit_price = Math.round((sub / qty) * 100) / 100;
        }
      }
      
      newItems[index] = item;
      return { ...f, items: newItems };
    });
  };

  // Guardar nombre original de factura y seleccionar un insumo existente
  const handleSelectExistingSupply = (index, supplyName) => {
    setForm(f => {
      const newItems = [...(f.items || [])];
      const item = newItems[index];
      // Guardar nombre original si es la primera vez que selecciona
      if (!item._originalName) {
        item._originalName = item.name;
      }
      item.name = supplyName;
      item._selectedExisting = true;
      newItems[index] = { ...item };
      return { ...f, items: newItems };
    });
  };

  // Volver al nombre original de la factura
  const handleRevertToOriginal = (index) => {
    setForm(f => {
      const newItems = [...(f.items || [])];
      const item = newItems[index];
      if (item._originalName) {
        item.name = item._originalName;
        item._selectedExisting = false;
      }
      newItems[index] = { ...item };
      return { ...f, items: newItems };
    });
  };

  const handleRemoveItem = (index) => {
    setForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-4">
      {/* Badge de tipo */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={invoiceType === 'supply' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}>
          {invoiceType === 'supply' ? '🍽️ Suministro' : '💼 Gasto Operativo'}
        </Badge>
        <Badge className="bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Datos extraídos
        </Badge>
        {form._isNewSupplier && (
          <Badge className="bg-violet-100 text-violet-700">
            <Plus className="w-3 h-3 mr-1" /> Proveedor nuevo
          </Badge>
        )}
        {form._matchedSupplier && (
          <Badge className="bg-emerald-100 text-emerald-700">
            <Truck className="w-3 h-3 mr-1" /> Proveedor existente
          </Badge>
        )}
      </div>

      {/* Proveedor */}
      <div className="p-3 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
          <Truck className="w-3 h-3" /> Proveedor
        </p>
        <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Nombre</Label>
          <Input value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">RUT Proveedor</Label>
          <Input 
            value={form.supplier_tax_id} 
            onChange={e => {
              const val = e.target.value;
              const normalizeR = (r) => (r || '').replace(/[\.\s\-]/g, '').toLowerCase().trim();
              if (restaurant?.tax_id && normalizeR(val) === normalizeR(restaurant.tax_id)) {
                set('_rutWarning', true);
                set('supplier_tax_id', '');
                return;
              }
              set('_rutWarning', false);
              set('supplier_tax_id', val);
            }} 
            className={`h-8 text-sm ${form._rutWarning ? 'border-red-300' : ''}`}
            placeholder="12.345.678-9" 
          />
          {form._rutWarning && (
            <p className="text-[10px] text-red-600 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Ese RUT es de tu restaurante, no del proveedor
            </p>
          )}
        </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">N° Factura</Label>
            <Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Fecha</Label>
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Estado pago</Label>
            <Select value={form.payment_status} onValueChange={v => set('payment_status', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagado">✅ Pagado</SelectItem>
                <SelectItem value="pendiente">⏳ Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {form.payment_status === 'pendiente' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Fecha vencimiento pago</Label>
              <Input type="date" value={form.payment_due_date} onChange={e => set('payment_due_date', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex items-end">
              {form.payment_due_date && (
                <p className="text-xs text-amber-600 pb-1.5">⏰ Vence: {new Date(form.payment_due_date + 'T12:00:00').toLocaleDateString('es-CL')}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Items detectados (Supply) */}
      {invoiceType === 'supply' && matchedItems.length > 0 && (
        <div className="p-3 bg-amber-50 rounded-xl space-y-2 border border-amber-100">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
            <Package className="w-3 h-3" /> Productos detectados ({matchedItems.length})
          </p>
          <div className="space-y-2">
            {matchedItems.map((item, i) => (
              <div key={i} className="bg-white rounded-lg p-2.5 border border-amber-100 space-y-1.5">
                {/* Nombre del producto - editable */}
                <div className="flex items-center justify-between gap-2">
                  <Input 
                    value={item._selectedExisting ? (item._originalName || item.name) : item.name} 
                    onChange={e => {
                      const val = e.target.value;
                      if (item._selectedExisting && item._originalName) {
                        handleItemChange(i, '_originalName', val);
                      } else {
                        handleItemChange(i, 'name', val);
                      }
                    }}
                    className="h-8 text-sm font-medium flex-1" 
                  />
                  <button onClick={() => handleRemoveItem(i)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  <div>
                    <span className="text-[10px] text-gray-400">Cant. Facturada</span>
                    <Input type="number" step="any" value={item.quantity || ''} onChange={e => handleItemChange(i, 'quantity', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">Cant. Recibida</span>
                    <Input 
                      type="number" 
                      step="any" 
                      value={item.received_quantity ?? ''} 
                      onChange={e => handleItemChange(i, 'received_quantity', e.target.value === '' ? null : (parseFloat(e.target.value) || 0))} 
                      placeholder="=" 
                      className="h-7 text-xs border-amber-300 focus:ring-amber-400" 
                    />
                    {item.received_quantity != null && item.quantity > 0 && item.received_quantity < item.quantity && (
                      <span className="text-[9px] text-red-500 font-bold">⚠ Faltante: {(item.quantity - item.received_quantity).toFixed(2)}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">Unidad</span>
                    <Select value={item.unit || 'kg'} onValueChange={v => handleItemChange(i, 'unit', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['kg','g','L','ml','unidad','docena','lb','oz','caja','paquete','pieza','frasco'].map(u => 
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">P. Unit</span>
                    <Input type="number" value={item.unit_price || ''} onChange={e => handleItemChange(i, 'unit_price', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">Subtotal</span>
                    <Input type="number" value={item.subtotal || ''} onChange={e => handleItemChange(i, 'subtotal', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                  </div>
                </div>
                {/* Categoría individual del item */}
                <div>
                  <span className="text-[10px] text-gray-400">Categoría</span>
                  {supplyCategories.length > 0 ? (
                    <Select value={item.category || form.suggested_category || ''} onValueChange={v => handleItemChange(i, 'category', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Categoría del insumo" /></SelectTrigger>
                      <SelectContent>
                        {supplyCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={item.category || ''} onChange={e => handleItemChange(i, 'category', e.target.value)} placeholder="Categoría" className="h-7 text-xs" />
                  )}
                </div>

                {/* Match / vinculación con insumo existente */}
                {item._matched ? (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    Insumo existente: {item._matched.name} ({item._matched.unit_of_measure}) — se actualizará stock
                  </div>
                ) : item._selectedExisting ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                      <Link2 className="w-3 h-3" />
                      Vinculado a:
                    </div>
                    <SupplySearchInput
                      supplyItems={supplyItems}
                      selectedName={item.name}
                      onSelect={(name) => handleSelectExistingSupply(i, name)}
                      onClear={() => handleRevertToOriginal(i)}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[10px] text-amber-600 flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      Insumo nuevo — se creará automáticamente, o vincula a uno existente:
                    </p>
                    <SupplySearchInput
                      supplyItems={supplyItems}
                      selectedName={null}
                      onSelect={(name) => handleSelectExistingSupply(i, name)}
                      onClear={() => {}}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          
        </div>
      )}

      {/* Detalle (OpEx) */}
      {invoiceType === 'opex' && (
        <OpExDetailSection
          form={form}
          set={set}
          opexCostCenters={opexCostCenters}
          suppliers={suppliers}
        />
      )}

      {/* Montos */}
      <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 space-y-3">
        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Montos</p>
        <div className="space-y-2">
          <MontoRow label="Neto (sin IVA)" value={form.subtotal_neto} onChange={v => recalcTotals(v, form.is_tax_exempt)} sym={sym} />
          <MontoRow label="IVA (19%)" value={form.iva_amount} onChange={v => set('iva_amount', v)} sym={sym} disabled={!form.is_tax_exempt} textClass="text-emerald-600" />
          <div className="border-t border-emerald-200 pt-2">
            <MontoRow label="Total" value={form.total} onChange={v => set('total', v)} sym={sym} bold />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_tax_exempt} onCheckedChange={v => recalcTotals(form.subtotal_neto, v)} />
          <span className="text-xs text-gray-500">Exento de IVA</span>
        </div>
      </div>

      {/* Notas */}
      {form.notes && (
        <p className="text-xs text-gray-500 italic px-1">"{form.notes}"</p>
      )}

      {/* Botones */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={() => setShowFeedbackDialog(true)}>
          <Edit className="w-4 h-4 mr-1" /> Re-analizar
        </Button>
        <Button 
          onClick={() => onConfirm(form)}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar y Guardar
        </Button>
      </div>

      <p className="text-[10px] text-center text-gray-400">
        Revisa y edita los datos antes de confirmar. Los proveedores nuevos se crean automáticamente.
      </p>

      {/* Diálogo de feedback para re-análisis */}
      <ReanalyzeFeedbackDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        invoiceType={invoiceType}
        onSubmit={(feedback) => onBack(feedback)}
      />
    </div>
  );
}