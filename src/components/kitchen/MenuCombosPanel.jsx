import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Plus,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  Layers,
  ShoppingBag,
  ChefHat,
  Info,
  Link2
} from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';

export default function MenuCombosPanel({ restaurant, recipes = [] }) {
  const queryClient = useQueryClient();
  const [newComboName, setNewComboName] = useState('');
  const [expandedCombo, setExpandedCombo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [linkingCombo, setLinkingCombo] = useState(null);
  const [recipeSearch, setRecipeSearch] = useState('');

  const comboProducts = restaurant?.combo_products || [];

  const updateCombosMutation = useMutation({
    mutationFn: (newCombos) => base44.entities.Restaurant.update(restaurant.id, { combo_products: newCombos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    }
  });

  const handleAddCombo = () => {
    const val = newComboName.trim().toUpperCase();
    if (val && !comboProducts.includes(val)) {
      updateCombosMutation.mutate([...comboProducts, val]);
      setNewComboName('');
    }
  };

  const handleRemoveCombo = (name) => {
    updateCombosMutation.mutate(comboProducts.filter(c => c !== name));
  };

  const updateRecipeComboMutation = useMutation({
    mutationFn: ({ id, combo_parent }) => base44.entities.Recipe.update(id, { combo_parent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRecipes'] });
    }
  });

  // Recetas vinculadas a un combo por el campo combo_parent
  const getRecipesForCombo = (comboName) => {
    const upperCombo = comboName.toUpperCase().trim();
    return recipes.filter(r => {
      return r.combo_parent && r.combo_parent.toUpperCase().trim() === upperCombo;
    });
  };

  // Recetas no vinculadas a ningún combo (disponibles para vincular)
  const getAvailableRecipes = (comboName) => {
    return recipes.filter(r => {
      // No mostrar las ya vinculadas a este combo
      if (r.combo_parent && r.combo_parent.toUpperCase().trim() === comboName.toUpperCase().trim()) return false;
      // Filtrar por búsqueda
      if (recipeSearch && !(r.dish_name || '').toLowerCase().includes(recipeSearch.toLowerCase())) return false;
      return true;
    });
  };

  const filteredCombos = useMemo(() => {
    if (!searchTerm) return comboProducts;
    return comboProducts.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [comboProducts, searchTerm]);

  if (!restaurant) {
    return (
      <div className="text-center py-12 text-gray-400">
        <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>Selecciona un restaurante</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-orange-900">¿Qué son los Menús / Combos?</p>
              <p className="text-sm text-orange-700 mt-1">
                Son nombres de productos "contenedor" (ej: <strong>MENÚ EJECUTIVO</strong>, <strong>COMBO ALMUERZO</strong>) que aparecen en el POS como un solo ítem, pero sus componentes reales son las recetas que el cliente elige. 
                NOA no generará alertas de "sin receta" para estos nombres y descontará inventario solo por los sub-items/selecciones.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-orange-500 to-amber-600 border-0 shadow-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Menús / Combos</p>
                <p className="text-3xl font-bold text-white mt-1">{comboProducts.length}</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-yellow-600 border-0 shadow-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Total Recetas</p>
                <p className="text-3xl font-bold text-white mt-1">{recipes.length}</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <ChefHat className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500 to-purple-600 border-0 shadow-xl hidden md:block">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm font-medium">Recetas en Combos</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {comboProducts.reduce((sum, c) => sum + getRecipesForCombo(c).length, 0)}
                </p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <Link2 className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add new combo */}
      <Card className="bg-white border-0 shadow-lg">
        <CardContent className="p-5">
          <Label className="text-gray-900 font-semibold mb-3 block">Agregar Menú / Combo</Label>
          <div className="flex gap-2">
            <Input
              value={newComboName}
              onChange={(e) => setNewComboName(e.target.value)}
              placeholder="Ej: MENU EJECUTIVO, COMBO ALMUERZO..."
              className="flex-1 h-11"
              onKeyPress={(e) => e.key === 'Enter' && handleAddCombo()}
            />
            <Button 
              onClick={handleAddCombo} 
              disabled={!newComboName.trim() || updateCombosMutation.isPending}
              className="h-11 px-6 bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Agregar
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            El nombre se guardará en MAYÚSCULAS. Debe coincidir exactamente con cómo aparece en el POS / Fudo.
          </p>
        </CardContent>
      </Card>

      {/* Search */}
      {comboProducts.length > 3 && (
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar menú / combo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-11 rounded-xl border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm"
          />
        </div>
      )}

      {/* Combo List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredCombos.map((comboName) => {
            const linkedRecipes = getRecipesForCombo(comboName);
            const isExpanded = expandedCombo === comboName;

            return (
              <motion.div
                key={comboName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="bg-white border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                  <CardContent className="p-0">
                    {/* Header */}
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedCombo(isExpanded ? null : comboName)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                          <ShoppingBag className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{comboName}</p>
                          <p className="text-xs text-gray-500">
                            {linkedRecipes.length > 0 
                              ? `${linkedRecipes.length} receta${linkedRecipes.length !== 1 ? 's' : ''} vinculada${linkedRecipes.length !== 1 ? 's' : ''}` 
                              : 'Sin recetas vinculadas aún'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {linkedRecipes.length > 0 && (
                          <Badge className="bg-orange-100 text-orange-700 border-0">
                            {linkedRecipes.length}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleRemoveCombo(comboName); }}
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded: recetas vinculadas + vincular nuevas */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50/50 p-4 space-y-4">
                        {/* Recetas vinculadas */}
                        {linkedRecipes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recetas vinculadas a este menú:</p>
                            {linkedRecipes.map((recipe) => (
                              <div key={recipe.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                  {recipe.photo_url ? (
                                    <img src={recipe.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                                      <ChefHat className="w-4 h-4 text-orange-600" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-medium text-sm text-gray-900">{recipe.dish_name}</p>
                                    <p className="text-xs text-gray-500">{recipe.category}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {(recipe.ingredients || []).length} ingr.
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateRecipeComboMutation.mutate({ id: recipe.id, combo_parent: '' });
                                    }}
                                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Vincular recetas */}
                        {linkingCombo === comboName ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Vincular receta:</p>
                              <Button variant="ghost" size="sm" onClick={() => { setLinkingCombo(null); setRecipeSearch(''); }} className="h-7 text-xs">
                                Cancelar
                              </Button>
                            </div>
                            <Input
                              placeholder="Buscar receta..."
                              value={recipeSearch}
                              onChange={(e) => setRecipeSearch(e.target.value)}
                              className="h-9"
                              autoFocus
                            />
                            <div className="max-h-48 overflow-y-auto space-y-1.5">
                              {getAvailableRecipes(comboName).slice(0, 15).map((recipe) => (
                                <button
                                  key={recipe.id}
                                  onClick={() => {
                                    updateRecipeComboMutation.mutate({ id: recipe.id, combo_parent: comboName });
                                    setRecipeSearch('');
                                  }}
                                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white border border-gray-100 hover:border-orange-300 hover:bg-orange-50 transition-colors text-left"
                                >
                                  {recipe.photo_url ? (
                                    <img src={recipe.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                      <ChefHat className="w-3.5 h-3.5 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-900 truncate">{recipe.dish_name}</p>
                                    <p className="text-xs text-gray-500">{recipe.category}</p>
                                  </div>
                                  <Plus className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                </button>
                              ))}
                              {getAvailableRecipes(comboName).length === 0 && (
                                <p className="text-center text-sm text-gray-400 py-4">No hay recetas disponibles</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setLinkingCombo(comboName); setRecipeSearch(''); }}
                            className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50"
                          >
                            <Plus className="w-4 h-4 mr-2" /> Vincular receta a este menú
                          </Button>
                        )}

                        {linkedRecipes.length === 0 && linkingCombo !== comboName && (
                          <p className="text-xs text-gray-400 text-center">
                            Este menú no tiene recetas vinculadas. Haz clic arriba para vincular.
                          </p>
                        )}

                        <div className="pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            💡 <strong>¿Cómo funciona?</strong> Cuando Fudo envía una venta con "{comboName}", NOA ignorará ese producto para el descuento de inventario. 
                            Los sub-items (las selecciones reales del cliente) sí descontarán inventario mediante sus recetas.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {comboProducts.length === 0 && (
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Sin menús / combos configurados</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Si tu POS tiene productos como "MENÚ EJECUTIVO" o "COMBO ALMUERZO" que agrupan selecciones del cliente, agrégalos aquí para que NOA no genere alertas innecesarias.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}