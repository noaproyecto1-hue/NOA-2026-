import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ChefHat,
  Layers
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

// Normalizar texto: minúsculas, sin tildes, sin espacios extra
const normalize = (str) => {
  if (!str) return '';
  return str.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

export default function RecipeImportDialog({
  open,
  onOpenChange,
  restaurantId,
  supplyItems = [],
  existingRecipes = [],
  onSuccess
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setImportResult(null);
      parsePreview(selectedFile);
    }
  };

  const readXLSX = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(e.target.result, { type: 'binary', raw: false });
        resolve(workbook);
      };
      reader.readAsBinaryString(file);
    });
  };

  const parsePreview = async (file) => {
    const workbook = await readXLSX(file);
    const sheetNames = workbook.SheetNames;

    // Buscar hojas por nombre normalizado
    const recetasSheet = sheetNames.find(s => normalize(s).includes('receta')) || sheetNames[0];
    const ingredientesSheet = sheetNames.find(s => normalize(s).includes('ingrediente')) || sheetNames[1];

    if (!recetasSheet) {
      setError('No se encontró la hoja "Recetas" en el archivo');
      return;
    }

    const recetasData = XLSX.utils.sheet_to_json(workbook.Sheets[recetasSheet], { header: 1, raw: false });
    const ingredientesData = ingredientesSheet
      ? XLSX.utils.sheet_to_json(workbook.Sheets[ingredientesSheet], { header: 1, raw: false })
      : [];

    const recetaRows = recetasData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
    const ingRows = ingredientesData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

    // Contar sub-recetas referenciadas
    const ingHeaders = ingredientesData[0] || [];
    const tipoIdx = ingHeaders.findIndex(h => normalize(h) === 'tipo');
    const subRecetaCount = ingRows.filter(row => {
      const tipo = tipoIdx >= 0 ? normalize(row[tipoIdx] || '') : '';
      return tipo === 'sub_receta' || tipo === 'sub-receta' || tipo === 'subreceta';
    }).length;

    setPreview({
      recetaCount: recetaRows.length,
      ingredienteCount: ingRows.length,
      subRecetaRefCount: subRecetaCount,
      recetaHeaders: recetasData[0] || [],
      ingredienteHeaders: ingredientesData[0] || [],
      recetaSample: recetaRows.slice(0, 3),
      sheetNames
    });
  };

  const handleImport = async () => {
    if (!file || !restaurantId) return;
    setLoading(true);
    setError(null);

    const workbook = await readXLSX(file);
    const sheetNames = workbook.SheetNames;

    const recetasSheetName = sheetNames.find(s => normalize(s).includes('receta')) || sheetNames[0];
    const ingredientesSheetName = sheetNames.find(s => normalize(s).includes('ingrediente')) || sheetNames[1];

    const recetasRaw = XLSX.utils.sheet_to_json(workbook.Sheets[recetasSheetName], { header: 1, raw: false });
    const ingredientesRaw = ingredientesSheetName
      ? XLSX.utils.sheet_to_json(workbook.Sheets[ingredientesSheetName], { header: 1, raw: false })
      : [];

    // --- Parsear hoja Recetas ---
    const recHeaders = (recetasRaw[0] || []).map(h => normalize(h));
    const recIdx = (key) => recHeaders.findIndex(h => h === key || h.includes(key));

    const iNombre = recIdx('nombre');
    const iCategoria = recIdx('categoria');
    const iDescripcion = recIdx('descripcion');
    const iPrecio = recIdx('precio');
    const iTiempo = recIdx('tiempo');
    const iPorciones = recIdx('porciones');
    const iUnidadPorciones = recHeaders.findIndex(h => h.includes('unidad') && h.includes('porcion'));
    const iSubReceta = recHeaders.findIndex(h => h.includes('sub_receta') || h.includes('sub-receta') || h.includes('subreceta') || h.includes('es_sub'));
    const iInstrucciones = recIdx('instrucciones') >= 0 ? recIdx('instrucciones') : recIdx('preparacion');

    if (iNombre < 0) {
      setError('No se encontró la columna "nombre_receta" en la hoja Recetas');
      setLoading(false);
      return;
    }

    const recipesMap = {}; // normalized name → recipe data

    for (const row of recetasRaw.slice(1)) {
      const nombre = (row[iNombre] || '').toString().trim();
      if (!nombre) continue;

      const isSubReceta = iSubReceta >= 0
        ? ['true', 'si', 'sí', '1', 'yes', 'verdadero'].includes(normalize(row[iSubReceta] || ''))
        : false;

      recipesMap[normalize(nombre)] = {
        restaurant_id: restaurantId,
        dish_name: nombre,
        category: iCategoria >= 0 ? (row[iCategoria] || '').toString().trim() || 'Comida' : 'Comida',
        description: iDescripcion >= 0 ? (row[iDescripcion] || '').toString().trim() : '',
        sale_price: iPrecio >= 0 ? parseFloat(row[iPrecio]) || 0 : 0,
        preparation_time: iTiempo >= 0 ? parseInt(row[iTiempo]) || 0 : 0,
        servings: iPorciones >= 0 ? parseInt(row[iPorciones]) || 1 : 1,
        servings_unit: iUnidadPorciones >= 0 ? (row[iUnidadPorciones] || '').toString().trim() || 'porción' : 'porción',
        is_sub_recipe: isSubReceta,
        preparation_instructions: iInstrucciones >= 0 ? (row[iInstrucciones] || '').toString().trim() : '',
        ingredients: [],
        sub_recipes: [],
        is_active: true
      };
    }

    // --- Parsear hoja Ingredientes ---
    if (ingredientesRaw.length > 1) {
      const ingHeaders = (ingredientesRaw[0] || []).map(h => normalize(h));
      const ingIdx = (key) => ingHeaders.findIndex(h => h === key || h.includes(key));

      const iIngReceta = ingIdx('nombre_receta') >= 0 ? ingIdx('nombre_receta') : ingIdx('receta');
      const iIngTipo = ingHeaders.findIndex(h => h === 'tipo');
      const iIngNombre = ingHeaders.findIndex(h =>
        (h.includes('nombre') && (h.includes('insumo') || h.includes('ingrediente') || h.includes('sub'))) ||
        h === 'nombre_insumo' || h === 'nombre_ingrediente' || h === 'nombre_sub_receta'
      );
      // Fallback: si no encontramos columna específica, buscar la segunda columna con "nombre" que no sea nombre_receta
      const iIngNombreFallback = iIngNombre >= 0 ? iIngNombre : ingHeaders.findIndex((h, idx) => idx !== iIngReceta && h.includes('nombre'));
      const iIngCantidad = ingIdx('cantidad');
      const iIngUnidad = ingIdx('unidad');

      if (iIngReceta < 0) {
        setError('No se encontró la columna "nombre_receta" en la hoja Ingredientes');
        setLoading(false);
        return;
      }

      // Crear mapa de insumos normalizado para buscar supply_id
      const supplyMap = {};
      supplyItems.forEach(s => {
        supplyMap[normalize(s.name)] = s;
      });

      for (const row of ingredientesRaw.slice(1)) {
        const recipeName = normalize((row[iIngReceta] || '').toString().trim());
        if (!recipeName) continue;

        const recipeData = recipesMap[recipeName];
        if (!recipeData) continue; // Receta no encontrada en hoja 1

        const tipo = iIngTipo >= 0 ? normalize(row[iIngTipo] || '') : 'ingrediente';
        const nombre = (row[iIngNombreFallback] || '').toString().trim();
        if (!nombre) continue;

        const cantidad = iIngCantidad >= 0 ? parseFloat(row[iIngCantidad]) || 0 : 0;
        const unidad = iIngUnidad >= 0 ? (row[iIngUnidad] || '').toString().trim() : '';

        const isSubRecetaRef = tipo === 'sub_receta' || tipo === 'sub-receta' || tipo === 'subreceta';

        if (isSubRecetaRef) {
          // Es referencia a sub-receta — se vinculará después de crear
          recipeData.sub_recipes.push({
            _temp_name: nombre, // Se resolverá al ID real después
            recipe_name: nombre,
            quantity: cantidad || 1,
            unit: unidad || 'porción'
          });
        } else {
          // Es ingrediente normal — buscar en catálogo de insumos
          const supplyItem = supplyMap[normalize(nombre)];
          recipeData.ingredients.push({
            supply_name: supplyItem ? supplyItem.name : nombre, // Usar nombre normalizado del catálogo
            supply_id: supplyItem ? supplyItem.id : '',
            quantity: cantidad,
            unit: unidad || (supplyItem ? supplyItem.unit_of_measure : '')
          });
        }
      }
    }

    // --- Crear recetas: primero sub-recetas, luego las demás ---
    const allRecipes = Object.values(recipesMap);
    const subRecipes = allRecipes.filter(r => r.is_sub_recipe);
    const mainRecipes = allRecipes.filter(r => !r.is_sub_recipe);

    // Mapa para resolver sub-receta nombre → id
    const createdRecipeMap = {}; // normalized name → created recipe id

    // También incluir recetas existentes para vincular sub-recetas
    existingRecipes.forEach(r => {
      createdRecipeMap[normalize(r.dish_name)] = r.id;
    });

    let createdCount = 0;
    let skippedCount = 0;
    const warnings = [];

    // Crear sub-recetas primero
    for (const recipe of subRecipes) {
      const normalizedName = normalize(recipe.dish_name);
      // Si ya existe, no duplicar
      if (createdRecipeMap[normalizedName]) {
        skippedCount++;
        continue;
      }

      const { _temp_name, ...cleanRecipe } = recipe;
      // Limpiar sub_recipes temporales
      cleanRecipe.sub_recipes = recipe.sub_recipes.map(sr => {
        const srId = createdRecipeMap[normalize(sr._temp_name)];
        if (!srId) {
          warnings.push(`Sub-receta "${sr._temp_name}" no encontrada para "${recipe.dish_name}"`);
          return null;
        }
        return { recipe_id: srId, recipe_name: sr.recipe_name, quantity: sr.quantity, unit: sr.unit };
      }).filter(Boolean);

      const created = await base44.entities.Recipe.create(cleanRecipe);
      createdRecipeMap[normalizedName] = created.id;
      createdCount++;
    }

    // Crear recetas principales
    for (const recipe of mainRecipes) {
      const normalizedName = normalize(recipe.dish_name);
      if (createdRecipeMap[normalizedName]) {
        skippedCount++;
        continue;
      }

      // Resolver sub-recetas por nombre
      recipe.sub_recipes = recipe.sub_recipes.map(sr => {
        const srId = createdRecipeMap[normalize(sr._temp_name)];
        if (!srId) {
          warnings.push(`Sub-receta "${sr._temp_name}" no encontrada para "${recipe.dish_name}"`);
          return null;
        }
        return { recipe_id: srId, recipe_name: sr.recipe_name, quantity: sr.quantity, unit: sr.unit };
      }).filter(Boolean);

      // Limpiar _temp_name de sub_recipes
      delete recipe._temp_name;

      const created = await base44.entities.Recipe.create(recipe);
      createdRecipeMap[normalizedName] = created.id;
      createdCount++;
    }

    setImportResult({ createdCount, skippedCount, warnings });
    queryClient.invalidateQueries({ queryKey: ['myRecipes'] });
    setLoading(false);

    if (warnings.length === 0 && createdCount > 0) {
      setTimeout(() => {
        onSuccess?.(createdCount);
        onOpenChange(false);
        resetState();
      }, 2000);
    }
  };

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setImportResult(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-orange-600" />
            Importar Recetas desde XLSX
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
            {!file ? (
              <label className="cursor-pointer">
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1">Arrastra tu archivo XLSX aquí o haz clic para seleccionar</p>
                <p className="text-xs text-gray-400">Usa la plantilla "Recetas" descargable desde Plantillas</p>
              </label>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-orange-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      Hojas: {preview?.sheetNames?.join(', ')}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetState}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview && !importResult && (
            <Card className="p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-500" />
                Resumen del archivo
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-orange-700">{preview.recetaCount}</p>
                  <p className="text-xs text-orange-600">Recetas</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{preview.ingredienteCount}</p>
                  <p className="text-xs text-amber-600">Ingredientes</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">{preview.subRecetaRefCount}</p>
                  <p className="text-xs text-purple-600">Sub-recetas ref.</p>
                </div>
              </div>

              {/* Sample */}
              {preview.recetaSample.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <p className="text-xs text-gray-500 mb-1">Vista previa (primeras 3 recetas):</p>
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="border-b">
                        {preview.recetaHeaders.slice(0, 5).map((h, i) => (
                          <th key={i} className="text-left p-1.5 text-gray-600 truncate max-w-[120px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.recetaSample.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          {row.slice(0, 5).map((cell, j) => (
                            <td key={j} className="p-1.5 text-gray-700 truncate max-w-[120px]">{cell || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Info */}
          {!importResult && (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <AlertDescription className="text-orange-800 text-sm">
                <strong>Formato:</strong> El archivo debe tener 2 hojas: <strong>"Recetas"</strong> (info general) e <strong>"Ingredientes"</strong> (insumos y sub-recetas por receta). No importa mayúsculas/minúsculas ni tildes.
              </AlertDescription>
            </Alert>
          )}

          {/* Import Result */}
          {importResult && (
            <Card className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <h4 className="font-bold text-emerald-900 text-lg">Importación completada</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{importResult.createdCount}</p>
                  <p className="text-xs text-emerald-600">Recetas creadas</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-500">{importResult.skippedCount}</p>
                  <p className="text-xs text-gray-500">Ya existían (omitidas)</p>
                </div>
              </div>
              {importResult.warnings.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-medium text-amber-800 mb-1">Advertencias:</p>
                  {importResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">• {w}</p>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={!file || !preview || loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar {preview?.recetaCount || 0} recetas
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}