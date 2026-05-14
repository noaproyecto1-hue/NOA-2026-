import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Save, Loader2, AlertTriangle, Percent } from "lucide-react";
import { motion } from 'framer-motion';

const ITEMS_PER_PAGE = 30;

export default function YieldPanel({ supplyItems = [], selectedRestaurant = 'all', currency = 'USD' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const queryClient = useQueryClient();

  const filteredItems = useMemo(() => {
    return supplyItems
      .filter(s => selectedRestaurant === 'all' || s.restaurant_id === selectedRestaurant)
      .filter(s => !searchTerm || s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.category?.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (a.yield_percentage || 100) - (b.yield_percentage || 100));
  }, [supplyItems, selectedRestaurant, searchTerm]);

  // Reset visible count when search changes
  React.useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [searchTerm]);

  const paginatedItems = filteredItems.slice(0, visibleCount);
  const hasMore = filteredItems.length > visibleCount;

  const itemsWithYield = filteredItems.filter(s => s.yield_percentage && s.yield_percentage < 100);
  const avgYield = itemsWithYield.length > 0
    ? itemsWithYield.reduce((sum, s) => sum + s.yield_percentage, 0) / itemsWithYield.length
    : 100;

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditValue(String(item.yield_percentage ?? 100));
  };

  const handleSave = async (item) => {
    const val = Math.min(100, Math.max(1, parseInt(editValue) || 100));
    setSaving(true);
    await base44.entities.SupplyItem.update(item.id, { yield_percentage: val });
    queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
    queryClient.invalidateQueries({ queryKey: ['mySupplyItems'] });
    setEditingId(null);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-amber-900 text-sm">¿Qué es el rendimiento?</p>
          <p className="text-xs text-amber-700 mt-1">
            Es el porcentaje del insumo que realmente se puede usar después de limpiarlo o procesarlo. 
            Por ejemplo, si compras 10 kg de pollo pero solo 8 kg son utilizables, el rendimiento es <strong>80%</strong>. 
            Esto ajusta automáticamente el costo real en las recetas.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Insumos con Rendimiento</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{itemsWithYield.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Rendimiento Promedio</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{avgYield.toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Insumos</p>
            <p className="text-2xl font-black text-gray-700 mt-1">{filteredItems.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar insumo..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-10 rounded-xl"
        />
      </div>

      {/* List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {paginatedItems.map((item, idx) => {
          const yieldPct = item.yield_percentage ?? 100;
          const isEditing = editingId === item.id;
          const hasCustomYield = yieldPct < 100;
          const adjustedCost = hasCustomYield
            ? (item.average_unit_cost || 0) / (yieldPct / 100)
            : item.average_unit_cost || 0;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.01 }}
            >
              <div className={`flex items-center justify-between p-4 bg-white rounded-xl border transition-all hover:shadow-md ${hasCustomYield ? 'border-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${hasCustomYield ? 'bg-amber-100' : 'bg-gray-100'}`}>
                    <Percent className={`w-5 h-5 ${hasCustomYield ? 'text-amber-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{item.category}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">${(item.average_unit_cost || 0).toFixed(2)}/{item.unit_of_measure}</span>
                      {hasCustomYield && (
                        <>
                          <span className="text-xs text-gray-400">→</span>
                          <span className="text-xs font-semibold text-amber-700">${adjustedCost.toFixed(2)}/{item.unit_of_measure} real</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-20 h-9 text-center rounded-lg"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(item); if (e.key === 'Escape') setEditingId(null); }}
                      />
                      <span className="text-sm text-gray-500">%</span>
                      <Button size="sm" onClick={() => handleSave(item)} disabled={saving} className="h-9 rounded-lg bg-green-600 hover:bg-green-700">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </Button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(item)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
                        hasCustomYield
                          ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {yieldPct}%
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs mt-2"
            onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)}
          >
            Cargar más ({filteredItems.length - visibleCount} restantes)
          </Button>
        )}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Percent className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No hay insumos disponibles</p>
        </div>
      )}
    </div>
  );
}