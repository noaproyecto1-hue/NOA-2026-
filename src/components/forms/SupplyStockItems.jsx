import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Search, X, Check, Package, ArrowRight } from "lucide-react";

function SupplyItemSearch({ supplyItems, value, onSelect, onClear, placeholder }) {
  const [search, setSearch] = useState(value || '');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => { setSearch(value || ''); }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return supplyItems.slice(0, 15);
    const q = search.toLowerCase();
    return supplyItems.filter(s => s.name.toLowerCase().includes(q)).slice(0, 15);
  }, [supplyItems, search]);

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
      <Input
        ref={inputRef}
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || "Buscar insumo..."}
        className="h-7 text-xs pl-6 pr-6"
      />
      {search && (
        <button type="button" onClick={() => { setSearch(''); onClear(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X className="w-3 h-3" />
        </button>
      )}
      {open && (
        <div ref={dropdownRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-36 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => { onSelect(item); setSearch(item.name); setOpen(false); }}
              className={`w-full text-left px-2 py-1.5 text-xs hover:bg-amber-50 flex items-center justify-between ${
                value === item.name ? 'bg-amber-50 text-amber-700' : 'text-gray-700'
              }`}
            >
              <div>
                <span className="font-medium">{item.name}</span>
                <span className="text-gray-400 ml-1">({item.unit_of_measure})</span>
              </div>
              {value === item.name && <Check className="w-3 h-3 text-amber-600" />}
            </button>
          )) : (
            <div className="px-2 py-2 text-xs text-gray-400 text-center">Sin resultados</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SupplyStockItems({ items, onChange, supplyItems, restaurantId, currency, supplyCategories = [] }) {
  const restSupplyItems = useMemo(() =>
    supplyItems.filter(s => s.restaurant_id === restaurantId && s.is_active !== false),
    [supplyItems, restaurantId]
  );

  const handleAdd = () => {
    onChange([...items, { name: '', quantity: 0, unit: 'kg', subtotal: 0, category: '' }]);
  };

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, value) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: value };
      // Auto-calc subtotal si cambian qty o unit_price (precisión 3 decimales)
      if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? (parseFloat(value) || 0) : (parseFloat(newItem.quantity) || 0);
        const p = field === 'unit_price' ? (parseFloat(value) || 0) : (parseFloat(newItem.unit_price) || 0);
        if (q > 0 && p > 0) newItem.subtotal = parseFloat((q * p).toFixed(2));
      }
      if (field === 'subtotal') {
        const q = parseFloat(newItem.quantity) || 0;
        const s = parseFloat(value) || 0;
        if (q > 0 && s > 0) newItem.unit_price = parseFloat((s / q).toFixed(3));
      }
      return newItem;
    });
    onChange(updated);
  };

  const handleSelectSupply = (index, supplyItem) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      return { 
        ...item, 
        name: supplyItem.name, 
        unit: supplyItem.unit_of_measure || item.unit,
        category: supplyItem.category || item.category || ''
      };
    });
    onChange(updated);
  };

  if (items.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Insumos para stock
          </p>
        </div>
        <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100 text-center">
          <p className="text-xs text-gray-500 mb-2">Agrega insumos para actualizar el inventario con esta compra</p>
          <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50">
            <Plus className="w-3 h-3 mr-1" /> Agregar insumo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Insumos para stock ({items.length})
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={handleAdd} className="text-xs h-6 text-amber-600 hover:text-amber-700 px-2">
          <Plus className="w-3 h-3 mr-1" /> Agregar
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="bg-white rounded-lg p-2.5 border border-amber-100 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SupplyItemSearch
                  supplyItems={restSupplyItems}
                  value={item.name}
                  onSelect={(s) => handleSelectSupply(i, s)}
                  onClear={() => handleChange(i, 'name', '')}
                  placeholder="Buscar o escribir insumo..."
                />
              </div>
              <button type="button" onClick={() => handleRemove(i)} className="text-gray-400 hover:text-red-500 p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              <div>
                <span className="text-[10px] text-gray-400">Cant. Facturada</span>
                <Input type="number" step="any" value={item.quantity || ''} onChange={e => handleChange(i, 'quantity', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Cant. Recibida</span>
                <Input type="number" step="any" value={item.received_quantity ?? ''} onChange={e => handleChange(i, 'received_quantity', e.target.value === '' ? null : (parseFloat(e.target.value) || 0))} placeholder="=" className="h-7 text-xs" />
                {item.received_quantity != null && item.quantity > 0 && item.received_quantity < item.quantity && (
                  <span className="text-[9px] text-red-500 font-bold">⚠ Faltante: {(item.quantity - item.received_quantity).toFixed(2)}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Unidad</span>
                <Select value={item.unit || 'kg'} onValueChange={v => handleChange(i, 'unit', v)}>
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
                <Input type="number" step="any" value={item.unit_price || ''} onChange={e => handleChange(i, 'unit_price', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Subtotal</span>
                <Input type="number" step="any" value={item.subtotal || ''} onChange={e => handleChange(i, 'subtotal', parseFloat(e.target.value) || 0)} className="h-7 text-xs bg-amber-50/50" />
              </div>
            </div>
            {/* Categoría individual */}
            {supplyCategories.length > 0 ? (
              <div>
                <span className="text-[10px] text-gray-400">Categoría</span>
                <Select value={item.category || ''} onValueChange={v => handleChange(i, 'category', v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    {supplyCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <span className="text-[10px] text-gray-400">Categoría</span>
                <Input value={item.category || ''} onChange={e => handleChange(i, 'category', e.target.value)} placeholder="Categoría" className="h-7 text-xs" />
              </div>
            )}
            {/* Indicador si existe o es nuevo */}
            {item.name && (
              <div className="text-[10px]">
                {restSupplyItems.find(s => s.name.toLowerCase() === item.name.toLowerCase()) ? (
                  <span className="text-emerald-600 flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Insumo existente — se actualizará stock
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-0.5">
                    <Plus className="w-2.5 h-2.5" /> Insumo nuevo — se creará automáticamente
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}