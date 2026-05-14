import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Settings, FlaskConical, Loader2, TrendingUp, Hand, Search, CheckCircle2 } from "lucide-react";

export default function SamplingConfigDialog({ open, onOpenChange, restaurantId, recipeCategories = [], recipes = [] }) {
  const queryClient = useQueryClient();
  const [samplesPerRecipe, setSamplesPerRecipe] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [assignmentMode, setAssignmentMode] = useState('auto');
  const [manualRecipes, setManualRecipes] = useState([]);
  const [manualSearch, setManualSearch] = useState('');

  const { data: config } = useQuery({
    queryKey: ['deviationConfig', restaurantId],
    queryFn: async () => {
      const configs = await base44.entities.DeviationConfig.filter({ restaurant_id: restaurantId });
      return configs[0] || null;
    },
    enabled: !!restaurantId && open
  });

  useEffect(() => {
    if (config) {
      setSamplesPerRecipe(config.samples_per_recipe_per_month || 3);
      setIsActive(config.is_active !== false);
      setSelectedCategories(config.selected_categories || []);
      setAssignmentMode(config.assignment_mode || 'auto');
      setManualRecipes(config.manual_weekly_recipes || []);
    } else {
      setSamplesPerRecipe(3);
      setIsActive(true);
      setSelectedCategories([]);
      setAssignmentMode('auto');
      setManualRecipes([]);
    }
  }, [config, open]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (config?.id) {
        return base44.entities.DeviationConfig.update(config.id, data);
      }
      return base44.entities.DeviationConfig.create({ restaurant_id: restaurantId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviationConfig'] });
      onOpenChange(false);
    }
  });

  const handleSave = () => {
    saveMutation.mutate({
      samples_per_recipe_per_month: samplesPerRecipe,
      is_active: isActive,
      assignment_mode: assignmentMode,
      selected_categories: selectedCategories,
      manual_weekly_recipes: assignmentMode === 'manual' ? manualRecipes : []
    });
  };

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleManualRecipe = (recipeId) => {
    setManualRecipes(prev =>
      prev.includes(recipeId) ? prev.filter(id => id !== recipeId) : [...prev, recipeId]
    );
  };

  // Recetas elegibles para selección manual
  const eligibleRecipes = useMemo(() => {
    let filtered = recipes.filter(r => r.restaurant_id === restaurantId && !r.is_sub_recipe);
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(r => selectedCategories.includes(r.category));
    }
    if (manualSearch) {
      filtered = filtered.filter(r => r.dish_name?.toLowerCase().includes(manualSearch.toLowerCase()));
    }
    return filtered.sort((a, b) => (a.dish_name || '').localeCompare(b.dish_name || ''));
  }, [recipes, restaurantId, selectedCategories, manualSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Configurar Muestreos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Activar/Desactivar */}
          <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-3">
              <FlaskConical className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="font-medium text-indigo-900 text-sm">Sistema de Muestreos</p>
                <p className="text-xs text-indigo-600">Activar asignación semanal</p>
              </div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Aclaración cuando está desactivado */}
          {!isActive && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-1">ℹ️ Sistema desactivado</p>
              <p className="text-xs text-gray-500">
                No se programarán muestreos automáticos. Los colaboradores podrán muestrear cualquier receta libremente, pero sin una agenda organizada ni seguimiento semanal.
              </p>
            </div>
          )}

          {/* Muestreos por receta */}
          <div>
            <Label>Muestreos por receta al mes</Label>
            <p className="text-xs text-gray-500 mb-2">Se distribuyen en las semanas del mes</p>
            <Input
              type="number"
              min={1}
              max={12}
              value={samplesPerRecipe}
              onChange={(e) => setSamplesPerRecipe(parseInt(e.target.value) || 3)}
            />
            <p className="text-xs text-gray-400 mt-1">
              ≈ {Math.ceil(samplesPerRecipe / 4)} muestreo(s) por receta por semana
            </p>
          </div>

          {/* Modo de asignación */}
          <div>
            <Label className="mb-2 block">Modo de asignación</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAssignmentMode('auto')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  assignmentMode === 'auto'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className={`w-4 h-4 ${assignmentMode === 'auto' ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-semibold ${assignmentMode === 'auto' ? 'text-indigo-700' : 'text-gray-700'}`}>
                    Rotación Inteligente
                  </span>
                </div>
                <p className={`text-[11px] ${assignmentMode === 'auto' ? 'text-indigo-500' : 'text-gray-400'}`}>
                  Por top de ventas, automático
                </p>
              </button>
              <button
                onClick={() => setAssignmentMode('manual')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  assignmentMode === 'manual'
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Hand className={`w-4 h-4 ${assignmentMode === 'manual' ? 'text-violet-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-semibold ${assignmentMode === 'manual' ? 'text-violet-700' : 'text-gray-700'}`}>
                    Selección Manual
                  </span>
                </div>
                <p className={`text-[11px] ${assignmentMode === 'manual' ? 'text-violet-500' : 'text-gray-400'}`}>
                  Tú eliges las recetas
                </p>
              </button>
            </div>
          </div>

          {/* Explicación modo auto */}
          {assignmentMode === 'auto' && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-semibold text-blue-800 mb-1">📊 Rotación inteligente por ventas</p>
              <p className="text-xs text-blue-600">
                Las recetas se ordenan por volumen de ventas (las más vendidas primero). 
                Se dividen en 4 grupos semanales: la semana 1 se muestrean las top, la semana 2 las siguientes, y así sucesivamente. 
                Las que queden pendientes aparecen como extras.
              </p>
            </div>
          )}

          {/* Selección manual de recetas */}
          {assignmentMode === 'manual' && (
            <div>
              <div className="p-3 bg-violet-50 rounded-xl border border-violet-100 mb-3">
                <p className="text-xs font-semibold text-violet-800 mb-1">✋ Selección manual semanal</p>
                <p className="text-xs text-violet-600">
                  Elige las recetas que quieres muestrear esta semana. 
                  Cada una se muestreará según la frecuencia configurada arriba.
                </p>
              </div>
              
              <Label className="mb-2 block">Recetas para muestrear ({manualRecipes.length} seleccionadas)</Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Buscar receta..."
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                {eligibleRecipes.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No hay recetas disponibles</p>
                ) : eligibleRecipes.map(recipe => {
                  const isSelected = manualRecipes.includes(recipe.id);
                  return (
                    <button
                      key={recipe.id}
                      onClick={() => toggleManualRecipe(recipe.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'bg-violet-50 border border-violet-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-violet-500' : 'border-2 border-gray-300'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-violet-800' : 'text-gray-700'}`}>
                          {recipe.dish_name}
                        </p>
                      </div>
                      <Badge className="bg-gray-100 text-gray-500 border-0 text-[10px] shrink-0">{recipe.category}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categorías a incluir */}
          {recipeCategories.length > 0 && (
            <div>
              <Label>Categorías incluidas en muestreo</Label>
              <p className="text-xs text-gray-500 mb-2">
                {selectedCategories.length === 0 ? 'Todas las categorías (sin filtro)' : `${selectedCategories.length} seleccionadas`}
              </p>
              <div className="flex flex-wrap gap-2">
                {recipeCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedCategories.includes(cat)
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar Configuración
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}