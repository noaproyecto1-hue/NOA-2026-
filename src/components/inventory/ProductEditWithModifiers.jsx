import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Layers, Package, Loader2, DollarSign, Archive, AlertTriangle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function ProductEditWithModifiers({
  product,
  allInventory = [],
  restaurants = [],
  categories = [],
  subcategories = [],
  zones = [],
  onSubmit,
  onCancel,
  isLoading = false
}) {
  const [formData, setFormData] = useState({
    restaurant_id: product?.restaurant_id || '',
    product_name: product?.product_name || '',
    category: product?.category || '',
    subcategory: product?.subcategory || '',
    unit_price: product?.unit_price || '',
    unit_of_measure: product?.unit_of_measure || 'unidad',
    current_stock: product?.current_stock || '',
    warning_stock: product?.warning_stock || '',
    min_stock: product?.min_stock || ''
  });

  const unitOptions = [
    { value: 'unidad', label: 'Unidades' },
    { value: 'kg', label: 'Kilogramos' },
    { value: 'g', label: 'Gramos' },
    { value: 'lb', label: 'Libras' },
    { value: 'oz', label: 'Onzas' },
    { value: 'L', label: 'Litros' },
    { value: 'ml', label: 'Mililitros' },
    { value: 'paquete', label: 'Paquetes' },
    { value: 'docena', label: 'Docenas' },
    { value: 'caja', label: 'Cajas' }
  ];

  // Cargar modificadores existentes del producto
  const [modifierGroups, setModifierGroups] = useState([]);
  const [hasModifiers, setHasModifiers] = useState(false);
  const [loadingModifiers, setLoadingModifiers] = useState(true);

  useEffect(() => {
    if (product?.id && allInventory.length > 0) {
      // Buscar grupos de modificadores relacionados a este producto
      const groups = allInventory.filter(
        item => item.item_type === 'modifier_group' && item.related_item_id === product.id
      );

      const loadedGroups = groups.map(group => {
        // Buscar opciones de cada grupo
        const options = allInventory.filter(
          item => item.item_type === 'modifier_option' && item.related_item_id === group.id
        );

        return {
          id: group.id,
          dbId: group.id, // ID real en la base de datos
          name: group.product_name,
          min_selection: group.min_selection || 1,
          max_selection: group.max_selection || 1,
          options: options.map(opt => ({
            id: opt.id,
            dbId: opt.id,
            name: opt.product_name,
            extra_price: opt.unit_price || 0
          }))
        };
      });

      setModifierGroups(loadedGroups);
      setHasModifiers(loadedGroups.length > 0);
      setLoadingModifiers(false);
    } else {
      setLoadingModifiers(false);
    }
  }, [product?.id, allInventory]);

  // Agregar nuevo grupo
  const addModifierGroup = () => {
    setModifierGroups([
      ...modifierGroups,
      {
        id: `new_${Date.now()}`,
        name: '',
        min_selection: 1,
        max_selection: 1,
        options: [],
        isNew: true
      }
    ]);
  };

  // Eliminar grupo
  const removeModifierGroup = (groupId) => {
    setModifierGroups(modifierGroups.filter(g => g.id !== groupId));
  };

  // Actualizar grupo
  const updateGroup = (groupId, field, value) => {
    setModifierGroups(modifierGroups.map(g => 
      g.id === groupId ? { ...g, [field]: value } : g
    ));
  };

  // Agregar opción
  const addOption = (groupId) => {
    setModifierGroups(modifierGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          options: [...g.options, { id: `new_${Date.now()}`, name: '', extra_price: 0, isNew: true }]
        };
      }
      return g;
    }));
  };

  // Eliminar opción
  const removeOption = (groupId, optionId) => {
    setModifierGroups(modifierGroups.map(g => {
      if (g.id === groupId) {
        return { ...g, options: g.options.filter(o => o.id !== optionId) };
      }
      return g;
    }));
  };

  // Actualizar opción
  const updateOption = (groupId, optionId, field, value) => {
    setModifierGroups(modifierGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          options: g.options.map(o => 
            o.id === optionId ? { ...o, [field]: value } : o
          )
        };
      }
      return g;
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const productData = {
      restaurant_id: formData.restaurant_id,
      product_name: formData.product_name,
      item_type: 'product',
      category: formData.category || null,
      subcategory: formData.subcategory || null,
      unit_price: parseFloat(formData.unit_price) || 0,
      unit_of_measure: formData.unit_of_measure || 'unidad',
      current_stock: parseFloat(formData.current_stock) || 0,
      warning_stock: parseFloat(formData.warning_stock) || 0,
      min_stock: parseFloat(formData.min_stock) || 0,
      is_active: true
    };

    const modifiers = hasModifiers ? modifierGroups.filter(g => g.name && g.options.length > 0) : [];

    onSubmit({ 
      product: productData, 
      modifierGroups: modifiers,
      productId: product.id
    });
  };

  if (loadingModifiers) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-500">Cargando modificadores...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos básicos */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Información del Producto</h3>
            <p className="text-xs text-gray-500">Datos básicos del producto</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Restaurante *</Label>
            <Select
              value={formData.restaurant_id}
              onValueChange={(v) => setFormData({ ...formData, restaurant_id: v })}
            >
              <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500">
                <SelectValue placeholder="Seleccionar restaurante..." />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Nombre del Producto *</Label>
            <Input
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              className="h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Categoría</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData({ ...formData, category: v })}
            >
              <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm">
                <SelectValue placeholder="Seleccionar categoría..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Subcategoría</Label>
            {subcategories.length > 0 ? (
              <Select
                value={formData.subcategory}
                onValueChange={(v) => setFormData({ ...formData, subcategory: v })}
              >
                <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm">
                  <SelectValue placeholder="Seleccionar subcategoría..." />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                className="h-11 rounded-xl border-gray-200 bg-white shadow-sm"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-green-600" />
              Precio *
            </Label>
            <Input
              type="number"
              step="0.01"
              value={formData.unit_price}
              onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
              className="h-11 rounded-xl border-gray-200 bg-white shadow-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Unidad de Medida</Label>
            <Select
              value={formData.unit_of_measure}
              onValueChange={(v) => setFormData({ ...formData, unit_of_measure: v })}
            >
              <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm">
                <SelectValue placeholder="Unidad..." />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map(unit => (
                  <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Archive className="w-3.5 h-3.5 text-blue-600" />
              Stock Actual
            </Label>
            <Input
              type="number"
              step="0.01"
              value={formData.current_stock}
              onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
              className="h-11 rounded-xl border-gray-200 bg-white shadow-sm"
            />
          </div>
        </div>

        {/* Alertas de Stock */}
        <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/50 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-900">Alertas de Stock</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-amber-700">Stock Advertencia 🟠</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.warning_stock}
                onChange={(e) => setFormData({ ...formData, warning_stock: e.target.value })}
                placeholder="Ej: 10"
                className="h-10 rounded-xl border-amber-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-amber-700">Stock Crítico 🔴</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.min_stock}
                onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                placeholder="Ej: 5"
                className="h-10 rounded-xl border-amber-200 bg-white"
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Toggle para modificadores */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200/50 rounded-xl hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Modificadores</p>
                <p className="text-xs text-gray-500">
                  {modifierGroups.length > 0 
                    ? `${modifierGroups.length} grupo(s) configurado(s)`
                    : 'Sin modificadores'
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={hasModifiers}
              onCheckedChange={setHasModifiers}
              className="data-[state=checked]:bg-purple-600"
            />
          </div>
        </Card>
      </motion.div>

      {/* Grupos de modificadores */}
      {hasModifiers && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Grupos de Modificadores</Label>
            <Button type="button" variant="outline" size="sm" onClick={addModifierGroup}>
              <Plus className="w-4 h-4 mr-1" /> Agregar Grupo
            </Button>
          </div>

          {modifierGroups.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed rounded-lg text-gray-400">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No hay grupos de modificadores</p>
              <Button type="button" variant="ghost" size="sm" onClick={addModifierGroup} className="mt-2">
                <Plus className="w-4 h-4 mr-1" /> Crear primer grupo
              </Button>
            </div>
          )}

          {modifierGroups.map((group) => (
            <Card key={group.id} className="p-4 border-purple-100">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <Label className="text-xs">Nombre del Grupo</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={group.name}
                          onChange={(e) => updateGroup(group.id, 'name', e.target.value)}
                          placeholder="Ej: Tipo de Pan"
                        />
                        {!group.isNew && (
                          <Badge variant="outline" className="text-xs shrink-0">Existente</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Mín. Selección</Label>
                      <Input
                        type="number"
                        min="0"
                        value={group.min_selection}
                        onChange={(e) => updateGroup(group.id, 'min_selection', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Máx. Selección</Label>
                      <Input
                        type="number"
                        min="1"
                        value={group.max_selection}
                        onChange={(e) => updateGroup(group.id, 'max_selection', parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeModifierGroup(group.id)}
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                </div>

                <div className="pl-4 border-l-2 border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 uppercase">Opciones</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => addOption(group.id)}>
                      <Plus className="w-3 h-3 mr-1" /> Opción
                    </Button>
                  </div>

                  {group.options.length === 0 && (
                    <p className="text-sm text-gray-400 py-2">Sin opciones - agrega al menos una</p>
                  )}

                  {group.options.map((option) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <Input
                        value={option.name}
                        onChange={(e) => updateOption(group.id, option.id, 'name', e.target.value)}
                        placeholder="Nombre de la opción"
                        className="flex-1"
                      />
                      <div className="w-28 flex items-center gap-1">
                        <span className="text-xs text-gray-400">+$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={option.extra_price}
                          onChange={(e) => updateOption(group.id, option.id, 'extra_price', parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                      </div>
                      {!option.isNew && (
                        <Badge variant="outline" className="text-xs shrink-0">✓</Badge>
                      )}
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeOption(group.id, option.id)}
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-5 border-t border-gray-100">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          className="rounded-xl px-6 hover:bg-gray-50"
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          className="rounded-xl px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200 transition-all duration-300"
          disabled={!formData.product_name || !formData.restaurant_id || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>
    </form>
  );
}