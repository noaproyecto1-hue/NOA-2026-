import React, { useMemo, useState } from 'react';
// recipeSamples now received as prop from parent (no duplicate query)
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChefHat, FlaskConical, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus, TrendingUp, Trophy } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/components/utils/currencyHelper';
import DeviationRankingPanel from '@/components/inventory/DeviationRankingPanel';

function RecipeDeviationCard({ recipe, samples, supplyItems, currency, isExpanded, onToggle }) {
  // Calculate average deviation per ingredient across all samples
  const ingredientDeviations = useMemo(() => {
    if (samples.length === 0) return [];

    const ingredientMap = {};
    samples.forEach(sample => {
      (sample.ingredients || []).forEach(ing => {
        if (!ingredientMap[ing.supply_name]) {
          ingredientMap[ing.supply_name] = {
            supply_name: ing.supply_name,
            supply_id: ing.supply_id,
            unit: ing.unit,
            deviations: [],
            expectedQuantities: [],
            actualQuantities: []
          };
        }
        ingredientMap[ing.supply_name].deviations.push(ing.deviation_percent || 0);
        ingredientMap[ing.supply_name].expectedQuantities.push(ing.expected_quantity || 0);
        ingredientMap[ing.supply_name].actualQuantities.push(ing.actual_quantity || 0);
      });
    });

    return Object.values(ingredientMap).map(ing => {
      const avgDeviation = ing.deviations.reduce((s, d) => s + d, 0) / ing.deviations.length;
      const avgExpected = ing.expectedQuantities.reduce((s, q) => s + q, 0) / ing.expectedQuantities.length;
      const avgActual = ing.actualQuantities.reduce((s, q) => s + q, 0) / ing.actualQuantities.length;
      const avgDeviationQty = avgActual - avgExpected;
      const supply = supplyItems.find(s => s.name === ing.supply_name || s.id === ing.supply_id);
      const unitCost = supply?.average_unit_cost || 0;
      const deviationCost = Math.abs(avgDeviationQty) * unitCost;

      return {
        ...ing,
        avgDeviation: Math.round(avgDeviation * 10) / 10,
        avgExpected: Math.round(avgExpected * 1000) / 1000,
        avgActual: Math.round(avgActual * 1000) / 1000,
        avgDeviationQty: Math.round(avgDeviationQty * 1000) / 1000,
        unitCost,
        deviationCost,
        sampleCount: ing.deviations.length
      };
    }).sort((a, b) => Math.abs(b.avgDeviation) - Math.abs(a.avgDeviation));
  }, [samples, supplyItems]);

  const overallDeviation = samples.length > 0
    ? samples.reduce((s, sample) => s + (sample.overall_deviation_percent || 0), 0) / samples.length
    : 0;

  const totalDeviationCost = ingredientDeviations.reduce((s, i) => s + (i.avgDeviationQty > 0 ? i.deviationCost : 0), 0);
  const criticalIngredients = ingredientDeviations.filter(i => Math.abs(i.avgDeviation) > 15);

  const getSeverityColor = (deviation) => {
    const abs = Math.abs(deviation);
    if (abs <= 5) return 'emerald';
    if (abs <= 15) return 'amber';
    return 'red';
  };

  const severityColor = getSeverityColor(overallDeviation);

  return (
    <Card className={`border transition-all hover:shadow-lg ${isExpanded ? 'shadow-lg ring-1 ring-indigo-200' : 'border-gray-100'}`}>
      <CardContent className="p-0">
        {/* Header clickable */}
        <button onClick={onToggle} className="w-full p-4 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors">
          {/* Recipe image/icon */}
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 shadow-md">
            {recipe.photo_url ? (
              <img src={recipe.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${
                severityColor === 'red' ? 'from-red-500 to-rose-600' :
                severityColor === 'amber' ? 'from-amber-500 to-orange-600' :
                'from-emerald-500 to-green-600'
              }`}>
                <ChefHat className="w-7 h-7 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900 truncate">{recipe.dish_name}</p>
              <Badge className="bg-gray-100 text-gray-600 border-0 text-xs shrink-0">{recipe.category}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">
                <FlaskConical className="w-3 h-3 inline mr-0.5" />
                {samples.length} muestreo{samples.length !== 1 ? 's' : ''}
              </span>
              {criticalIngredients.length > 0 && (
                <span className="text-xs text-red-600 font-medium">
                  {criticalIngredients.length} ingrediente{criticalIngredients.length !== 1 ? 's' : ''} crítico{criticalIngredients.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Deviation score */}
          <div className="text-right shrink-0">
            <div className={`text-xl font-black ${
              severityColor === 'red' ? 'text-red-600' :
              severityColor === 'amber' ? 'text-amber-600' :
              'text-emerald-600'
            }`}>
              {overallDeviation > 0 ? '+' : ''}{overallDeviation.toFixed(1)}%
            </div>
            {totalDeviationCost > 0 && (
              <p className="text-xs text-gray-500">{formatCurrency(totalDeviationCost, currency)} extra</p>
            )}
          </div>

          {/* Expand arrow */}
          <div className="shrink-0">
            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>
        </button>

        {/* Expanded detail */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 border-t border-gray-100">
                <div className="mt-3 space-y-1.5">
                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-400 uppercase font-bold tracking-wider px-3 py-1">
                    <div className="col-span-3">Ingrediente</div>
                    <div className="col-span-2 text-right">Estándar</div>
                    <div className="col-span-2 text-right">Real Prom.</div>
                    <div className="col-span-2 text-right">Desviación</div>
                    <div className="col-span-3 text-right">% Desv.</div>
                  </div>

                  {ingredientDeviations.map((ing, idx) => {
                    const color = getSeverityColor(ing.avgDeviation);
                    const isCritical = Math.abs(ing.avgDeviation) > 15;
                    return (
                      <motion.div
                        key={ing.supply_name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-lg text-sm ${
                          color === 'red' ? 'bg-red-50 border-2 border-red-200 shadow-sm' :
                          color === 'amber' ? 'bg-amber-50 border border-amber-100' :
                          'bg-gray-50 border border-gray-100'
                        }`}
                      >
                        <div className="col-span-3">
                          <div className="flex items-center gap-1.5">
                            {isCritical && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
                            <p className={`font-medium text-xs truncate ${isCritical ? 'text-red-800 font-bold' : 'text-gray-900'}`}>{ing.supply_name}</p>
                          </div>
                          <p className="text-[10px] text-gray-400">{ing.unit}</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="text-xs text-gray-600 font-mono">{ing.avgExpected}</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="text-xs font-semibold font-mono">{ing.avgActual}</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className={`text-xs font-bold font-mono ${
                            ing.avgDeviationQty > 0 ? 'text-red-600' : 
                            ing.avgDeviationQty < 0 ? 'text-emerald-600' : 'text-gray-500'
                          }`}>
                            {ing.avgDeviationQty > 0 ? '+' : ''}{ing.avgDeviationQty} {ing.unit}
                          </p>
                        </div>
                        <div className="col-span-3 text-right flex items-center justify-end gap-1">
                          <Badge className={`border-0 text-xs font-bold ${
                            color === 'red' ? 'bg-red-100 text-red-700' :
                            color === 'amber' ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {ing.avgDeviation > 0 && <ArrowUp className="w-3 h-3 mr-0.5" />}
                            {ing.avgDeviation < 0 && <ArrowDown className="w-3 h-3 mr-0.5" />}
                            {ing.avgDeviation === 0 && <Minus className="w-3 h-3 mr-0.5" />}
                            {Math.abs(ing.avgDeviation).toFixed(1)}%
                          </Badge>
                        </div>
                      </motion.div>
                    );
                  })}

                  {ingredientDeviations.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">Sin datos de ingredientes en los muestreos</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default function DeviationPanel({
  inventoryCounts = [],
  wasteRecords = [],
  supplyItems = [],
  supplyCosts = [],
  stockMovements = [],
  recipes = [],
  recipeSamples = [],
  selectedRestaurant = 'all',
  currency = 'USD'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('current');
  const [expandedRecipeId, setExpandedRecipeId] = useState(null);
  const [showRanking, setShowRanking] = useState(false);

  const currentMonth = useMemo(() => {
    const now = new Date();
    if (filterMonth === 'current') return now.toISOString().slice(0, 7);
    if (filterMonth === 'last') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.toISOString().slice(0, 7);
    }
    return null; // all
  }, [filterMonth]);

  // Use recipeSamples passed from parent — filtered by month locally
  const allSamples = useMemo(() => {
    let samples = recipeSamples.filter(s => selectedRestaurant === 'all' || s.restaurant_id === selectedRestaurant);
    if (currentMonth) {
      samples = samples.filter(s => s.month === currentMonth);
    }
    return samples;
  }, [recipeSamples, selectedRestaurant, currentMonth]);

  // Group samples by recipe and compute ranking
  const recipeRanking = useMemo(() => {
    const filteredRecipes = recipes.filter(r => {
      if (selectedRestaurant !== 'all' && r.restaurant_id !== selectedRestaurant) return false;
      if (r.is_sub_recipe) return false;
      return true;
    });

    const ranking = filteredRecipes.map(recipe => {
      const recipeSamples = allSamples.filter(s => s.recipe_id === recipe.id);
      const avgDeviation = recipeSamples.length > 0
        ? recipeSamples.reduce((s, sample) => s + (sample.overall_deviation_percent || 0), 0) / recipeSamples.length
        : 0;

      // Check if any individual ingredient exceeds 15%
      let hasCriticalIngredient = false;
      recipeSamples.forEach(sample => {
        (sample.ingredients || []).forEach(ing => {
          if (Math.abs(ing.deviation_percent || 0) > 15) {
            hasCriticalIngredient = true;
          }
        });
      });

      return {
        recipe,
        samples: recipeSamples,
        avgDeviation,
        sampleCount: recipeSamples.length,
        hasCriticalIngredient
      };
    }).filter(r => r.sampleCount > 0); // Only show recipes with samples

    return ranking.sort((a, b) => Math.abs(b.avgDeviation) - Math.abs(a.avgDeviation));
  }, [recipes, allSamples, selectedRestaurant]);

  const filtered = recipeRanking.filter(r =>
    !searchTerm || r.recipe.dish_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRecipesWithDeviation = filtered.filter(r => Math.abs(r.avgDeviation) > 5).length;
  const criticalRecipes = filtered.filter(r => r.hasCriticalIngredient).length;
  const avgOverallDeviation = filtered.length > 0
    ? filtered.reduce((s, r) => s + Math.abs(r.avgDeviation), 0) / filtered.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar receta..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10 rounded-xl" />
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[160px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Este mes</SelectItem>
            <SelectItem value="last">Mes anterior</SelectItem>
            <SelectItem value="all">Todo</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => setShowRanking(!showRanking)}
          className={`flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold transition-all ${
            showRanking 
              ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg' 
              : 'border border-violet-200 text-violet-600 hover:bg-violet-50'
          }`}
        >
          🏆 Ranking
        </button>
      </div>

      {/* Ranking de ingredientes */}
      {showRanking && (
        <DeviationRankingPanel
          samples={allSamples}
          supplyItems={supplyItems}
          currency={currency}
        />
      )}

      {/* Explanation */}
      <Card className="bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FlaskConical className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">Ranking de Desviación por Receta</p>
              <p className="text-xs text-indigo-600 mt-1">
                Basado en los <strong>muestreos</strong> realizados por los cocineros. Cada receta muestra el % promedio de desviación entre la cantidad estándar y la cantidad real usada. 
                Toca una receta para ver el desglose por ingrediente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Desviación Promedio</p>
            <p className="text-2xl font-black text-indigo-700 mt-1">{avgOverallDeviation.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Recetas con Desviación</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{totalRecipesWithDeviation}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Críticas (&gt;15%)</p>
            <p className="text-2xl font-black text-red-700 mt-1">{criticalRecipes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Total samples */}
      {allSamples.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FlaskConical className="w-3.5 h-3.5" />
          {allSamples.length} muestreo{allSamples.length !== 1 ? 's' : ''} en {filtered.length} receta{filtered.length !== 1 ? 's' : ''} · {filterMonth === 'current' ? 'Este mes' : filterMonth === 'last' ? 'Mes anterior' : 'Todo'}
        </div>
      )}

      {/* Recipe ranking list */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((item, idx) => (
            <motion.div key={item.recipe.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <RecipeDeviationCard
                recipe={item.recipe}
                samples={item.samples}
                supplyItems={supplyItems}
                currency={currency}
                isExpanded={expandedRecipeId === item.recipe.id}
                onToggle={() => setExpandedRecipeId(expandedRecipeId === item.recipe.id ? null : item.recipe.id)}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FlaskConical className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay muestreos registrados</p>
            <p className="text-sm text-gray-400 mt-1">
              Los muestreos se realizan desde Cocina → Muestreos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}