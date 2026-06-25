import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChefHat,
  Plus,
  Edit,
  Trash2,
  Search,
  Package,
  Percent,
  FileText,
  Eye,
  Clock,
  Users,
  Layers,
  FlaskConical,
  Upload,
  BookOpen,
  Gauge
} from "lucide-react";
import RestaurantSelector from '../components/dashboard/RestaurantSelector';
import SelectRestaurantDialog from '../components/dialogs/SelectRestaurantDialog';
import RecipeFormDialog from '../components/recipes/RecipeFormDialog';
import RecipePdfExport from '../components/recipes/RecipePdfExport';
import RecipeImportDialog from '../components/import/RecipeImportDialog';
import RestaurantPickerOnEntry from '@/components/dialogs/RestaurantPickerOnEntry';
import WeeklySamplingPanel from '@/components/kitchen/WeeklySamplingPanel';

import CartaPanel from '@/components/kitchen/CartaPanel';
import RendimientosPanel from '@/components/kitchen/RendimientosPanel';
import KitchenWasteTab from '@/components/kitchen/KitchenWasteTab';
import { getSelectedCurrency, formatCurrency } from '../components/utils/currencyHelper';
import { getYieldAdjustedCost } from '../components/utils/yieldCostHelper';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const defaultCategories = ['Comida', 'Bebidas', 'Postres', 'Alcohol', 'Otros'];

