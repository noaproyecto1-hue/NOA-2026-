import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, DollarSign, Building2, ArrowRight } from "lucide-react";
import { normalizeSupplyCategories, serializeSupplyCategories } from '@/components/utils/supplyCategoryHelper';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Clasificador de categorías de insumos.
 * 
 * Cada categoría de insumo se clasifica como:
 * - Food Cost: va al Costo de Ventas
 * - Centro de Costo: va a un centro de costo OPEX específico.
 *   La categoría del insumo actúa como la subcategoría natural dentro del centro.
 *   Ejemplo: "ARTICULOS DE ASEO" → HIGIENE E INOCUIDAD (la categoría = subcategoría)
 */
export default function SupplyCategoryClassifier({ categories = [], costCenters = [], onUpdate }) {
  const [newCatName, setNewCatName] = useState('');
  const normalized = normalizeSupplyCategories(categories);

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    if (normalized.find(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())) return;
    const updated = [...normalized, { name: newCatName.trim(), cost_type: 'food_cost' }];
    onUpdate(serializeSupplyCategories(updated));
    setNewCatName('');
  };

  const handleRemove = (name) => {
    const updated = normalized.filter(c => c.name !== name);
    onUpdate(serializeSupplyCategories(updated));
  };

  const handleChangeCostType = (name, costType) => {
    const updated = normalized.map(c => {
      if (c.name !== name) return c;
      if (costType === 'food_cost') {
        return { name: c.name, cost_type: 'food_cost' };
      }
      // Auto-assign first cost center
      return { 
        ...c, 
        cost_type: 'cost_center', 
        cost_center_name: c.cost_center_name || costCenters[0]?.name || '',
        cost_center_category: '' // the category name itself is the subcategory
      };
    });
    onUpdate(serializeSupplyCategories(updated));
  };

  const handleChangeCostCenter = (name, centerName) => {
    const updated = normalized.map(c =>
      c.name === name ? { ...c, cost_center_name: centerName, cost_center_category: '' } : c
    );
    onUpdate(serializeSupplyCategories(updated));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        <AnimatePresence>
          {normalized.map((cat) => {
            const isFoodCost = cat.cost_type !== 'cost_center';

            return (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-3 rounded-xl border ${isFoodCost ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Name */}
                  <Badge className={`${isFoodCost ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-0 font-semibold px-3 py-1`}>
                    {cat.name}
                  </Badge>

                  {/* Cost type selector */}
                  <Select
                    value={cat.cost_type || 'food_cost'}
                    onValueChange={(val) => handleChangeCostType(cat.name, val)}
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs border-gray-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="food_cost">
                        <span className="flex items-center gap-1.5">
                          <DollarSign className="w-3 h-3 text-emerald-600" /> Food Cost
                        </span>
                      </SelectItem>
                      <SelectItem value="cost_center">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-amber-600" /> Centro de Costo
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Cost center selector (only if cost_center) */}
                  {!isFoodCost && (
                    <>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                      <Select
                        value={cat.cost_center_name || ''}
                        onValueChange={(val) => handleChangeCostCenter(cat.name, val)}
                      >
                        <SelectTrigger className="h-8 w-[200px] text-xs border-gray-200 bg-white">
                          <SelectValue placeholder="Seleccionar centro..." />
                        </SelectTrigger>
                        <SelectContent>
                          {costCenters.map(cc => (
                            <SelectItem key={cc.name} value={cc.name}>{cc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(cat.name)}
                    className="ml-auto hover:bg-black/10 rounded-full p-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>

                {/* Explanation for cost center assignment */}
                {!isFoodCost && cat.cost_center_name && (
                  <p className="text-[10px] text-amber-600 mt-1.5 ml-1">
                    En el Estado de Resultados aparecerá en <span className="font-semibold">{cat.cost_center_name}</span> → <span className="font-semibold">{cat.name}</span>
                  </p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {normalized.length === 0 && (
          <span className="text-sm text-gray-400 italic">Sin categorías</span>
        )}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <Input
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="Nueva categoría de insumo..."
          className="flex-1 h-10"
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} size="sm" className="h-10 px-4 bg-gray-900 hover:bg-gray-800">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}