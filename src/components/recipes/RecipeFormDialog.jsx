import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ChefHat,
  Plus,
  X,
  Camera,
  Loader2,
  FileText,
  Upload,
  Clock,
  Users,
  Layers,
  AlertCircle,
  ShoppingBag
} from "lucide-react";
import { formatCurrency } from '../utils/currencyHelper';
import { getYieldAdjustedCost } from '../utils/yieldCostHelper';
import { Switch } from "@/components/ui/switch";
import RecipePriceAdvisor from './RecipePriceAdvisor';

export default function RecipeFormDialog({
  open,
  onOpenChange,
  recipe,
  supplyItems = [],
  allRecipes = [], // Todas las recetas para seleccionar sub-recetas
  categories = [],
  currency = 'USD',
  restaurantId,
  restaurant,
  onSuccess
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('info');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const comboProducts = restaurant?.combo_products || [];

  const [formData, setFormData] = useState({
    dish_name: '',
    category: categories[0] || 'Comida',
    description: '',
    preparation_instructions: '',
    sale_price: '',
    preparation_time: '',
    servings: 1,
    servings_unit: 'porción',
    photo_url: '',
    pdf_url: '',
    ingredients: [],
    sub_recipes: [],
    is_sub_recipe: false,
    combo_parent: ''
  });

  const servingsUnits = ['porción', 'g', 'kg', 'ml', 'L', 'unidad'];

  const [newIngredient, setNewIngredient] = useState({ supply_name: '', supply_id: '', quantity: '', unit: '' });
  const [supplySearch, setSupplySearch] = useState('');
  const [newSubRecipe, setNewSubRecipe] = useState({ recipe_id: '', recipe_name: '', quantity: 1, unit: 'porción' });
  const [subRecipeSearch, setSubRecipeSearch] = useState('');


  const subRecipeUnits = ['porción', 'g', 'kg', 'ml', 'L', 'unidad'];

  useEffect(() => {
    if (recipe) {
      setFormData({
        dish_name: recipe.dish_name || '',
        category: recipe.category || categories[0] || 'Comida',
        description: recipe.description || '',
        preparation_instructions: recipe.preparation_instructions || '',
        sale_price: recipe.sale_price || '',
        preparation_time: recipe.preparation_time || '',
        servings: recipe.servings || 1,
        servings_unit: recipe.servings_unit || 'porción',
        photo_url: recipe.photo_url || '',
        pdf_url: recipe.pdf_url || '',
        ingredients: recipe.ingredients || [],
        sub_recipes: recipe.sub_recipes || [],
        is_sub_recipe: recipe.is_sub_recipe || false,
        combo_parent: recipe.combo_parent || ''
      });
    } else {
      setFormData({
        dish_name: '',
        category: categories[0] || 'Comida',
        description: '',
        preparation_instructions: '',
        sale_price: '',
        preparation_time: '',
        servings: 1,
        servings_unit: 'porción',
        photo_url: '',
        pdf_url: '',
        ingredients: [],
        sub_recipes: [],
        is_sub_recipe: false,
        combo_parent: ''
      });
    }
  }, [recipe, categories, open]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Recipe.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRecipes'] });
      onOpenChange(false);
      onSuccess?.();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Recipe.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRecipes'] });
      onOpenChange(false);
      onSuccess?.();
    }
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData({ ...formData, photo_url: file_url });
    setUploadingPhoto(false);
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData({ ...formData, pdf_url: file_url });
    setUploadingPdf(false);
  };

  const addIngredient = () => {
    if (newIngredient.supply_name && newIngredient.quantity) {
      setFormData({
        ...formData,
        ingredients: [...formData.ingredients, { 
          ...newIngredient, 
          quantity: parseFloat(newIngredient.quantity) 
        }]
      });
      setNewIngredient({ supply_name: '', supply_id: '', quantity: '', unit: '' });
    }
  };

  const removeIngredient = (index) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index)
    });
  };

  // Sub-recetas
  const addSubRecipe = () => {
    if (newSubRecipe.recipe_id && newSubRecipe.quantity) {
      setFormData({
        ...formData,
        sub_recipes: [...formData.sub_recipes, { ...newSubRecipe, quantity: parseFloat(newSubRecipe.quantity) }]
      });
      setNewSubRecipe({ recipe_id: '', recipe_name: '', quantity: 1, unit: 'porción' });
      setSubRecipeSearch('');
    }
  };

  const removeSubRecipe = (index) => {
    setFormData({
      ...formData,
      sub_recipes: formData.sub_recipes.filter((_, i) => i !== index)
    });
  };

  // Calcular costo de una sub-receta (recursivo) - usa costo con rendimiento
  const calculateSubRecipeCost = (recipeId) => {
    const subRecipe = allRecipes.find(r => r.id === recipeId);
    if (!subRecipe) return 0;
    
    // Costo de ingredientes directos con rendimiento
    const ingredientsCost = (subRecipe.ingredients || []).reduce((total, ing) => {
      const supply = supplyItems.find(s => s.name === ing.supply_name || s.id === ing.supply_id);
      return total + (getYieldAdjustedCost(supply) * (ing.quantity || 0));
    }, 0);
    
    // Costo de sub-recetas anidadas
    const subRecipesCost = (subRecipe.sub_recipes || []).reduce((total, sr) => {
      return total + (calculateSubRecipeCost(sr.recipe_id) * sr.quantity);
    }, 0);
    
    // Costo por porción
    const totalCost = ingredientsCost + subRecipesCost;
    const servings = subRecipe.servings || 1;
    return totalCost / servings;
  };

  const calculateCost = () => {
    // Costo de ingredientes directos con rendimiento
    const ingredientsCost = formData.ingredients.reduce((total, ing) => {
      const supply = supplyItems.find(s => s.name === ing.supply_name || s.id === ing.supply_id);
      return total + (getYieldAdjustedCost(supply) * (ing.quantity || 0));
    }, 0);
    
    // Costo de sub-recetas
    const subRecipesCost = formData.sub_recipes.reduce((total, sr) => {
      return total + (calculateSubRecipeCost(sr.recipe_id) * sr.quantity);
    }, 0);
    
    return ingredientsCost + subRecipesCost;
  };

  // Recetas disponibles para usar como sub-receta (solo las marcadas como is_sub_recipe, excluyendo la actual y evitando ciclos)
  const availableSubRecipes = allRecipes.filter(r => {
    if (r.id === recipe?.id) return false; // No puede referenciarse a sí misma
    if (!r.is_sub_recipe) return false; // Solo mostrar las marcadas como sub-receta
    // Verificar que la receta no tenga como sub-receta a la receta actual (evitar ciclos)
    const hasCircular = (r.sub_recipes || []).some(sr => sr.recipe_id === recipe?.id);
    return !hasCircular;
  });

  const handleSubmit = () => {
    const data = {
      restaurant_id: restaurantId,
      dish_name: formData.dish_name,
      category: formData.category,
      description: formData.description,
      preparation_instructions: formData.preparation_instructions,
      sale_price: parseFloat(formData.sale_price) || 0,
      preparation_time: parseInt(formData.preparation_time) || 0,
      servings: parseInt(formData.servings) || 1,
      servings_unit: formData.servings_unit || 'porción',
      photo_url: formData.photo_url || '',
      pdf_url: formData.pdf_url || '',
      ingredients: formData.ingredients,
      sub_recipes: formData.sub_recipes,
      is_sub_recipe: formData.is_sub_recipe,
      combo_parent: formData.combo_parent || '',
      is_active: true
    };

    if (recipe) {
      updateMutation.mutate({ id: recipe.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const cost = calculateCost();
  const margin = formData.sale_price > 0 
    ? ((parseFloat(formData.sale_price) - cost) / parseFloat(formData.sale_price)) * 100 
    : 0;

  // Food cost objetivo del restaurante (desde proforma)
  const targetFoodCost = restaurant?.proforma?.direct_cost_percent || restaurant?.financial_health?.food_cost?.good_max || 30;

  // Escuchar evento de precio sugerido
  React.useEffect(() => {
    const handler = (e) => {
      setFormData(prev => ({ ...prev, sale_price: e.detail.price }));
    };
    window.addEventListener('recipe-set-suggested-price', handler);
    return () => window.removeEventListener('recipe-set-suggested-price', handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-orange-600" />
            {recipe ? 'Editar Receta' : 'Nueva Receta'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
            <TabsTrigger value="subrecipes">Sub-recetas</TabsTrigger>
            <TabsTrigger value="instructions">Preparación</TabsTrigger>
          </TabsList>

          {/* TAB: Información General */}
          <TabsContent value="info" className="space-y-4 mt-4">
            {/* Foto */}
            <div className="flex items-start gap-4">
              {formData.photo_url ? (
                <div className="relative group">
                  <img 
                    src={formData.photo_url} 
                    alt="Foto"
                    className="w-32 h-32 object-cover rounded-2xl shadow-lg border-2 border-orange-100"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, photo_url: '' })}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="w-32 h-32 border-2 border-dashed border-orange-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all">
                  {uploadingPhoto ? (
                    <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-orange-400" />
                      <span className="text-xs text-orange-500 mt-2">Subir foto</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              )}

              <div className="flex-1 space-y-3">
                <div>
                  <Label>Nombre del Plato *</Label>
                  <Input
                    value={formData.dish_name}
                    onChange={(e) => setFormData({ ...formData, dish_name: e.target.value })}
                    placeholder="Ej: Hamburguesa Clásica"
                  />
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <Label>Descripción del Plato</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción corta que aparecerá en el menú..."
                rows={2}
              />
            </div>

            {/* Menú / Combo al que pertenece */}
            {comboProducts.length > 0 && (
              <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 space-y-2">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-900 text-sm">¿Pertenece a un Menú / Combo?</p>
                    <p className="text-xs text-orange-600">Si esta receta es parte de un menú, selecciónalo aquí</p>
                  </div>
                </div>
                <Select 
                  value={formData.combo_parent || '__none__'} 
                  onValueChange={(v) => setFormData({ ...formData, combo_parent: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ninguno</SelectItem>
                    {comboProducts.map((combo) => (
                      <SelectItem key={combo} value={combo}>{combo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Switch para marcar como sub-receta */}
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-200">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-purple-900 text-sm">¿Es una Sub-receta?</p>
                  <p className="text-xs text-purple-600">Bases, salsas, preparaciones que se usan en otras recetas</p>
                </div>
              </div>
              <Switch
                checked={formData.is_sub_recipe}
                onCheckedChange={(checked) => setFormData({ ...formData, is_sub_recipe: checked })}
              />
            </div>

            {/* Precio de Venta */}
            <div className="space-y-3">
              <div>
                <Label className="flex items-center gap-1">
                  💰 Precio de Venta
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  placeholder="0"
                />
              </div>
              {/* Panel de precio sugerido - se muestra cuando hay ingredientes */}
              <RecipePriceAdvisor
                cost={cost}
                salePrice={formData.sale_price}
                servings={formData.servings}
                currency={currency}
                targetFoodCostPercent={targetFoodCost}
              />
            </div>

            {/* Detalles */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-end">
              <div>
                <Label className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Tiempo (min)
                </Label>
                <Input
                  type="number"
                  value={formData.preparation_time}
                  onChange={(e) => setFormData({ ...formData, preparation_time: e.target.value })}
                  placeholder="30"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> Porciones
                </Label>
                <Input
                  type="number"
                  value={formData.servings}
                  onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div>
                <Label>Unidad</Label>
                <Select 
                  value={formData.servings_unit} 
                  onValueChange={(v) => setFormData({ ...formData, servings_unit: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {servingsUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>PDF Receta</Label>
                {formData.pdf_url ? (
                  <div className="flex items-center gap-2 h-10">
                    <a href={formData.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline flex items-center gap-1">
                      <FileText className="w-4 h-4" /> Ver PDF
                    </a>
                    <Button variant="ghost" size="sm" onClick={() => setFormData({ ...formData, pdf_url: '' })}>
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-orange-600 transition-colors border border-dashed border-gray-300 rounded-lg h-10 px-3 hover:border-orange-400">
                    {uploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>Subir PDF</span>
                    <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                  </label>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB: Ingredientes */}
          <TabsContent value="ingredients" className="space-y-4 mt-4">
            <div className="border rounded-xl p-4 bg-gray-50">
              <Label className="text-base font-semibold">Agregar Ingrediente</Label>
              <div className="grid grid-cols-4 gap-2 mt-3">
                <Select
                  value={newIngredient.supply_id || newIngredient.supply_name}
                  onValueChange={(v) => {
                    const supply = supplyItems.find(s => s.id === v);
                    setNewIngredient({ 
                      supply_name: supply?.name || v,
                      supply_id: supply?.id || '',
                      quantity: newIngredient.quantity,
                      unit: supply?.unit_of_measure || ''
                    });
                    setSupplySearch('');
                  }}
                >
                  <SelectTrigger className="col-span-2">
                    <SelectValue placeholder="Seleccionar insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input
                        placeholder="Buscar insumo..."
                        value={supplySearch}
                        onChange={(e) => setSupplySearch(e.target.value)}
                        className="h-9"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    {supplyItems.length > 0 ? (
                      (() => {
                        const searchLower = supplySearch.toLowerCase();
                        const filtered = supplyItems.filter(item => 
                          !supplySearch || 
                          item.name?.toLowerCase().includes(searchLower) ||
                          item.category?.toLowerCase().includes(searchLower)
                        );
                        // Ordenar: primero los que coinciden por nombre, luego por categoría
                        const sorted = filtered.sort((a, b) => {
                          if (!supplySearch) return 0;
                          const aNameMatch = a.name?.toLowerCase().startsWith(searchLower) ? 0 : 
                                            a.name?.toLowerCase().includes(searchLower) ? 1 : 2;
                          const bNameMatch = b.name?.toLowerCase().startsWith(searchLower) ? 0 : 
                                            b.name?.toLowerCase().includes(searchLower) ? 1 : 2;
                          return aNameMatch - bNameMatch;
                        });
                        return sorted.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({formatCurrency(getYieldAdjustedCost(item), currency)}/{item.unit_of_measure})
                            {item.yield_percentage && item.yield_percentage < 100 ? ` [${item.yield_percentage}%]` : ''}
                          </SelectItem>
                        ));
                      })()
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No hay insumos. Crea primero en Inventario → Insumos.
                      </div>
                    )}
                    {supplyItems.length > 0 && supplySearch && supplyItems.filter(item => 
                      item.name?.toLowerCase().includes(supplySearch.toLowerCase()) ||
                      item.category?.toLowerCase().includes(supplySearch.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No se encontraron insumos con "{supplySearch}"
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Cantidad"
                  value={newIngredient.quantity}
                  onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                />
                <Input
                  placeholder="Unidad"
                  value={newIngredient.unit}
                  onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addIngredient} 
                className="mt-3"
                disabled={!newIngredient.supply_name || !newIngredient.quantity}
              >
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>

            {/* Lista de ingredientes */}
            <div className="space-y-2">
              {formData.ingredients.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay ingredientes agregados</p>
              ) : (
                formData.ingredients.map((ing, idx) => {
                  const supply = supplyItems.find(s => s.name === ing.supply_name || s.id === ing.supply_id);
                  const ingCost = getYieldAdjustedCost(supply) * ing.quantity;
                  return (
                    <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border shadow-sm">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{ing.supply_name}</p>
                        <p className="text-sm text-gray-500">{ing.quantity} {ing.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-600">{formatCurrency(ingCost, currency)}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeIngredient(idx)}>
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Resumen de costo + Advisor */}
            {formData.ingredients.length > 0 && (
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200">
                  <div className="text-center">
                    <p className="text-xs text-amber-700 font-medium">Costo Total Receta</p>
                    <p className="text-xl font-bold text-amber-800">{formatCurrency(cost, currency)}</p>
                    {formData.servings > 1 && (
                      <p className="text-xs text-amber-600 mt-1">
                        {formatCurrency(cost / formData.servings, currency)} por {formData.servings_unit || 'porción'}
                      </p>
                    )}
                  </div>
                  {formData.sub_recipes.length > 0 && (
                    <p className="text-xs text-amber-600 text-center mt-2">
                      * Incluye ingredientes + sub-recetas
                    </p>
                  )}
                </div>
                <RecipePriceAdvisor
                  cost={cost}
                  salePrice={formData.sale_price}
                  servings={formData.servings}
                  currency={currency}
                  targetFoodCostPercent={targetFoodCost}
                />
              </div>
            )}
          </TabsContent>

          {/* TAB: Sub-recetas */}
          <TabsContent value="subrecipes" className="space-y-4 mt-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-900 text-sm">¿Qué son las sub-recetas?</p>
                  <p className="text-xs text-purple-700 mt-1">
                    Son preparaciones base que se usan en otras recetas. Por ejemplo: salsas, masas, aderezos, fondos, etc.
                    El costo se calcula automáticamente incluyendo los ingredientes de cada sub-receta.
                  </p>
                </div>
              </div>
            </div>

            <div className="border rounded-xl p-4 bg-gray-50">
              <Label className="text-base font-semibold">Agregar Sub-receta</Label>
              <div className="grid grid-cols-4 gap-2 mt-3">
                <Select
                  value={newSubRecipe.recipe_id}
                  onValueChange={(v) => {
                    const selectedRecipe = availableSubRecipes.find(r => r.id === v);
                    setNewSubRecipe({
                      recipe_id: v,
                      recipe_name: selectedRecipe?.dish_name || '',
                      quantity: newSubRecipe.quantity || 1,
                      unit: selectedRecipe?.servings_unit || 'porción'
                    });
                    setSubRecipeSearch('');
                  }}
                >
                  <SelectTrigger className="col-span-2">
                    <SelectValue placeholder="Seleccionar sub-receta" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input
                        placeholder="Buscar receta..."
                        value={subRecipeSearch}
                        onChange={(e) => setSubRecipeSearch(e.target.value)}
                        className="h-9"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    {availableSubRecipes.length > 0 ? (
                      availableSubRecipes
                        .filter(r => !subRecipeSearch || r.dish_name?.toLowerCase().includes(subRecipeSearch.toLowerCase()))
                        .filter(r => !formData.sub_recipes.some(sr => sr.recipe_id === r.id))
                        .map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            <div className="flex items-center gap-2">
                              {r.is_sub_recipe && <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200">Base</Badge>}
                              <span>{r.dish_name}</span>
                              <span className="text-gray-400 text-xs">({r.servings || 1} {r.servings_unit || 'porc.'})</span>
                            </div>
                          </SelectItem>
                        ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No hay recetas disponibles para usar como sub-receta
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="Cantidad"
                  value={newSubRecipe.quantity}
                  onChange={(e) => setNewSubRecipe({ ...newSubRecipe, quantity: e.target.value })}
                />
                <Select
                  value={newSubRecipe.unit}
                  onValueChange={(v) => setNewSubRecipe({ ...newSubRecipe, unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {subRecipeUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addSubRecipe}
                className="mt-3"
                disabled={!newSubRecipe.recipe_id || !newSubRecipe.quantity}
              >
                <Plus className="w-4 h-4 mr-1" /> Agregar Sub-receta
              </Button>
            </div>

            {/* Lista de sub-recetas agregadas */}
            <div className="space-y-2">
              {formData.sub_recipes.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay sub-recetas agregadas</p>
              ) : (
                formData.sub_recipes.map((sr, idx) => {
                  const subRecipe = allRecipes.find(r => r.id === sr.recipe_id);
                  const subRecipeCostPerPortion = calculateSubRecipeCost(sr.recipe_id);
                  const totalSubRecipeCost = subRecipeCostPerPortion * sr.quantity;
                  
                  return (
                    <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border shadow-sm border-purple-100">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{sr.recipe_name}</p>
                        <p className="text-sm text-gray-500">
                          {sr.quantity} {sr.unit || 'porción'} × {formatCurrency(subRecipeCostPerPortion, currency)}/{subRecipe?.servings_unit || 'porción'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-purple-600">{formatCurrency(totalSubRecipeCost, currency)}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeSubRecipe(idx)}>
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Advertencia si no hay sub-recetas disponibles */}
            {availableSubRecipes.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 text-sm">No hay recetas disponibles</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Primero crea otras recetas que puedan servir como base (salsas, masas, etc.) y márcalas como "Sub-receta".
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB: Instrucciones de Preparación */}
          <TabsContent value="instructions" className="space-y-4 mt-4">
            <div>
              <Label className="text-base font-semibold">Instrucciones de Preparación</Label>
              <p className="text-sm text-gray-500 mb-2">Escribe paso a paso cómo preparar este plato</p>
              <Textarea
                value={formData.preparation_instructions}
                onChange={(e) => setFormData({ ...formData, preparation_instructions: e.target.value })}
                placeholder="1. Precalentar el horno a 180°C...
2. Mezclar los ingredientes secos...
3. Agregar los ingredientes húmedos..."
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            {formData.pdf_url && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700 font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  PDF de receta adjunto
                </p>
                <a href={formData.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm mt-1 inline-block">
                  Ver PDF original →
                </a>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="pt-4 border-t mt-4 space-y-3">
          {/* Mensaje informativo cuando el botón está deshabilitado */}
          {(!formData.dish_name || (formData.ingredients.length === 0 && formData.sub_recipes.length === 0)) && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                {!formData.dish_name 
                  ? 'Ingresa el nombre del plato en la pestaña "Info" para poder guardar.'
                  : 'Agrega al menos un ingrediente en la pestaña "Ingredientes" o una sub-receta en "Sub-recetas" para habilitar el guardado.'}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button 
              onClick={handleSubmit}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={!formData.dish_name || (formData.ingredients.length === 0 && formData.sub_recipes.length === 0) || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {recipe ? 'Actualizar' : 'Crear'} Receta
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}