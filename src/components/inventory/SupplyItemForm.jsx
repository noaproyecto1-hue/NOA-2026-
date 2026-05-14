import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import SupplierSearchInput from '@/components/suppliers/SupplierSearchInput';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const unitLabels = {
  kg: 'Kilogramos',
  g: 'Gramos',
  L: 'Litros',
  ml: 'Mililitros',
  unidad: 'Unidades',
  docena: 'Docenas',
  lb: 'Libras',
  oz: 'Onzas',
  paquete: 'Paquetes',
  caja: 'Cajas',
  pieza: 'Piezas',
  frasco: 'Frascos'
};

export default function SupplyItemForm({
  defaultValues = {},
  restaurants = [],
  supplyCategories = [],
  suppliers = [],
  onSubmit,
  onCancel,
  isLoading = false
}) {
  const [form, setForm] = useState({
    restaurant_id: '',
    name: '',
    category: '',
    area: '',
    unit_of_measure: 'kg',
    average_unit_cost: 0,
    yield_percentage: 100,
    current_stock: 0,
    ideal_stock: 0,
    warning_stock: 0,
    min_stock: 0,
    supplier: '',
    ...defaultValues
  });

  // Cargar zonas de preparación desde la config del restaurante
  const { data: allRestaurants = [] } = useQuery({
    queryKey: ['allRestaurantsForAreas'],
    queryFn: () => base44.entities.Restaurant.filter({ is_active: true })
  });

  const currentRestaurant = allRestaurants.find(r => r.id === form.restaurant_id);
  const preparationZones = currentRestaurant?.config?.preparation_zones || [];

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const fields = [
    { name: 'restaurant_id', label: 'Restaurante', required: true },
    { name: 'name', label: 'Nombre del Insumo', required: true },
    { name: 'category', label: 'Categoría', required: true },
    { name: 'unit_of_measure', label: 'Unidad de Medida', required: true },
    { name: 'average_unit_cost', label: 'Costo Promedio por Unidad', required: true },
    { name: 'current_stock', label: 'Stock Actual' },
    { name: 'warning_stock', label: 'Stock Advertencia (Naranja)' },
    { name: 'min_stock', label: 'Stock Crítico (Rojo)' },
    { name: 'supplier', label: 'Proveedor (opcional)' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Restaurante */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
        <Label className="text-sm font-medium text-gray-700">Restaurante <span className="text-red-500">*</span></Label>
        <Select value={form.restaurant_id} onValueChange={(val) => set('restaurant_id', val)}>
          <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm">
            <SelectValue placeholder="Seleccionar Restaurante" />
          </SelectTrigger>
          <SelectContent>
            {restaurants.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Nombre */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
        <Label className="text-sm font-medium text-gray-700">Nombre del Insumo <span className="text-red-500">*</span></Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Tomate, Carne Molida, Harina..." required className="h-11 rounded-xl border-gray-200 bg-white shadow-sm" />
      </motion.div>

      {/* Categoría */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <Label className="text-sm font-medium text-gray-700">Categoría <span className="text-red-500">*</span></Label>
        <Select value={form.category} onValueChange={(val) => set('category', val)}>
          <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm">
            <SelectValue placeholder="Seleccionar Categoría" />
          </SelectTrigger>
          <SelectContent>
            {supplyCategories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Área / Zona de Preparación */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
        <Label className="text-sm font-medium text-gray-700">Área / Zona</Label>
        <Select value={form.area || ''} onValueChange={(val) => set('area', val)}>
          <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm">
            <SelectValue placeholder="Seleccionar Área (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Sin asignar</SelectItem>
            {preparationZones.map(z => (
              <SelectItem key={z} value={z}>{z}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Unidad */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
        <Label className="text-sm font-medium text-gray-700">Unidad de Medida <span className="text-red-500">*</span></Label>
        <Select value={form.unit_of_measure} onValueChange={(val) => set('unit_of_measure', val)}>
          <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(unitLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Costo */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <Label className="text-sm font-medium text-gray-700">Costo Promedio por Unidad <span className="text-red-500">*</span></Label>
        <Input type="number" step="0.01" value={form.average_unit_cost} onChange={e => set('average_unit_cost', parseFloat(e.target.value) || 0)} required className="h-11 rounded-xl border-gray-200 bg-white shadow-sm" />
      </motion.div>

      {/* Rendimiento */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
        <Label className="text-sm font-medium text-gray-700">
          Rendimiento (%)
          <span className="text-xs text-gray-400 ml-1">— Ej: 80% = solo 80% es utilizable</span>
        </Label>
        <Input type="number" step="1" min="1" max="100" value={form.yield_percentage ?? 100} onChange={e => set('yield_percentage', parseInt(e.target.value) || 100)} className="h-11 rounded-xl border-gray-200 bg-white shadow-sm" />
        {form.yield_percentage && form.yield_percentage < 100 && form.average_unit_cost > 0 && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-700">Costo de compra</span>
              <span className="font-medium text-gray-700">${form.average_unit_cost.toFixed(2)}/{form.unit_of_measure}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-700">Rendimiento</span>
              <span className="font-medium text-gray-700">{form.yield_percentage}%</span>
            </div>
            <div className="border-t border-amber-200 pt-1.5 flex items-center justify-between text-sm">
              <span className="text-amber-800 font-semibold">→ Costo real por {form.unit_of_measure} útil</span>
              <span className="font-bold text-amber-900 text-base">${(form.average_unit_cost / (form.yield_percentage / 100)).toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-amber-600">
              Este es el costo que se usa en las recetas. Si compras 1{form.unit_of_measure} a ${form.average_unit_cost.toFixed(0)}, solo aprovechas {(form.yield_percentage / 100).toFixed(2)}{form.unit_of_measure}.
            </p>
          </div>
        )}
      </motion.div>

      {/* Stock Actual */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Label className="text-sm font-medium text-gray-700">Stock Actual</Label>
        <Input type="number" step="0.01" value={form.current_stock} onChange={e => set('current_stock', parseFloat(e.target.value) || 0)} className="h-11 rounded-xl border-gray-200 bg-white shadow-sm" />
      </motion.div>

      {/* Stock Ideal */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
        <Label className="text-sm font-medium text-gray-700">
          Stock Ideal (🎯)
          <span className="text-xs text-gray-400 ml-1">— Cantidad objetivo para calcular compras</span>
        </Label>
        <Input type="number" step="0.01" value={form.ideal_stock} onChange={e => set('ideal_stock', parseFloat(e.target.value) || 0)} placeholder="Cantidad ideal a mantener" className="h-11 rounded-xl border-gray-200 bg-white shadow-sm" />
        {form.ideal_stock > 0 && form.current_stock < form.ideal_stock && (
          <p className="text-xs text-blue-600 mt-1">
            🛒 Necesitas comprar: <strong>{(form.ideal_stock - form.current_stock).toFixed(1)} {form.unit_of_measure}</strong> para llegar al ideal
          </p>
        )}
      </motion.div>

      {/* Warning Stock */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <Label className="text-sm font-medium text-gray-700">Stock Advertencia (Naranja)</Label>
        <Input type="number" step="0.01" value={form.warning_stock} onChange={e => set('warning_stock', parseFloat(e.target.value) || 0)} placeholder="Alerta preventiva" className="h-11 rounded-xl border-gray-200 bg-white shadow-sm" />
      </motion.div>

      {/* Min Stock */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
        <Label className="text-sm font-medium text-gray-700">Stock Crítico (Rojo)</Label>
        <Input type="number" step="0.01" value={form.min_stock} onChange={e => set('min_stock', parseFloat(e.target.value) || 0)} placeholder="Alerta urgente" className="h-11 rounded-xl border-gray-200 bg-white shadow-sm" />
      </motion.div>

      {/* Proveedor - con búsqueda de BD */}
      <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
        <Label className="text-sm font-medium text-gray-700">Proveedor (opcional)</Label>
        <SupplierSearchInput
          suppliers={suppliers}
          value={form.supplier}
          onChange={(val) => set('supplier', val)}
          placeholder="Buscar proveedor..."
        />
      </motion.div>

      <div className="flex gap-3 pt-5 border-t border-gray-100">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-xl hover:bg-gray-50">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-200 transition-all duration-300">
          {isLoading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Guardar</>
          )}
        </Button>
      </div>
    </form>
  );
}