import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle, Carrot, Layers, MapPin, Info } from "lucide-react";
import { syncConfigAfterImport, extractValuesFromSupplyImport } from '../utils/configAutoSync';

export default function SupplyImportDialog({ open, onOpenChange, restaurantId, restaurant, restaurantConfig, onSuccess }) {
  const [importMode, setImportMode] = useState(null); // null = elegir, 'all' = todo, 'area' = por área
  const [selectedArea, setSelectedArea] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState([]);
  const queryClient = useQueryClient();

  const configuredAreas = restaurantConfig?.preparation_zones || [];

  const createBulkSupplyMutation = useMutation({
    mutationFn: (data) => base44.entities.SupplyItem.bulkCreate(data),
  });

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (jsonData.length < 2) {
        setErrors(['El archivo está vacío o no tiene datos']);
        return;
      }

      const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
      const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

      // Mapear headers esperados - ALINEADO con plantilla XLSX de TemplatesDownloadDialog
      // Plantilla usa: nombre_insumo, item_compra, categoria_insumo, costo_unitario, unidad, stock
      const headerMap = {
        'nombre_insumo': ['nombre_insumo', 'nombre', 'insumo', 'name'],
        'categoria_insumo': ['categoria_insumo', 'categoria', 'category', 'categoria insumo'],
        'area': ['area', 'zona', 'zona_preparacion', 'zona preparacion', 'area_preparacion'],
        'proveedor': ['proveedor', 'supplier', 'proveedor_principal'],
        'stock': ['stock', 'cantidad', 'current_stock'],
        'unidad': ['unidad', 'unidad_medida', 'unit', 'unit_of_measure'],
        'costo_unitario': ['costo_unitario', 'costo', 'cost', 'unit_cost', 'costo unitario'],
        'stock_advertencia': ['stock_advertencia', 'warning_stock', 'stock_warning', 'advertencia', 'stock advertencia'],
        'stock_critico': ['stock_critico', 'min_stock', 'stock_minimo', 'critico', 'stock critico', 'stock_min'],
        'item_compra': ['item_compra', 'item', 'purchase_item', 'item compra'],
        'rendimiento': ['rendimiento', 'yield', 'yield_percentage', 'rendimiento_%', 'rendimiento_porcentaje'],
        'stock_ideal': ['stock_ideal', 'ideal_stock', 'stock ideal', 'ideal']
      };

      const findIndex = (keys) => {
        for (const key of keys) {
          const idx = headers.indexOf(key);
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const indices = {
        nombre: findIndex(headerMap.nombre_insumo),
        categoria: findIndex(headerMap.categoria_insumo),
        area: findIndex(headerMap.area),
        proveedor: findIndex(headerMap.proveedor),
        stock: findIndex(headerMap.stock),
        unidad: findIndex(headerMap.unidad),
        costo: findIndex(headerMap.costo_unitario),
        stock_advertencia: findIndex(headerMap.stock_advertencia),
        stock_critico: findIndex(headerMap.stock_critico),
        item: findIndex(headerMap.item_compra),
        rendimiento: findIndex(headerMap.rendimiento),
        stock_ideal: findIndex(headerMap.stock_ideal)
      };

      if (indices.nombre === -1) {
        setErrors(['No se encontró la columna "nombre_insumo"']);
        return;
      }

      // Mapear unidades válidas - incluye variantes con/sin tildes, singular/plural, abreviaciones
      const unitMap = {
        'kg': 'kg', 'kilogramo': 'kg', 'kilogramos': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kilógramo': 'kg', 'kilógramos': 'kg',
        'g': 'g', 'gr': 'g', 'grs': 'g', 'gramo': 'g', 'gramos': 'g',
        'l': 'L', 'lt': 'L', 'lts': 'L', 'litro': 'L', 'litros': 'L',
        'ml': 'ml', 'mililitro': 'ml', 'mililitros': 'ml',
        'unidad': 'unidad', 'unidades': 'unidad', 'un': 'unidad', 'u': 'unidad', 'und': 'unidad', 'uds': 'unidad', 'ud': 'unidad',
        'docena': 'docena', 'docenas': 'docena', 'doc': 'docena',
        'lb': 'lb', 'libra': 'lb', 'libras': 'lb', 'lbs': 'lb',
        'oz': 'oz', 'onza': 'oz', 'onzas': 'oz',
        'paquete': 'paquete', 'paquetes': 'paquete', 'paq': 'paquete',
        'caja': 'caja', 'cajas': 'caja',
        'pieza': 'pieza', 'piezas': 'pieza', 'pza': 'pieza', 'pzas': 'pieza', 'pz': 'pieza',
        'frasco': 'frasco', 'frascos': 'frasco',
        // Extras comunes
        'saco': 'unidad', 'sacos': 'unidad',
        'botella': 'unidad', 'botellas': 'unidad',
        'bolsa': 'unidad', 'bolsas': 'unidad',
        'rollo': 'unidad', 'rollos': 'unidad',
        'sobre': 'unidad', 'sobres': 'unidad',
        'barra': 'unidad', 'barras': 'unidad',
        'lata': 'unidad', 'latas': 'unidad',
        'galon': 'L', 'galón': 'L', 'galones': 'L',
      };

      const parseUnit = (val) => {
        if (!val) return 'unidad';
        const normalized = String(val).toLowerCase().trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quitar tildes para match
        // Buscar primero con tildes intactas
        const directMatch = unitMap[String(val).toLowerCase().trim()];
        if (directMatch) return directMatch;
        // Buscar sin tildes
        return unitMap[normalized] || 'unidad';
      };

      // === Matching inteligente de categorías ===
      // Obtener categorías configuradas del restaurante
      const configuredCategories = restaurantConfig?.supply_categories || [];
      
      const normalizeCat = (str) => {
        if (!str) return '';
        return str.toString().toUpperCase().trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      };

      const matchCategory = (rawCategory) => {
        if (!rawCategory || configuredCategories.length === 0) return rawCategory || 'General';
        
        const normalized = normalizeCat(rawCategory);
        
        // 1. Coincidencia exacta (normalizada)
        const exactMatch = configuredCategories.find(c => normalizeCat(c) === normalized);
        if (exactMatch) return exactMatch;

        // 2. Una contiene a la otra
        const containsMatch = configuredCategories.find(c => {
          const nc = normalizeCat(c);
          return nc.includes(normalized) || normalized.includes(nc);
        });
        if (containsMatch) return containsMatch;

        // 3. Coincidencia por palabras clave (al menos una palabra significativa en común)
        const normalizedWords = normalized.split(' ').filter(w => w.length > 2);
        const wordMatch = configuredCategories.find(c => {
          const catWords = normalizeCat(c).split(' ').filter(w => w.length > 2);
          return normalizedWords.some(nw => catWords.some(cw => cw.includes(nw) || nw.includes(cw)));
        });
        if (wordMatch) return wordMatch;

        // 4. Similitud por inicio de texto (primeros 4+ caracteres)
        const prefixMatch = configuredCategories.find(c => {
          const nc = normalizeCat(c);
          const minLen = Math.min(normalized.length, nc.length, 5);
          return minLen >= 3 && nc.slice(0, minLen) === normalized.slice(0, minLen);
        });
        if (prefixMatch) return prefixMatch;

        // Sin match → devolver el original tal cual 
        return rawCategory;
      };

      // Función para parsear números con formato de comas/puntos (soporta formato español y americano)
      // IMPORTANTE: Preserva hasta 3 decimales para costos unitarios precisos
      const parseNumber = (val) => {
        if (val === null || val === undefined || val === '') return 0;
        
        // Si ya es número, devolverlo directamente con precisión de 3 decimales
        if (typeof val === 'number') return parseFloat(val.toFixed(6));
        
        let str = String(val).trim();
        
        // Eliminar símbolos de moneda y espacios
        str = str.replace(/[$€£¥]/g, '').trim();
        
        // Detectar formato basándose en la posición de comas y puntos
        const hasComma = str.includes(',');
        const hasDot = str.includes('.');
        
        if (hasComma && hasDot) {
          // Tiene ambos: determinar cuál es el decimal
          const lastComma = str.lastIndexOf(',');
          const lastDot = str.lastIndexOf('.');
          
          if (lastComma > lastDot) {
            // Formato español: 1.234,56 → la coma es decimal
            str = str.replace(/\./g, '').replace(',', '.');
          } else {
            // Formato americano: 1,234.56 → el punto es decimal
            str = str.replace(/,/g, '');
          }
        } else if (hasComma) {
          // Solo coma: verificar si es separador de miles o decimal
          const parts = str.split(',');
          if (parts.length === 2 && parts[1].length <= 3) {
            // Probablemente decimal español: 123,45 o 123,456
            str = str.replace(',', '.');
          } else {
            // Probablemente miles: 1,234 o 1,234,567
            str = str.replace(/,/g, '');
          }
        } else if (hasDot) {
          // Solo punto: verificar si es separador de miles o decimal
          const parts = str.split('.');
          if (parts.length === 2 && parts[1].length <= 3) {
            // Decimal: 123.45 o 123.456 - parseFloat lo maneja correctamente
          } else if (parts.length > 2 || (parts.length === 2 && parts[1].length > 3)) {
            // Separador de miles: 1.234.567 (más de 3 decimales = probablemente miles)
            // Pero si es exactamente 2 partes, puede ser un decimal legítimo con muchos dígitos
            if (parts.length > 2) {
              str = str.replace(/\./g, '');
            }
          }
        }
        
        const result = parseFloat(str);
        return isNaN(result) ? 0 : result;
      };

      // === Matching inteligente de áreas contra zonas configuradas ===
      const normalizeForMatch = (str) => {
        if (!str) return '';
        return str.toString().toUpperCase().trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      };

      const matchArea = (rawArea) => {
        if (!rawArea) return '';
        const titleCased = rawArea.toString().trim()
          .split(/\s+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        
        if (configuredAreas.length === 0) return titleCased;

        const normalized = normalizeForMatch(rawArea);

        // 1. Coincidencia exacta (sin tildes ni mayúsculas)
        const exactMatch = configuredAreas.find(a => normalizeForMatch(a) === normalized);
        if (exactMatch) return exactMatch;

        // 2. Una contiene a la otra
        const containsMatch = configuredAreas.find(a => {
          const na = normalizeForMatch(a);
          return na.includes(normalized) || normalized.includes(na);
        });
        if (containsMatch) return containsMatch;

        // 3. Coincidencia por prefijo (primeros 4+ chars)
        const prefixMatch = configuredAreas.find(a => {
          const na = normalizeForMatch(a);
          const minLen = Math.min(normalized.length, na.length, 5);
          return minLen >= 3 && na.slice(0, minLen) === normalized.slice(0, minLen);
        });
        if (prefixMatch) return prefixMatch;

        // Sin match → devolver con formato Title Case
        return titleCased;
      };

      // === Normalización de nombre de insumo ===
      // Capitaliza primera letra de cada palabra, respeta mayúsculas intencionales en medio
      const normalizeName = (raw) => {
        if (!raw) return '';
        const trimmed = raw.toString().trim();
        // Si está todo en mayúsculas, convertir a Title Case
        if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) {
          return trimmed.split(/\s+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
        }
        // Si ya tiene formato mixto, solo asegurar primera letra mayúscula
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      };

      const parsedData = rows.map((row, idx) => {
        const rawCategory = indices.categoria !== -1 ? row[indices.categoria] : '';
        return {
          rowNum: idx + 2,
          nombre_insumo: normalizeName(row[indices.nombre] || ''),
          categoria_insumo: rawCategory || '',
          matched_category: matchCategory(rawCategory) || 'General',
          area: importMode === 'area' && selectedArea 
            ? selectedArea 
            : matchArea(indices.area !== -1 ? row[indices.area] : ''),
          proveedor: indices.proveedor !== -1 ? (row[indices.proveedor] || '').toString().trim() : '',
          stock: indices.stock !== -1 ? parseNumber(row[indices.stock]) : 0,
          unidad: indices.unidad !== -1 ? parseUnit(row[indices.unidad]) : 'unidad',
          costo_unitario: indices.costo !== -1 ? parseNumber(row[indices.costo]) : 0,
          warning_stock: indices.stock_advertencia !== -1 ? parseNumber(row[indices.stock_advertencia]) : 0,
          min_stock: indices.stock_critico !== -1 ? parseNumber(row[indices.stock_critico]) : 0,
          item_compra: indices.item !== -1 ? row[indices.item] : '',
          rendimiento: indices.rendimiento !== -1 ? (parseNumber(row[indices.rendimiento]) || 100) : 100,
          stock_ideal: indices.stock_ideal !== -1 ? parseNumber(row[indices.stock_ideal]) : 0
        };
      }).filter(item => item.nombre_insumo);

      setPreview(parsedData);
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImport = async () => {
    if (!restaurantId || preview.length === 0) return;

    setIsProcessing(true);
    setErrors([]);
    let successCount = 0;
    const importErrors = [];

    // Preparar todos los registros
    const records = preview.map(item => ({
      restaurant_id: restaurantId,
      name: item.nombre_insumo,
      category: item.matched_category,
      area: item.area || '',
      supplier: item.proveedor || '',
      unit_of_measure: item.unidad,
      average_unit_cost: parseFloat(item.costo_unitario.toFixed(3)),
      yield_percentage: Math.min(100, Math.max(1, item.rendimiento || 100)),
      current_stock: parseFloat(item.stock.toFixed(3)),
      ideal_stock: parseFloat((item.stock_ideal || 0).toFixed(3)),
      warning_stock: parseFloat(item.warning_stock.toFixed(3)),
      min_stock: parseFloat(item.min_stock.toFixed(3)),
      is_active: true
    }));

    // Importar en lotes de 25 para evitar rate limit
    const BATCH_SIZE = 25;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      try {
        await createBulkSupplyMutation.mutateAsync(batch);
        successCount += batch.length;
      } catch (error) {
        // Si falla el batch, intentar de a uno para identificar el problemático
        for (let j = 0; j < batch.length; j++) {
          try {
            await base44.entities.SupplyItem.create(batch[j]);
            successCount++;
          } catch (singleError) {
            const rowNum = i + j + 2;
            importErrors.push(`Fila ${rowNum} (${batch[j].name}): ${singleError.message || 'Error desconocido'}`);
          }
        }
      }
      // Pausa entre lotes para no saturar la API
      if (i + BATCH_SIZE < records.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setIsProcessing(false);

    if (importErrors.length > 0) {
      setErrors(importErrors);
    }

    if (successCount > 0) {
      // Auto-sincronizar configuración: agregar categorías y áreas nuevas
      if (restaurant) {
        const newValues = extractValuesFromSupplyImport(preview);
        const syncResult = await syncConfigAfterImport(restaurantId, restaurant, newValues);
        if (syncResult.updated) {
          queryClient.invalidateQueries({ queryKey: ['restaurants'] });
          queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      onSuccess?.(successCount);
      onOpenChange(false);
      resetState();
    }
  };

  const resetState = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
    setImportMode(null);
    setSelectedArea('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Carrot className="w-5 h-5 text-green-600" />
            Importar Insumos desde XLSX
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Mode Selection */}
          {!importMode && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setImportMode('all')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50/50 transition-all text-center group"
              >
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <Layers className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Todo el inventario</p>
                  <p className="text-xs text-gray-500 mt-1">Importar insumos de todas las áreas.<br/>La columna <b>area</b> es requerida en el XLSX.</p>
                </div>
              </button>
              <button
                onClick={() => setImportMode('area')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-center group"
              >
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <MapPin className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Por área / zona</p>
                  <p className="text-xs text-gray-500 mt-1">Importar insumos de un área específica.<br/>La columna <b>area</b> NO es necesaria.</p>
                </div>
              </button>
            </div>
          )}

          {/* Step 1.5: Area selection (when mode = area) */}
          {importMode === 'area' && !selectedArea && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Selecciona el área para esta importación:</p>
              {configuredAreas.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {configuredAreas.map(area => (
                    <button
                      key={area}
                      onClick={() => setSelectedArea(area)}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                    >
                      <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="font-medium text-gray-800 text-sm">{area}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <Card className="p-4 bg-yellow-50 border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    No tienes zonas de preparación configuradas. Ve a <b>Configuración del restaurante</b> para agregar áreas.
                  </p>
                </Card>
              )}
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setImportMode(null)}>
                ← Volver
              </Button>
            </div>
          )}

          {/* Step 2: Upload Area */}
          {importMode && (importMode === 'all' || selectedArea) && !file && (
            <div>
              {/* Show selected mode info */}
              <div className="flex items-center gap-2 mb-3">
                {importMode === 'area' ? (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
                    <MapPin className="w-3 h-3" />
                    Área: {selectedArea}
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
                    <Layers className="w-3 h-3" />
                    Todo el inventario
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { setImportMode(null); setSelectedArea(''); }}>
                  Cambiar
                </Button>
              </div>

              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Card className="border-2 border-dashed border-gray-300 hover:border-green-400 transition-colors p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="font-medium text-gray-900">Selecciona tu archivo XLSX</p>
                    <p className="text-sm text-gray-500 mt-1">
                     Columnas: nombre_insumo, categoria_insumo, stock, unidad, costo_unitario
                     {importMode === 'all' && ', area'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                     Opcionales: proveedor, stock_ideal (🎯), stock_advertencia (🟠), stock_critico (🔴)
                     {importMode === 'area' && ' — El área se asignará automáticamente'}
                    </p>
                  </div>
                </Card>
              </label>
            </div>
          )}

          {/* File Selected */}
          {file && (
            <Card className="p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-green-600">{preview.length} insumos encontrados</p>
                    {importMode === 'area' && selectedArea && (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedArea}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={resetState}>
                  Cambiar
                </Button>
              </div>
            </Card>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              {/* Alerta de categorías nuevas detectadas */}
              {(() => {
                const configCats = (restaurantConfig?.supply_categories || []).map(c => 
                  (typeof c === 'object' ? c.name : c).toString().toUpperCase().trim()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                );
                const newCats = [...new Set(preview.map(p => p.matched_category).filter(Boolean))]
                  .filter(cat => {
                    const norm = cat.toString().toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return !configCats.some(cc => cc === norm);
                  });
                return newCats.length > 0 ? (
                  <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">
                          {newCats.length} categoría(s) nueva(s) detectada(s)
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          {newCats.join(', ')} — se agregarán automáticamente como "Food Cost". 
                          Después de importar, ve a <b>Configuración → Insumos</b> para revisar la clasificación.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="bg-gray-50 px-4 py-2 border-b">
                <p className="font-medium text-sm">Vista previa ({preview.length} insumos)</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                     <th className="text-left py-2 px-3">Nombre</th>
                     <th className="text-left py-2 px-3">Categoría</th>
                     <th className="text-left py-2 px-3">Área</th>
                     <th className="text-left py-2 px-3">Proveedor</th>
                     <th className="text-right py-2 px-3">Stock</th>
                     <th className="text-center py-2 px-3">Unidad</th>
                     <th className="text-right py-2 px-3">Costo</th>
                      <th className="text-right py-2 px-3">
                        <span className="flex items-center justify-end gap-1">🎯 Ideal</span>
                      </th>
                      <th className="text-right py-2 px-3">
                        <span className="flex items-center justify-end gap-1">🟠 Adv.</span>
                      </th>
                      <th className="text-right py-2 px-3">
                        <span className="flex items-center justify-end gap-1">🔴 Crít.</span>
                      </th>
                      <th className="text-right py-2 px-3">Rend.%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.slice(0, 20).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{item.nombre_insumo}</td>
                        <td className="py-2 px-3">
                          {(() => {
                            const configCats = (restaurantConfig?.supply_categories || []).map(c =>
                              (typeof c === 'object' ? c.name : c).toString().toUpperCase().trim()
                                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                            );
                            const norm = (item.matched_category || '').toString().toUpperCase().trim()
                              .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            const isNew = !configCats.some(cc => cc === norm);
                            const wasMatched = item.matched_category !== item.categoria_insumo && item.categoria_insumo;
                            return (
                              <>
                                <Badge variant="outline" className={
                                  isNew ? 'bg-amber-50 border-amber-300 text-amber-800' :
                                  wasMatched ? 'bg-green-50 border-green-300 text-green-800' : ''
                                }>
                                  {isNew && '🆕 '}{item.matched_category}
                                </Badge>
                                {wasMatched && (
                                  <span className="text-[10px] text-gray-400 block mt-0.5">← {item.categoria_insumo}</span>
                                )}
                              </>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-3">
                          {item.area ? (
                            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 text-xs">{item.area}</Badge>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600 truncate max-w-[100px]">
                          {item.proveedor || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2 px-3 text-right">{item.stock % 1 === 0 ? item.stock : item.stock.toFixed(3)}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="secondary">{item.unidad}</Badge>
                        </td>
                        <td className="py-2 px-3 text-right">${item.costo_unitario % 1 === 0 ? item.costo_unitario.toLocaleString() : item.costo_unitario.toFixed(3)}</td>
                        <td className="py-2 px-3 text-right">
                          {item.stock_ideal > 0 ? (
                            <span className="text-blue-600 font-medium">{item.stock_ideal}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {item.warning_stock > 0 ? (
                            <span className="text-orange-600 font-medium">{item.warning_stock}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {item.min_stock > 0 ? (
                            <span className="text-red-600 font-medium">{item.min_stock}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {item.rendimiento < 100 ? (
                            <span className="text-amber-600 font-medium">{item.rendimiento}%</span>
                          ) : (
                            <span className="text-gray-300">100%</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 20 && (
                  <p className="text-center text-sm text-gray-500 py-2">
                    ... y {preview.length - 20} más
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Errores encontrados:</p>
                  <ul className="text-sm text-red-700 mt-1 space-y-1">
                    {errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                    {errors.length > 5 && <li>... y {errors.length - 5} más</li>}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={preview.length === 0 || isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Importar {preview.length} insumos
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}