import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { FlaskConical, Loader2, ChefHat, ArrowUp, ArrowDown, Minus, UserCircle, Search } from "lucide-react";

export default function SamplingFormDialog({ open, onOpenChange, recipe, restaurantId, restaurant, user }) {
  const queryClient = useQueryClient();
  const [servingsSampled, setServingsSampled] = useState(1);
  const [ingredientValues, setIngredientValues] = useState({});
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const isManager = user?.role === 'admin' || user?.app_role === 'manager';
  const ingredients = useMemo(() => recipe?.ingredients || [], [recipe]);

  // Get kitchen employees from restaurant config
  const kitchenEmployees = useMemo(() => {
    const employees = restaurant?.config?.employees || [];
    const activeEmployees = employees.filter(e => e.is_active !== false);
    // Filter by area "Cocina" if areas are used, otherwise show all
    const classMode = restaurant?.config?.employee_classification_mode;
    if (classMode === 'areas') {
      const cocina = activeEmployees.filter(e => 
        (e.area || '').toLowerCase().includes('cocina') || 
        (e.area || '').toLowerCase().includes('kitchen')
      );
      // If no kitchen area employees found, show all
      return cocina.length > 0 ? cocina : activeEmployees;
    }
    return activeEmployees;
  }, [restaurant]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return kitchenEmployees;
    return kitchenEmployees.filter(e => 
      (e.name || '').toLowerCase().includes(employeeSearch.toLowerCase())
    );
  }, [kitchenEmployees, employeeSearch]);

  useEffect(() => {
    if (recipe && open) {
      setServingsSampled(1);
      setNotes('');
      setAccepted(false); // Always start from employee selection
      setSelectedEmployee(null);
      setEmployeeSearch('');
      const initial = {};
      ingredients.forEach((ing, idx) => {
        initial[idx] = '';
      });
      setIngredientValues(initial);
    }
  }, [recipe, open, ingredients]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Crear el registro de muestreo (reporte de desviación)
      const sample = await base44.entities.RecipeSample.create(data);

      // 2. Descontar stock de insumos por el muestreo
      // Usamos las cantidades REALES registradas (lo que realmente se usó)
      if (data.ingredients?.length > 0) {
        const allSupplyItems = await base44.entities.SupplyItem.filter({ restaurant_id: data.restaurant_id });
        const supplyByName = {};
        allSupplyItems.forEach(s => {
          supplyByName[s.name?.toLowerCase().trim()] = s;
        });

        const movements = [];
        const updates = [];

        for (const ing of data.ingredients) {
          const key = (ing.supply_name || '').toLowerCase().trim();
          const supply = supplyByName[key];
          if (!supply || !ing.actual_quantity) continue;

          const previousStock = supply.current_stock || 0;
          const newStock = parseFloat(Math.max(0, previousStock - ing.actual_quantity).toFixed(3));

          updates.push({ id: supply.id, data: { current_stock: newStock } });
          movements.push({
            restaurant_id: data.restaurant_id,
            product_name: supply.name,
            product_id: supply.id,
            item_type: 'supply',
            movement_type: 'sampling',
            quantity: -ing.actual_quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            transaction_date: new Date().toISOString(),
            reference_id: sample.id,
            reference_name: `Muestreo: ${data.recipe_name}`,
            notes: `Muestreo de ${data.servings_sampled}x ${data.recipe_name} por ${data.sampled_by_name}`
          });
        }

        // Ejecutar actualizaciones de stock
        for (const u of updates) {
          await base44.entities.SupplyItem.update(u.id, u.data);
        }

        // Crear movimientos de stock en bulk
        if (movements.length > 0) {
          await base44.entities.StockMovement.bulkCreate(movements);
        }
      }

      return sample;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipeSamples'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      onOpenChange(false);
    }
  });

  const handleSubmit = () => {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const month = now.toISOString().slice(0, 7);

    const sampledIngredients = ingredients.map((ing, idx) => {
      const expected = (ing.quantity || 0) * servingsSampled;
      const actual = parseFloat(ingredientValues[idx]) || 0;
      const deviationPercent = expected > 0 ? ((actual - expected) / expected) * 100 : 0;
      return {
        supply_name: ing.supply_name,
        supply_id: ing.supply_id || '',
        expected_quantity: Math.round(expected * 1000) / 1000,
        actual_quantity: actual,
        unit: ing.unit || '',
        deviation_percent: Math.round(deviationPercent * 10) / 10
      };
    });

    const totalDeviation = sampledIngredients.length > 0
      ? sampledIngredients.reduce((sum, i) => sum + Math.abs(i.deviation_percent), 0) / sampledIngredients.length
      : 0;

    createMutation.mutate({
      restaurant_id: restaurantId,
      recipe_id: recipe.id,
      recipe_name: recipe.dish_name,
      sampled_by_email: selectedEmployee?.email || user?.email || '',
      sampled_by_name: selectedEmployee?.name || user?.display_name || user?.full_name || '',
      date: now.toISOString().slice(0, 10),
      servings_sampled: servingsSampled,
      ingredients: sampledIngredients,
      overall_deviation_percent: Math.round(totalDeviation * 10) / 10,
      notes,
      week_number: weekNumber,
      month
    });
  };

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const allFilled = ingredients.every((_, idx) => ingredientValues[idx] !== '' && ingredientValues[idx] !== undefined);

  // Staff cannot close mid-sampling (once accepted)
  const handleOpenChange = (newOpen) => {
    if (!newOpen && accepted) {
      // Cannot close once sampling started — must finish
      return;
    }
    onOpenChange(newOpen);
  };

  // Step flow: 1) Select employee -> 2) Confirm rules -> 3) Register ingredients
  const showEmployeeStep = !selectedEmployee;
  const showConfirmStep = selectedEmployee && !accepted;
  const showFormStep = selectedEmployee && accepted;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => { if (accepted) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-600" />
            Muestreo: {recipe?.dish_name}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select who is sampling */}
        {showEmployeeStep ? (
          <div className="space-y-4 py-2">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                <UserCircle className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">¿Quién va a muestrear?</h3>
              <p className="text-sm text-gray-500">Selecciona al miembro del equipo que realizará este muestreo</p>
            </div>

            {kitchenEmployees.length > 5 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar empleado..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}

            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No se encontraron empleados</p>
                  <p className="text-gray-400 text-xs mt-1">Agrega empleados en Configuración del restaurante</p>
                </div>
              ) : filteredEmployees.map(emp => (
                <button
                  key={emp.id || emp.name}
                  onClick={() => setSelectedEmployee(emp)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-indigo-700 font-bold text-sm">
                      {(emp.name || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{emp.name}</p>
                    <p className="text-xs text-gray-400">{emp.role || emp.area || 'Equipo'}</p>
                  </div>
                </button>
              ))}
            </div>

            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        ) : showConfirmStep ? (
          <div className="space-y-4 py-4">
            {/* Show selected employee */}
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="w-10 h-10 bg-indigo-200 rounded-full flex items-center justify-center shrink-0">
                <span className="text-indigo-800 font-bold">{(selectedEmployee?.name || '?')[0].toUpperCase()}</span>
              </div>
              <div>
                <p className="font-semibold text-indigo-900 text-sm">{selectedEmployee?.name}</p>
                <p className="text-xs text-indigo-600">Registrará este muestreo</p>
              </div>
              <button onClick={() => setSelectedEmployee(null)} className="ml-auto text-xs text-indigo-500 underline">Cambiar</button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-3">
              <h3 className="font-bold text-gray-900">Antes de comenzar</h3>
              <div className="text-sm text-gray-700 text-left space-y-2 bg-white rounded-lg p-4 border">
                <p className="font-semibold text-amber-800">⚠️ Reglas del muestreo:</p>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>Pesa cada ingrediente <strong>antes</strong> de registrar.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>Una vez iniciado, <strong>no podrás salir</strong> sin completar el muestreo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>Registra las cantidades <strong>reales</strong> con honestidad.</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setSelectedEmployee(null); onOpenChange(false); }}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => setAccepted(true)}>
                Estoy listo, comenzar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info receta */}
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
              {recipe?.photo_url ? (
                <img src={recipe.photo_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
              ) : (
                <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
                  <ChefHat className="w-7 h-7 text-orange-500" />
                </div>
              )}
              <div>
                <p className="font-bold text-gray-900">{recipe?.dish_name}</p>
                <p className="text-xs text-gray-500">{recipe?.category} · {ingredients.length} ingredientes</p>
                <Badge className="bg-orange-100 text-orange-700 border-0 text-xs mt-1">
                  Rinde {recipe?.servings || 1} {recipe?.servings_unit || 'porción'}
                </Badge>
              </div>
            </div>

            {/* Ingredientes */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Registra las cantidades reales</Label>
              <div className="space-y-2">
                {ingredients.map((ing, idx) => {
                  const expected = (ing.quantity || 0) * servingsSampled;
                  const actual = parseFloat(ingredientValues[idx]) || 0;
                  const hasValue = ingredientValues[idx] !== '' && ingredientValues[idx] !== undefined;
                  const deviation = hasValue && expected > 0 ? ((actual - expected) / expected) * 100 : null;
                  
                  return (
                    <div key={idx} className="bg-white border rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{ing.supply_name}</p>
                          {/* Only show standard for managers */}
                          {isManager && (
                            <p className="text-xs text-gray-400">
                              Estándar: <span className="font-semibold text-gray-600">{Math.round(expected * 1000) / 1000} {ing.unit}</span>
                            </p>
                          )}
                        </div>
                        {/* Only show deviation badge for managers */}
                        {isManager && deviation !== null && (
                          <Badge className={`border-0 text-xs ${
                            Math.abs(deviation) <= 5 ? 'bg-emerald-100 text-emerald-700' :
                            Math.abs(deviation) <= 15 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {deviation > 0 && <ArrowUp className="w-3 h-3 mr-0.5" />}
                            {deviation < 0 && <ArrowDown className="w-3 h-3 mr-0.5" />}
                            {deviation === 0 && <Minus className="w-3 h-3 mr-0.5" />}
                            {Math.abs(deviation).toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.001"
                          placeholder={`Cantidad usada (${ing.unit})`}
                          value={ingredientValues[idx] || ''}
                          onChange={(e) => setIngredientValues({ ...ingredientValues, [idx]: e.target.value })}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-500 w-12">{ing.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Staff reminder */}
            {!isManager && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-700">🔒 Completa todos los ingredientes para registrar el muestreo</p>
              </div>
            )}

            <Button 
              onClick={handleSubmit} 
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={!allFilled || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Muestreo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}