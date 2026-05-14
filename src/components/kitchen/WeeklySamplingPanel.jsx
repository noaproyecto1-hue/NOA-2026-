import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, CheckCircle2, Search, ChefHat, Settings } from "lucide-react";
import SamplingFormDialog from './SamplingFormDialog';
import SamplingConfigDialog from './SamplingConfigDialog';

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default function WeeklySamplingPanel({ 
  recipes = [], 
  restaurantId, 
  restaurant = null,
  isManager = false,
  recipeCategories = [] 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showSamplingForm, setShowSamplingForm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: deviationConfig } = useQuery({
    queryKey: ['deviationConfig', restaurantId],
    queryFn: async () => {
      const configs = await base44.entities.DeviationConfig.filter({ restaurant_id: restaurantId });
      return configs[0] || null;
    },
    enabled: !!restaurantId
  });

  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentMonth = now.toISOString().slice(0, 7);

  const { data: allSamples = [] } = useQuery({
    queryKey: ['recipeSamples', restaurantId, currentMonth],
    queryFn: async () => {
      const samples = await base44.entities.RecipeSample.filter({ restaurant_id: restaurantId });
      return samples.filter(s => s.month === currentMonth);
    },
    enabled: !!restaurantId
  });

  const samplesPerRecipe = deviationConfig?.samples_per_recipe_per_month || 3;
  const samplesPerWeek = Math.ceil(samplesPerRecipe / 4);
  const isActive = deviationConfig?.is_active !== false;
  const selectedCats = deviationConfig?.selected_categories || [];
  const assignmentMode = deviationConfig?.assignment_mode || 'auto';
  const manualRecipeIds = deviationConfig?.manual_weekly_recipes || [];

  // Filter recipes based on config categories
  const eligibleRecipes = useMemo(() => {
    let filtered = recipes.filter(r => r.restaurant_id === restaurantId && !r.is_sub_recipe);
    if (selectedCats.length > 0) {
      filtered = filtered.filter(r => selectedCats.includes(r.category));
    }
    return filtered;
  }, [recipes, restaurantId, selectedCats]);

  // Fetch sales data for smart rotation (count sold per recipe name)
  const { data: salesData = [] } = useQuery({
    queryKey: ['salesForSampling', restaurantId, currentMonth],
    queryFn: async () => {
      const sales = await base44.entities.Sale.filter({ restaurant_id: restaurantId });
      // Filter current month sales
      return sales.filter(s => s.date_time?.startsWith(currentMonth));
    },
    enabled: !!restaurantId && assignmentMode === 'auto'
  });

  // Count quantity sold per recipe name (for ranking)
  const salesCountByRecipe = useMemo(() => {
    const counts = {};
    salesData.forEach(sale => {
      if (sale.is_cancelled) return;
      (sale.products || []).forEach(p => {
        if (p.is_cancelled || p.is_combo_container) return;
        const name = (p.product_name || '').toLowerCase().trim();
        counts[name] = (counts[name] || 0) + (p.quantity || 1);
      });
    });
    return counts;
  }, [salesData]);

  // Smart Rotation: distribute recipes across 4 weeks by sales volume
  const weeklyAssignments = useMemo(() => {
    if (!isActive || eligibleRecipes.length === 0) return [];

    // Count samples per recipe this month
    const sampleCountByRecipe = {};
    allSamples.forEach(s => {
      sampleCountByRecipe[s.recipe_id] = (sampleCountByRecipe[s.recipe_id] || 0) + 1;
    });

    // Get week-of-month (1-4)
    const dayOfMonth = now.getDate();
    const weekOfMonth = Math.min(4, Math.ceil(dayOfMonth / 7));

    let thisWeekGroup = [];
    let sorted = [];

    if (assignmentMode === 'manual') {
      // MANUAL: use the manually selected recipes
      thisWeekGroup = eligibleRecipes.filter(r => manualRecipeIds.includes(r.id));
      sorted = thisWeekGroup;
    } else {
      // AUTO: Sort by sales volume (most sold first), then alphabetically for ties
      sorted = [...eligibleRecipes].sort((a, b) => {
        const aSales = salesCountByRecipe[(a.dish_name || '').toLowerCase().trim()] || 0;
        const bSales = salesCountByRecipe[(b.dish_name || '').toLowerCase().trim()] || 0;
        if (bSales !== aSales) return bSales - aSales; // Most sold first
        return (a.dish_name || '').localeCompare(b.dish_name || '');
      });

      const recipesPerWeek = Math.ceil(sorted.length / 4);

      // Get this week's group (week 1 = top sellers, week 2 = next, etc.)
      const weekStart = (weekOfMonth - 1) * recipesPerWeek;
      thisWeekGroup = sorted.slice(weekStart, weekStart + recipesPerWeek);
    }

    // If any recipes from other weeks still need samples, add them (priority fill)
    const extraRecipes = sorted.filter(r => {
      if (thisWeekGroup.find(g => g.id === r.id)) return false;
      const monthCount = sampleCountByRecipe[r.id] || 0;
      return monthCount < samplesPerRecipe;
    });

    // Combine: this week's group first, then extras sorted by fewest samples
    const combined = [
      ...thisWeekGroup,
      ...extraRecipes.sort((a, b) => 
        (sampleCountByRecipe[a.id] || 0) - (sampleCountByRecipe[b.id] || 0)
      )
    ];

    // Remove duplicates
    const seen = new Set();
    const unique = combined.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return unique.map(recipe => {
      const thisWeekSamples = allSamples.filter(s => 
        s.recipe_id === recipe.id && s.week_number === currentWeek
      );
      const monthTotal = sampleCountByRecipe[recipe.id] || 0;
      const isInThisWeekGroup = thisWeekGroup.some(g => g.id === recipe.id);
      const monthComplete = monthTotal >= samplesPerRecipe;
      const recipeSales = salesCountByRecipe[(recipe.dish_name || '').toLowerCase().trim()] || 0;

      return {
        recipe,
        requiredThisWeek: isInThisWeekGroup ? samplesPerWeek : 0,
        completedThisWeek: thisWeekSamples.length,
        isDone: isInThisWeekGroup 
          ? thisWeekSamples.length >= samplesPerWeek 
          : monthComplete,
        monthTotal,
        monthRequired: samplesPerRecipe,
        isExtra: !isInThisWeekGroup,
        monthComplete,
        salesCount: recipeSales
      };
    });
  }, [eligibleRecipes, allSamples, currentWeek, samplesPerWeek, samplesPerRecipe, isActive, now, assignmentMode, manualRecipeIds, salesCountByRecipe]);

  const totalWeekly = weeklyAssignments.reduce((s, a) => s + a.requiredThisWeek, 0);
  const completedWeekly = weeklyAssignments.reduce((s, a) => s + Math.min(a.completedThisWeek, a.requiredThisWeek), 0);
  const allWeeklyDone = totalWeekly > 0 && completedWeekly >= totalWeekly;

  // Stars calculation removed from kitchen view — visible only in Empleados section

  // Split into this week's assigned vs extras
  const thisWeekAssignments = weeklyAssignments.filter(a => !a.isExtra);
  const extraAssignments = weeklyAssignments.filter(a => a.isExtra && !a.monthComplete);

  const filteredThisWeek = thisWeekAssignments.filter(a =>
    !searchTerm || a.recipe.dish_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredExtras = extraAssignments.filter(a =>
    !searchTerm || a.recipe.dish_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingFirst = [...filteredThisWeek].sort((a, b) => {
    if (a.isDone === b.isDone) return 0;
    return a.isDone ? 1 : -1;
  });

  const handleStartSampling = (recipe) => {
    setSelectedRecipe(recipe);
    setShowSamplingForm(true);
  };

  if (!isActive && !isManager) {
    return (
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="py-16 text-center">
          <FlaskConical className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Muestreos no activados</p>
          <p className="text-sm text-gray-400 mt-1">El administrador debe activar el sistema de muestreos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-indigo-500 to-violet-600 border-0 shadow-xl">
          <CardContent className="p-4 text-center">
            <p className="text-indigo-100 text-xs font-medium uppercase tracking-wider">Esta Semana</p>
            <p className="text-2xl font-black text-white mt-1">{completedWeekly}/{totalWeekly}</p>
            <p className="text-indigo-200 text-xs">muestreos</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-xl">
          <CardContent className="p-4 text-center">
            <p className="text-amber-100 text-xs font-medium uppercase tracking-wider">Este Mes</p>
            <p className="text-2xl font-black text-white mt-1">{allSamples.length}/{eligibleRecipes.length * samplesPerRecipe}</p>
            <p className="text-amber-200 text-xs">total</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-green-600 border-0 shadow-xl">
          <CardContent className="p-4 text-center">
            <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Recetas</p>
            <p className="text-2xl font-black text-white mt-1">{eligibleRecipes.length}</p>
            <p className="text-emerald-200 text-xs">incluidas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-500 to-indigo-600">
          <CardContent className="p-4 text-center">
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wider">Modo</p>
            <p className="text-lg font-black text-white mt-1">{assignmentMode === 'auto' ? '🔄' : '✋'}</p>
            <p className="text-blue-200 text-xs">{assignmentMode === 'auto' ? 'Auto' : 'Manual'}</p>
          </CardContent>
        </Card>
      </div>

      {/* All weekly done banner */}
      {allWeeklyDone && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="bg-gradient-to-r from-emerald-500 to-green-600 border-0 shadow-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-white" />
              <div>
                <p className="font-bold text-white">¡Muestreos de la semana completados!</p>
                <p className="text-emerald-100 text-sm">Excelente trabajo del equipo.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Mode indicator + Search + config */}
      <div className="flex items-center gap-2 px-1">
        <Badge className={`text-[10px] font-bold uppercase tracking-wider border-0 ${
          assignmentMode === 'auto' 
            ? 'bg-blue-50 text-blue-600' 
            : 'bg-violet-50 text-violet-600'
        }`}>
          {assignmentMode === 'auto' ? '📊 Rotación por ventas' : '✋ Selección manual'}
        </Badge>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar receta..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        {isManager && (
          <Button variant="outline" onClick={() => setShowConfig(true)} className="rounded-xl">
            <Settings className="w-4 h-4 mr-2" /> Configurar
          </Button>
        )}
      </div>

      {/* This week's assigned recipes */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">📋 Asignadas esta semana</p>
        <AnimatePresence>
          {pendingFirst.map((assignment, idx) => (
            <motion.div 
              key={assignment.recipe.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: idx * 0.03 }}
            >
              <Card className={`border transition-all hover:shadow-lg ${
                assignment.isDone ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-gray-100'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      assignment.isDone 
                        ? 'bg-emerald-100' 
                        : 'bg-gradient-to-br from-orange-100 to-amber-100'
                    }`}>
                      {assignment.isDone 
                        ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        : assignment.recipe.photo_url 
                          ? <img src={assignment.recipe.photo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                          : <ChefHat className="w-6 h-6 text-orange-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${assignment.isDone ? 'text-emerald-700 line-through' : 'text-gray-900'}`}>
                        {assignment.recipe.dish_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{assignment.recipe.category}</Badge>
                        {assignmentMode === 'auto' && assignment.salesCount > 0 && (
                          <Badge className="bg-blue-50 text-blue-600 border-0 text-[10px]">🔥 {assignment.salesCount} vendidos</Badge>
                        )}
                        <span className="text-xs text-gray-400">
                          {assignment.completedThisWeek}/{assignment.requiredThisWeek} semana · {assignment.monthTotal}/{assignment.monthRequired} mes
                        </span>
                      </div>
                    </div>
                    {!assignment.isDone ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleStartSampling(assignment.recipe)}
                        className="bg-indigo-600 hover:bg-indigo-700 rounded-xl shrink-0"
                      >
                        <FlaskConical className="w-4 h-4 mr-1" /> Muestrear
                      </Button>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Listo
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {pendingFirst.length === 0 && (
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <FlaskConical className="w-12 h-12 text-indigo-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">
                {!isActive ? 'Sistema de muestreos desactivado' : 'No hay recetas asignadas'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {!isActive 
                  ? 'Actívalo desde la configuración ⚙️' 
                  : eligibleRecipes.length === 0 
                    ? 'Primero crea recetas en la pestaña Recetas' 
                    : 'No se encontraron resultados'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Extra recipes that still need samples this month */}
      {filteredExtras.length > 0 && (
        <div className="space-y-2 mt-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">🔄 Pendientes del mes (muestreo extra)</p>
          <p className="text-xs text-gray-400 px-1 mb-2">Estas recetas aún no cumplen su meta mensual. Puedes muestrearlas adicionalmente.</p>
          <AnimatePresence>
            {filteredExtras.map((assignment, idx) => (
              <motion.div
                key={assignment.recipe.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card className="border border-dashed border-gray-200 bg-gray-50/50 hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-gray-100">
                        {assignment.recipe.photo_url 
                          ? <img src={assignment.recipe.photo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                          : <ChefHat className="w-6 h-6 text-gray-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-700">{assignment.recipe.dish_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">{assignment.recipe.category}</Badge>
                          <span className="text-xs text-amber-600 font-medium">
                            {assignment.monthTotal}/{assignment.monthRequired} este mes
                          </span>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStartSampling(assignment.recipe)}
                        className="rounded-xl shrink-0"
                      >
                        <FlaskConical className="w-4 h-4 mr-1" /> Extra
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Dialogs */}
      <SamplingFormDialog
        open={showSamplingForm}
        onOpenChange={setShowSamplingForm}
        recipe={selectedRecipe}
        restaurantId={restaurantId}
        restaurant={restaurant}
        user={user}
      />

      <SamplingConfigDialog
        open={showConfig}
        onOpenChange={setShowConfig}
        restaurantId={restaurantId}
        recipeCategories={recipeCategories}
        recipes={recipes}
      />
    </div>
  );
}