export default function Recipes() {
  const [selectedRestaurant, setSelectedRestaurant] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectRestaurantDialog, setSelectRestaurantDialog] = useState(false);
  const [targetRestaurantId, setTargetRestaurantId] = useState(null);
  const [activeTab, setActiveTab] = useState('carta');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const queryClient = useQueryClient();

  // Data fetching
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: restaurants = [] } = useQuery({
    queryKey: ['myRestaurants', user?.email, user?.restaurant_ids],
    queryFn: async () => {
      // Si tiene restaurant_ids asignados, usar SOLO esos
      if (user?.restaurant_ids?.length > 0) {
        const allActive = await base44.entities.Restaurant.filter({ is_active: true });
        return allActive.filter(r => user.restaurant_ids.includes(r.id));
      }
      // Si no, buscar por created_by (propietario)
      return base44.entities.Restaurant.filter({ is_active: true, created_by: user?.email });
    },
    enabled: !!user?.email
  });

  const accessibleRestaurants = restaurants;
  const myRestaurantIds = accessibleRestaurants.map(r => r.id);

  const { data: recipes = [] } = useQuery({
    queryKey: ['myRecipes', myRestaurantIds],
    queryFn: async () => {
      if (myRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        myRestaurantIds.map(id => base44.entities.Recipe.filter({ restaurant_id: id }))
      );
      return results.flat();
    },
    enabled: myRestaurantIds.length > 0,
    staleTime: 5 * 60 * 1000
  });

  const { data: supplyItems = [] } = useQuery({
    queryKey: ['mySupplyItems', myRestaurantIds],
    queryFn: async () => {
      if (myRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        myRestaurantIds.map(id => base44.entities.SupplyItem.filter({ restaurant_id: id }))
      );
      return results.flat();
    },
    enabled: myRestaurantIds.length > 0,
    staleTime: 5 * 60 * 1000
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: (id) => base44.entities.Recipe.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myRecipes'] })
  });

  // Sincronización Carta → Receta: al editar un precio en la carta, si existe una
  // receta con el mismo nombre se actualiza su precio de venta (Prompt 13).
  const updateRecipePrice = (dishName, price) => {
    const target = recipes.find(r => r.dish_name?.trim().toLowerCase() === dishName.trim().toLowerCase());
    if (!target || !target.id) return;
    base44.entities.Recipe.update(target.id, { sale_price: price })
      .then(() => queryClient.invalidateQueries({ queryKey: ['myRecipes'] }))
      .catch(() => {});
  };

  const userRestaurants = accessibleRestaurants;
  const selectedCurrency = getSelectedCurrency(selectedRestaurant, userRestaurants);
  
  const getCategories = (restaurantId) => {
    const targetId = restaurantId || selectedRestaurant;
    if (targetId && targetId !== 'all') {
      const restaurant = userRestaurants.find(r => r.id === targetId);
      const recipeCategories = restaurant?.config?.recipe_categories;
      if (recipeCategories && recipeCategories.length > 0) {
        return recipeCategories;
      }
    }
    return defaultCategories;
  };
  
  const categories = getCategories(targetRestaurantId);

  // Filtrar insumos por restaurante seleccionado
  const filteredSupplyItems = useMemo(() => {
    if (selectedRestaurant === 'all') return supplyItems;
    return supplyItems.filter(s => s.restaurant_id === selectedRestaurant);
  }, [supplyItems, selectedRestaurant]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      const matchRestaurant = selectedRestaurant === 'all' || recipe.restaurant_id === selectedRestaurant;
      const matchSearch = !searchTerm || 
        recipe.dish_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchRestaurant && matchSearch;
    });
  }, [recipes, selectedRestaurant, searchTerm]);

  // Calcular costo de una receta incluyendo sub-recetas (recursivo) - usa costo con rendimiento
  const calculateRecipeCost = (recipe) => {
    const ingredients = recipe.ingredients || [];
    const subRecipes = recipe.sub_recipes || [];
    
    // Costo de ingredientes directos con rendimiento
    const ingredientsCost = ingredients.reduce((total, ing) => {
      const supplyItem = supplyItems.find(s => s.name === ing.supply_name || s.id === ing.supply_id);
      return total + (getYieldAdjustedCost(supplyItem) * (ing.quantity || 0));
    }, 0);
    
    // Costo de sub-recetas
    const subRecipesCost = subRecipes.reduce((total, sr) => {
      const subRecipe = recipes.find(r => r.id === sr.recipe_id);
      if (!subRecipe) return total;
      const subRecipeCostPerPortion = calculateRecipeCostPerPortion(subRecipe);
      return total + (subRecipeCostPerPortion * sr.quantity);
    }, 0);
    
    return ingredientsCost + subRecipesCost;
  };

  // Costo por porción de una receta
  const calculateRecipeCostPerPortion = (recipe) => {
    const totalCost = calculateRecipeCost(recipe);
    return totalCost / (recipe.servings || 1);
  };

  const handleNewRecipe = () => {
    if (selectedRestaurant === 'all') {
      setSelectRestaurantDialog(true);
    } else {
      setSelectedRecipe(null);
      setTargetRestaurantId(selectedRestaurant);
      setShowFormDialog(true);
    }
  };

  const handleEditRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setTargetRestaurantId(recipe.restaurant_id);
    setShowFormDialog(true);
  };

  const handleViewRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setShowViewDialog(true);
  };

  // Stats
  const totalRecipes = filteredRecipes.length;
  const avgCost = totalRecipes > 0 
    ? filteredRecipes.reduce((sum, r) => sum + calculateRecipeCost(r), 0) / totalRecipes 
    : 0;
  const avgMargin = totalRecipes > 0
    ? filteredRecipes.reduce((sum, r) => {
        const cost = calculateRecipeCost(r);
        const price = r.sale_price || 0;
        return sum + (price > 0 ? ((price - cost) / price) * 100 : 0);
      }, 0) / totalRecipes
    : 0;

  return (
    <div className="min-h-screen bg-noa-navy text-white">
      {/* Header */}
      <div className="relative overflow-hidden py-12">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=1920&q=80)` }}
        />
        <div className="absolute inset-0" style={{ background: 'rgba(12, 27, 51, 0.72)' }} />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 lg:w-16 lg:h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
                <ChefHat className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-4xl font-bold text-white tracking-tight">Cocina</h1>
                <p className="text-white/70 mt-1">Carta, rendimientos, recetas y preparación</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <RestaurantSelector
                restaurants={userRestaurants}
                selectedId={selectedRestaurant}
                onChange={setSelectedRestaurant}
                className="bg-white/95 backdrop-blur-sm border-white/50 shadow-xl"
              />
              <Button 
                variant="outline"
                onClick={() => {
                  if (selectedRestaurant === 'all') {
                    setSelectRestaurantDialog(true);
                  } else {
                    setTargetRestaurantId(selectedRestaurant);
                    setShowImportDialog(true);
                  }
                }}
                className="bg-white/95 backdrop-blur-sm border-white/50 shadow-xl text-gray-700 hover:bg-white"
              >
                <Upload className="w-4 h-4 mr-2" /> Importar
              </Button>
              <Button onClick={handleNewRecipe} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-lg">
                <Plus className="w-4 h-4 mr-2" /> Nueva Receta
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-noa-navy to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Sub-tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/80 backdrop-blur-sm shadow-lg border-0 p-1.5 rounded-2xl flex-wrap">
            <TabsTrigger value="carta" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <BookOpen className="w-4 h-4" /> Carta
            </TabsTrigger>
            <TabsTrigger value="rendimientos" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Gauge className="w-4 h-4" /> <span className="hidden sm:inline">Rendimientos</span>
            </TabsTrigger>
            <TabsTrigger value="recipes" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <ChefHat className="w-4 h-4" /> Recetas
            </TabsTrigger>
            <TabsTrigger value="sampling" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-violet-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <FlaskConical className="w-4 h-4" /> <span className="hidden sm:inline">Muestreos</span>
            </TabsTrigger>

            <TabsTrigger value="waste" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Merma</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recipes" className="space-y-6 mt-4">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-gradient-to-br from-orange-500 to-amber-600 border-0 shadow-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Total Recetas</p>
                    <p className="text-3xl font-bold text-white mt-1">{totalRecipes}</p>
                  </div>
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                    <ChefHat className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-gradient-to-br from-amber-500 to-yellow-600 border-0 shadow-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-sm font-medium">Costo Promedio</p>
                    <p className="text-3xl font-bold text-white mt-1">{formatCurrency(avgCost, selectedCurrency)}</p>
                  </div>
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Package className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className={`border-0 shadow-xl ${avgMargin >= 50 ? 'bg-gradient-to-br from-emerald-500 to-green-600' : avgMargin >= 30 ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80">Margen Promedio</p>
                    <p className="text-3xl font-bold text-white mt-1">{avgMargin.toFixed(1)}%</p>
                  </div>
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Percent className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar receta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 rounded-xl border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm"
          />
        </div>

        {/* Recetas: Principales + Subrecetas (Prompt 16) */}
        {(() => {
          const principales = filteredRecipes.filter((r) => !r.is_sub_recipe);
          const subrecetas = filteredRecipes.filter((r) => r.is_sub_recipe);
          const renderRecipeCard = (recipe) => {
              const cost = calculateRecipeCost(recipe);
              const margin = recipe.sale_price > 0 
                ? ((recipe.sale_price - cost) / recipe.sale_price) * 100 
                : 0;
              const hasSubRecipes = (recipe.sub_recipes || []).length > 0;

              return (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group"
                >
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden">
                    {/* Foto */}
                    {recipe.photo_url ? (
                      <div className="relative h-40 overflow-hidden">
                        <img 
                          src={recipe.photo_url} 
                          alt={recipe.dish_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <h3 className="text-lg font-bold text-white drop-shadow-lg">{recipe.dish_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className="bg-white/90 text-orange-700 border-0">{recipe.category}</Badge>
                            {recipe.is_sub_recipe && (
                              <Badge className="bg-purple-500/90 text-white border-0">
                                <Layers className="w-3 h-3 mr-1" />Base
                              </Badge>
                            )}
                            {recipe.preparation_time && (
                              <Badge variant="outline" className="bg-white/80 border-white/50 text-gray-700">
                                <Clock className="w-3 h-3 mr-1" />{recipe.preparation_time}min
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewRecipe(recipe)} className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-gray-700 rounded-lg shadow-sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditRecipe(recipe)} className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-gray-700 rounded-lg shadow-sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteRecipeMutation.mutate(recipe.id)} className="h-8 w-8 p-0 bg-white/90 hover:bg-red-50 text-red-600 rounded-lg shadow-sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <CardHeader className="pb-2 bg-gradient-to-r from-orange-50 to-amber-50/50 border-b">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                              <ChefHat className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-bold text-gray-900">{recipe.dish_name}</CardTitle>
                              <div className="flex items-center gap-1 mt-1">
                                <Badge className="bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border-0">
                                  {recipe.category}
                                </Badge>
                                {recipe.is_sub_recipe && (
                                  <Badge className="bg-purple-100 text-purple-700 border-0">
                                    <Layers className="w-3 h-3 mr-1" />Base
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleViewRecipe(recipe)} className="h-9 w-9 p-0 hover:bg-orange-100 rounded-xl">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEditRecipe(recipe)} className="h-9 w-9 p-0 hover:bg-orange-100 rounded-xl">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteRecipeMutation.mutate(recipe.id)} className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-600 rounded-xl">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    )}

                    <CardContent className="pt-4">
                      {/* Descripción */}
                      {recipe.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{recipe.description}</p>
                      )}

                      {/* Precio y Costo */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-emerald-50 rounded-xl p-2 text-center min-w-0">
                          <p className="text-[10px] text-emerald-600 font-medium mb-0.5">Precio</p>
                          <p className="font-bold text-sm text-emerald-700 truncate">{formatCurrency(recipe.sale_price || 0, selectedCurrency)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2 text-center min-w-0">
                          <p className="text-[10px] text-amber-600 font-medium mb-0.5">Costo</p>
                          <p className="font-bold text-sm text-amber-700 truncate">{formatCurrency(cost, selectedCurrency)}</p>
                        </div>
                        <div className={`rounded-xl p-2 text-center min-w-0 ${margin >= 50 ? 'bg-emerald-50' : margin >= 30 ? 'bg-amber-50' : 'bg-red-50'}`}>
                          <p className={`text-[10px] font-medium mb-0.5 ${margin >= 50 ? 'text-emerald-600' : margin >= 30 ? 'text-amber-600' : 'text-red-600'}`}>Margen</p>
                          <p className={`font-bold text-sm ${margin >= 50 ? 'text-emerald-700' : margin >= 30 ? 'text-amber-700' : 'text-red-700'}`}>
                            {margin.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Indicadores */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {recipe.pdf_url && (
                          <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                            <FileText className="w-3 h-3 mr-1" /> PDF
                          </Badge>
                        )}
                        {recipe.preparation_instructions && (
                          <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                            Instrucciones
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200 text-gray-600">
                          {(recipe.ingredients || []).length} ingredientes
                        </Badge>
                        {hasSubRecipes && (
                          <Badge variant="outline" className="text-xs bg-violet-50 border-violet-200 text-violet-700">
                            <Layers className="w-3 h-3 mr-1" />{(recipe.sub_recipes || []).length} sub-recetas
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
          };
          return (
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-bold text-gray-900">Recetas Principales</h3>
                  <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-700">{principales.length}</Badge>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>{principales.map(renderRecipeCard)}</AnimatePresence>
                </div>
              </section>
              {subrecetas.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 pt-4 border-t border-gray-200">
                    <Layers className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-bold text-gray-900">Subrecetas</h3>
                    <Badge className="bg-purple-100 text-purple-700 border-0">{subrecetas.length}</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>{subrecetas.map(renderRecipeCard)}</AnimatePresence>
                  </div>
                </section>
              )}
            </div>
          );
        })()}

        {filteredRecipes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <ChefHat className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay recetas registradas</p>
            <Button onClick={handleNewRecipe} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" /> Crear primera receta
            </Button>
          </div>
        )}
          </TabsContent>

          <TabsContent value="sampling" className="mt-4">
            <WeeklySamplingPanel
              recipes={recipes}
              restaurantId={selectedRestaurant !== 'all' ? selectedRestaurant : (userRestaurants[0]?.id || '')}
              restaurant={selectedRestaurant !== 'all' ? userRestaurants.find(r => r.id === selectedRestaurant) : userRestaurants[0]}
              isManager={user?.role === 'admin' || user?.app_role === 'manager'}
              recipeCategories={categories}
            />
          </TabsContent>



          <TabsContent value="waste" className="mt-4">
            <KitchenWasteTab
              supplyItems={supplyItems}
              selectedRestaurant={selectedRestaurant}
              restaurant={selectedRestaurant !== 'all' ? userRestaurants.find(r => r.id === selectedRestaurant) : userRestaurants[0]}
              restaurants={userRestaurants}
              currency={selectedCurrency}
              user={user}
            />
          </TabsContent>

          <TabsContent value="carta" className="mt-4">
            <CartaPanel onUpdateRecipePrice={updateRecipePrice} recipeNames={recipes.map((r) => r.dish_name).filter(Boolean)} />
          </TabsContent>

          <TabsContent value="rendimientos" className="mt-4">
            <RendimientosPanel supplyItems={filteredSupplyItems} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog: Crear/Editar Receta */}
      <RecipeFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        recipe={selectedRecipe}
        supplyItems={filteredSupplyItems}
        allRecipes={filteredRecipes}
        categories={getCategories(targetRestaurantId)}
        currency={selectedCurrency}
        restaurantId={targetRestaurantId}
        restaurant={userRestaurants.find(r => r.id === targetRestaurantId)}
      />

      {/* Dialog: Ver Receta Completa */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRecipe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-orange-600" />
                  {selectedRecipe.dish_name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Foto y descripción */}
                {selectedRecipe.photo_url && (
                  <img 
                    src={selectedRecipe.photo_url} 
                    alt={selectedRecipe.dish_name}
                    className="w-full h-48 object-cover rounded-xl"
                  />
                )}

                {selectedRecipe.description && (
                  <p className="text-gray-600">{selectedRecipe.description}</p>
                )}

                {/* Info */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-emerald-600 font-medium">Precio</p>
                    <p className="font-bold text-sm text-emerald-700 truncate">{formatCurrency(selectedRecipe.sale_price || 0, selectedCurrency)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-amber-600 font-medium">Costo Total</p>
                    <p className="font-bold text-sm text-amber-700 truncate">{formatCurrency(calculateRecipeCost(selectedRecipe), selectedCurrency)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-blue-600 font-medium">Tiempo</p>
                    <p className="font-bold text-sm text-blue-700">{selectedRecipe.preparation_time || '—'} min</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-purple-600 font-medium">Porciones</p>
                    <p className="font-bold text-sm text-purple-700">{selectedRecipe.servings || 1} {selectedRecipe.servings_unit || 'porción'}</p>
                  </div>
                </div>

                {/* Sub-recetas */}
                {(selectedRecipe.sub_recipes || []).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-600" />
                      Sub-recetas
                    </h4>
                    <div className="space-y-2">
                      {(selectedRecipe.sub_recipes || []).map((sr, idx) => {
                        const subRecipe = recipes.find(r => r.id === sr.recipe_id);
                        return (
                          <div key={idx} className="flex items-center justify-between bg-purple-50 p-3 rounded-lg border border-purple-100">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-purple-600" />
                              <span className="font-medium text-purple-900">{sr.recipe_name}</span>
                            </div>
                            <span className="text-purple-700">{sr.quantity} {sr.unit || 'porción'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ingredientes */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Ingredientes</h4>
                  <div className="space-y-2">
                    {(selectedRecipe.ingredients || []).map((ing, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                        <span className="font-medium">{ing.supply_name}</span>
                        <span className="text-gray-600">{ing.quantity} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instrucciones */}
                {selectedRecipe.preparation_instructions && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Preparación</h4>
                    <div className="bg-gray-50 p-4 rounded-xl whitespace-pre-wrap text-sm text-gray-700">
                      {selectedRecipe.preparation_instructions}
                    </div>
                  </div>
                )}

                {/* PDF y Exportar */}
                <div className="flex items-center justify-end pt-4 border-t">
                  <RecipePdfExport 
                    recipe={selectedRecipe} 
                    supplyItems={supplyItems}
                    currency={selectedCurrency}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Restaurant Picker al entrar */}
      <RestaurantPickerOnEntry
        restaurants={userRestaurants}
        selectedRestaurant={selectedRestaurant}
        onSelect={setSelectedRestaurant}
        pageName="Recetas"
      />

      {/* Dialog: Importar Recetas */}
      <RecipeImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        restaurantId={targetRestaurantId || selectedRestaurant}
        supplyItems={filteredSupplyItems}
        existingRecipes={filteredRecipes}
        onSuccess={(count) => {
          queryClient.invalidateQueries({ queryKey: ['myRecipes'] });
        }}
      />

      {/* Dialog: Seleccionar Restaurante */}
      <SelectRestaurantDialog
        open={selectRestaurantDialog}
        onOpenChange={setSelectRestaurantDialog}
        restaurants={userRestaurants}
        title="Selecciona un local"
        description="Elige el restaurante donde crear la receta"
        onSelect={(restaurantId) => {
          setTargetRestaurantId(restaurantId);
          setSelectedRecipe(null);
          setShowFormDialog(true);
        }}
      />
    </div>
  );
}