import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Loader2, Package, Search, Truck } from "lucide-react";
import { motion } from "framer-motion";

export default function WarehouseTransferDialog({
  open,
  onOpenChange,
  restaurants = [],
  supplyItems = [],
  onTransfer,
  isLoading = false
}) {
  const [fromRestaurantId, setFromRestaurantId] = useState('');
  const [toRestaurantId, setToRestaurantId] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); // [{supplyId, name, quantity, unit, maxStock}]
  const [searchTerm, setSearchTerm] = useState('');

  // Insumos del restaurante origen
  const fromItems = useMemo(() => {
    if (!fromRestaurantId) return [];
    return supplyItems.filter(s => s.restaurant_id === fromRestaurantId && s.is_active !== false);
  }, [supplyItems, fromRestaurantId]);

  // Filtrar insumos por búsqueda
  const filteredFromItems = useMemo(() => {
    if (!searchTerm) return fromItems;
    return fromItems.filter(s =>
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [fromItems, searchTerm]);

  // Restaurantes destino (excluir el origen)
  const toRestaurants = useMemo(() => {
    return restaurants.filter(r => r.id !== fromRestaurantId);
  }, [restaurants, fromRestaurantId]);

  const handleAddItem = (item) => {
    if (selectedItems.find(s => s.supplyId === item.id)) return;
    setSelectedItems(prev => [...prev, {
      supplyId: item.id,
      name: item.name,
      category: item.category,
      quantity: 1,
      unit: item.unit_of_measure,
      maxStock: item.current_stock || 0,
      averageCost: item.average_unit_cost || 0
    }]);
  };

  const handleRemoveItem = (supplyId) => {
    setSelectedItems(prev => prev.filter(s => s.supplyId !== supplyId));
  };

  const handleQuantityChange = (supplyId, qty) => {
    setSelectedItems(prev => prev.map(s =>
      s.supplyId === supplyId ? { ...s, quantity: Math.max(0, Math.min(qty, s.maxStock)) } : s
    ));
  };

  const handleSubmit = () => {
    if (!fromRestaurantId || !toRestaurantId || selectedItems.length === 0) return;
    const validItems = selectedItems.filter(s => s.quantity > 0);
    if (validItems.length === 0) return;

    onTransfer({
      fromRestaurantId,
      toRestaurantId,
      items: validItems
    });
  };

  const handleClose = () => {
    setFromRestaurantId('');
    setToRestaurantId('');
    setSelectedItems([]);
    setSearchTerm('');
    onOpenChange(false);
  };

  const fromRestaurant = restaurants.find(r => r.id === fromRestaurantId);
  const toRestaurant = restaurants.find(r => r.id === toRestaurantId);
  const totalItems = selectedItems.filter(s => s.quantity > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="block text-xl font-bold">Traspaso entre Bodegas</span>
                <span className="text-sm font-normal text-white/70">Mueve insumos de un restaurante a otro</span>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Selección Origen → Destino */}
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Origen (Bodega)</Label>
              <Select value={fromRestaurantId} onValueChange={(val) => {
                setFromRestaurantId(val);
                setToRestaurantId('');
                setSelectedItems([]);
              }}>
                <SelectTrigger className="h-12 rounded-xl border-gray-200 bg-white shadow-sm">
                  <SelectValue placeholder="¿De dónde envías?" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-indigo-600" />
              </div>
            </div>

            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Destino (Bodega)</Label>
              <Select value={toRestaurantId} onValueChange={setToRestaurantId} disabled={!fromRestaurantId}>
                <SelectTrigger className="h-12 rounded-xl border-gray-200 bg-white shadow-sm">
                  <SelectValue placeholder="¿A dónde envías?" />
                </SelectTrigger>
                <SelectContent>
                  {toRestaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selección de Insumos */}
          {fromRestaurantId && toRestaurantId && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seleccionar Insumos a Traspasar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar insumo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 rounded-xl border-gray-200"
                  />
                </div>
              </div>

              {/* Lista de insumos disponibles */}
              <div className="border rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                {filteredFromItems.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {filteredFromItems.map(item => {
                      const isSelected = selectedItems.find(s => s.supplyId === item.id);
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => isSelected ? handleRemoveItem(item.id) : handleAddItem(item)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                            }`}>
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-700">{item.current_stock || 0} {item.unit_of_measure}</p>
                            <p className="text-xs text-gray-400">Disponible</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{fromItems.length === 0 ? 'Sin insumos en este restaurante' : 'No se encontraron resultados'}</p>
                  </div>
                )}
              </div>

              {/* Items seleccionados con cantidad */}
              {selectedItems.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Cantidades a Traspasar ({totalItems} insumos)
                  </Label>
                  <div className="space-y-2">
                    {selectedItems.map(item => (
                      <motion.div
                        key={item.supplyId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            Stock actual: {item.maxStock} {item.unit} • {item.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.supplyId, parseFloat(e.target.value) || 0)}
                            min={0}
                            max={item.maxStock}
                            step="0.1"
                            className="w-24 h-9 text-center rounded-lg border-indigo-200"
                          />
                          <span className="text-xs text-gray-500 w-8">{item.unit}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.supplyId)}
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                          >
                            ×
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50/50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {fromRestaurant && toRestaurant && totalItems > 0 && (
              <span>
                <strong>{fromRestaurant.name}</strong> → <strong>{toRestaurant.name}</strong> • {totalItems} insumo{totalItems !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !fromRestaurantId || !toRestaurantId || totalItems === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
              ) : (
                <><Truck className="w-4 h-4 mr-2" />Realizar Traspaso</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}