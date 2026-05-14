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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  X,
  Receipt
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { syncConfigAfterImport, extractValuesFromSalesImport } from '../utils/configAutoSync';
import * as XLSX from 'xlsx';

// Función para parsear fechas en múltiples formatos (chileno, americano, ISO)
// CRÍTICO: Preserva la fecha y hora EXACTA del Excel, sin conversiones de zona horaria
const parseFlexibleDate = (dateValue) => {
  if (!dateValue) return new Date().toISOString();
  
  // Si es un número (serial date de Excel), convertir usando la fórmula estándar
  if (typeof dateValue === 'number') {
    // Excel serial date: número de días desde 1900-01-01 (con el bug de 1900-02-29)
    // La fórmula estándar es: (serial - 25569) * 86400 * 1000 = timestamp JS
    const days = Math.floor(dateValue);
    const timeFraction = dateValue - days;
    
    // Convertir días a fecha usando UTC para evitar desfases de zona horaria
    const jsDate = new Date((days - 25569) * 86400 * 1000);
    const year = jsDate.getUTCFullYear();
    const month = jsDate.getUTCMonth() + 1;
    const day = jsDate.getUTCDate();
    
    // Calcular hora desde la fracción decimal
    const totalSecondsInDay = Math.round(timeFraction * 86400);
    const hours = Math.floor(totalSecondsInDay / 3600);
    const remainingAfterHours = totalSecondsInDay - (hours * 3600);
    const mins = Math.floor(remainingAfterHours / 60);
    const secs = remainingAfterHours - (mins * 60);
    
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  const str = dateValue.toString().trim();
  
  // Si ya es ISO (2025-12-20 o 2025-12-20T18:00:00)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.includes('T') ? str : `${str}T12:00:00`;
  }
  
  // Separar fecha y hora - puede haber múltiples espacios o formatos con AM/PM
  const parts = str.split(' ');
  const datePart = parts[0];
  let timePart = parts[1] || '';
  let ampm = parts[2] || '';
  
  // Detectar formato con separador / o -
  const dateParts = datePart.split(/[\/\-]/);
  if (dateParts.length >= 3) {
    const first = parseInt(dateParts[0]) || 1;
    const second = parseInt(dateParts[1]) || 1;
    const third = parseInt(dateParts[2]) || 2025;
    
    let year, month, day;
    
    if (first > 31) {
      year = first; month = second; day = third;
    } else if (first > 12) {
      day = first; month = second; year = third;
    } else if (second > 12) {
      month = first; day = second; year = third;
    } else {
      day = first; month = second; year = third; // Formato DD/MM/YYYY por defecto
    }
    
    if (year < 100) {
      year = year > 50 ? 1900 + year : 2000 + year;
    }
    
    month = Math.min(12, Math.max(1, month));
    day = Math.min(31, Math.max(1, day));
    
    let hours = 12, mins = 0, secs = 0;
    
    if (timePart && /^\d{1,2}:\d{2}/.test(timePart)) {
      const timeComponents = timePart.split(':');
      hours = parseInt(timeComponents[0]) || 0;
      mins = parseInt(timeComponents[1]) || 0;
      secs = parseInt(timeComponents[2]) || 0;
      
      ampm = ampm.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      else if (ampm === 'AM' && hours === 12) hours = 0;
    }
    
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  return new Date().toISOString();
};

// Mapeo de headers en español a inglés (simplificado - el precio YA incluye IVA)
// ALINEADO con plantilla XLSX de TemplatesDownloadDialog
const headerMap = {
  // Headers de la plantilla XLSX
  'id_transaccion': 'transaction_id',
  'fecha_hora': 'date_time',
  'nombre_cliente': 'customer_name',
  'numero_mesa': 'table_number',
  'sala': 'room',
  'num_personas': 'num_guests',
  'nombre_camarero': 'waiter_name',
  'metodo_pago': 'payment_method',
  'tipo_venta': 'sale_type',
  'origen_delivery': 'delivery_source',
  'nombre_producto': 'product_name',
  'categoria_producto': 'category',
  'cantidad': 'quantity',
  'extra': 'extra',
  'cantidad_extra': 'extra_quantity',
  'precio_extra': 'extra_price',
  'precio_unitario': 'unit_price',
  'zona': 'zone',
  'producto_cancelado': 'product_cancelled',
  'es_combo': 'is_combo_container',
  'es_sub_item': 'is_sub_item',
  'producto_padre': 'parent_product',
  'descuento': 'discount_amount',
  'propina': 'tip_amount',
  'total': 'total_amount',
  'venta_cancelada': 'is_cancelled',
  'notas': 'notes',
  // También soportar headers en inglés
  'transaction_id': 'transaction_id',
  'date_time': 'date_time',
  'customer_name': 'customer_name',
  'table_number': 'table_number',
  'room': 'room',
  'num_guests': 'num_guests',
  'waiter_name': 'waiter_name',
  'payment_method': 'payment_method',
  'sale_type': 'sale_type',
  'delivery_source': 'delivery_source',
  'product_name': 'product_name',
  'category': 'category',
  'quantity': 'quantity',
  'extra': 'extra',
  'cantidad_extra': 'extra_quantity',
  'extra_quantity': 'extra_quantity',
  'precio_extra': 'extra_price',
  'extra_price': 'extra_price',
  'unit_price': 'unit_price',
  'zone': 'zone',
  'product_cancelled': 'product_cancelled',
  'is_combo_container': 'is_combo_container',
  'is_sub_item': 'is_sub_item',
  'parent_product': 'parent_product',
  'discount_amount': 'discount_amount',
  'discount': 'discount_amount',
  'tip_amount': 'tip_amount',
  'tip': 'tip_amount',
  'total_amount': 'total_amount',
  'total': 'total_amount',
  'is_cancelled': 'is_cancelled',
  'notes': 'notes'
};

// Tasa de IVA por defecto (se lee desde config del restaurante)
const DEFAULT_TAX_RATE = 19;

export default function SalesImportDialog({ 
  open, 
  onOpenChange, 
  restaurantId,
  restaurant,
  onSuccess 
}) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [taxRate, setTaxRate] = useState(restaurant?.config?.default_tax_rate || DEFAULT_TAX_RATE);
  const [warnings, setWarnings] = useState([]);
  const queryClient = useQueryClient();

  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes', restaurantId],
    queryFn: () => restaurantId ? base44.entities.Recipe.filter({ restaurant_id: restaurantId }) : [],
    enabled: !!restaurantId && open,
    staleTime: 5 * 60 * 1000
  });

  const { data: supplyItems = [] } = useQuery({
    queryKey: ['supplyItems', restaurantId],
    queryFn: () => restaurantId ? base44.entities.SupplyItem.filter({ restaurant_id: restaurantId }) : [],
    enabled: !!restaurantId && open,
    staleTime: 5 * 60 * 1000
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      parseXLSXPreview(selectedFile);
    }
  };

  // Parsear XLSX para preview
  const parseXLSXPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      // CRÍTICO: raw:false y dateNF para preservar fechas como strings exactos del Excel
      const workbook = XLSX.read(data, { type: 'binary', cellDates: false, raw: false });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy hh:mm' });

      if (jsonData.length < 2) {
        setError('El archivo debe contener al menos una fila de encabezados y una de datos');
        return;
      }

      const headers = jsonData[0].map(h => String(h || '').trim());
      const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
      
      // Contar transacciones únicas
      const headerIndex = {};
      headers.forEach((h, i) => {
        const normalized = h.toLowerCase().trim();
        const mapped = headerMap[normalized] || normalized;
        headerIndex[mapped] = i;
      });
      
      const transactionIds = new Set();
      dataRows.forEach(row => {
        const txnId = row[headerIndex['transaction_id']];
        if (txnId) transactionIds.add(txnId);
      });
      
      setPreview({
        headers,
        rowCount: dataRows.length,
        transactionCount: transactionIds.size,
        sample: dataRows.slice(0, 5)
      });
    };
    reader.readAsBinaryString(file);
  };

  // Leer archivo XLSX y devolver datos
  // CRÍTICO: Leer fechas como STRINGS formateadas para respetar el formato DD/MM/YYYY del usuario
  const readXLSXFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target.result;
        // raw: false y dateNF para que las fechas se lean como strings con formato DD/MM/YYYY
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false, raw: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // raw: false para obtener fechas como strings formateados (no como números seriales)
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy hh:mm' });
        resolve(jsonData);
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleImport = async () => {
    if (!file || !restaurantId) return;
    
    setLoading(true);
    setError(null);

    try {
      const jsonData = await readXLSXFile(file);
      
      if (jsonData.length < 2) {
        setError('El archivo está vacío o no tiene datos');
        setLoading(false);
        return;
      }

      const headers = jsonData[0].map(h => String(h || '').trim());
      const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

      // Mapear headers a índices (soportando español e inglés)
      const headerIndex = {};
      headers.forEach((h, i) => {
        const normalized = h.toLowerCase().trim();
        const mapped = headerMap[normalized] || normalized;
        headerIndex[mapped] = i;
      });

      // Agrupar filas por transaction_id
      const transactionsMap = new Map();
      let lastValidDateTime = null; // Para heredar fecha a transacciones sin fecha
      
      for (const row of dataRows) {
        if (row.length < 2) continue;
        
        const getValue = (key) => {
          const idx = headerIndex[key];
          return idx !== undefined ? row[idx] : null;
        };

        const transactionId = getValue('transaction_id');
        if (!transactionId) continue;

        // Si es la primera fila de esta transacción, crear el objeto base
        if (!transactionsMap.has(transactionId)) {
          const discountAmount = parseFloat(getValue('discount_amount')) || 0;
          const tipAmount = parseFloat(getValue('tip_amount')) || 0;

          const saleType = getValue('sale_type') || 'local';
          
          // Función para asegurar que un valor sea string o null
          const toStringOrNull = (val) => {
            if (val === null || val === undefined || val === '') return null;
            return String(val).trim();
          };
          
          // Parsear fecha: si tiene valor, usarlo y guardarlo como última válida
          // Si no tiene valor, heredar la última fecha válida del Excel
          const rawDateTime = getValue('date_time');
          let parsedDateTime;
          if (rawDateTime !== null && rawDateTime !== undefined && rawDateTime !== '') {
            parsedDateTime = parseFlexibleDate(rawDateTime);
            lastValidDateTime = parsedDateTime;
          } else {
            parsedDateTime = lastValidDateTime || new Date().toISOString();
          }
          
          transactionsMap.set(transactionId, {
            restaurant_id: restaurantId,
            transaction_id: String(transactionId),
            date_time: parsedDateTime,
            customer_name: toStringOrNull(getValue('customer_name')),
            table_number: toStringOrNull(getValue('table_number')),
            room: toStringOrNull(getValue('room')),
            num_guests: parseInt(getValue('num_guests')) || null,
            waiter_name: toStringOrNull(getValue('waiter_name')),
            payment_method: toStringOrNull(getValue('payment_method')) || 'efectivo',
            sale_type: saleType,
            delivery_source: saleType === 'delivery' ? toStringOrNull(getValue('delivery_source')) : null,
            products: [],
            discount_amount: discountAmount,
            discount_percentage: 0,
            applies_tax: true,
            tax_rate: taxRate,
            tip_amount: tipAmount,
            is_cancelled: String(getValue('is_cancelled') || '').toLowerCase() === 'true',
            notes: toStringOrNull(getValue('notes'))
          });
        }

        // Agregar el producto a la transacción
        const productName = getValue('product_name');
        if (productName) {
          const transaction = transactionsMap.get(transactionId);
          const extra = getValue('extra') || null;
          const extraQuantity = parseFloat(getValue('extra_quantity')) || 1;
          const extraPrice = parseFloat(getValue('extra_price')) || 0;
          
          const isCombo = String(getValue('is_combo_container') || '').toLowerCase() === 'true';
          const isSubItem = String(getValue('is_sub_item') || '').toLowerCase() === 'true';
          const parentProduct = getValue('parent_product') || null;
          
          transaction.products.push({
            product_name: productName,
            category: getValue('category') || null,
            quantity: parseFloat(getValue('quantity')) || 1,
            unit_price: parseFloat(getValue('unit_price')) || 0,
            zone: getValue('zone') || null,
            is_cancelled: String(getValue('product_cancelled') || '').toLowerCase() === 'true',
            is_combo_container: isCombo,
            is_extra: isSubItem ? true : false,
            parent_product: parentProduct ? String(parentProduct).trim() : undefined
          });
          
          // Si hay extra (modificador/agregado), agregarlo como producto adicional
          if (extra && extra.trim()) {
            transaction.products.push({
              product_name: extra.trim(),
              category: getValue('category') || null,
              quantity: extraQuantity,
              unit_price: extraPrice,
              zone: getValue('zone') || null,
              is_cancelled: String(getValue('product_cancelled') || '').toLowerCase() === 'true',
              is_extra: true
            });
          }
        }
      }

      // Calcular totales para cada transacción basado en productos
      const sales = Array.from(transactionsMap.values()).map(sale => {
        // Sumar precio × cantidad de todos los productos (el precio YA incluye IVA)
        const totalWithTax = sale.products.reduce((sum, p) => {
          if (p.is_cancelled) return sum;
          return sum + ((p.unit_price || 0) * (p.quantity || 1));
        }, 0);
        
        // Aplicar descuento
        const totalAfterDiscount = totalWithTax - (sale.discount_amount || 0);
        
        // Calcular neto e IVA (el precio del producto YA incluye IVA)
        // IMPORTANTE: La propina NO se incluye en el total_amount ya que es un ingreso separado
        const taxMultiplier = 1 + (sale.tax_rate / 100);
        const subtotal = Math.round(totalAfterDiscount / taxMultiplier);
        const taxAmount = Math.round(totalAfterDiscount - subtotal);
        
        return {
          ...sale,
          subtotal,           // Venta neta (sin IVA) - para reportes fiscales
          tax_amount: taxAmount, // IVA calculado
          total_amount: totalAfterDiscount // Total cobrado al cliente (sin propina)
          // tip_amount ya viene del XLSX y se guarda por separado
        };
      });

      // Función para normalizar nombres (minúsculas, sin tildes, sin espacios extra)
      const normalizeName = (name) => {
        if (!name) return '';
        return name.toString().toLowerCase().trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar tildes
          .replace(/\s+/g, ' '); // Normalizar espacios
      };

      // Crear mapa de recetas por nombre (fuzzy matching)
      const findMatchingRecipe = (productName) => {
        const normalizedName = normalizeName(productName);
        
        // Primero buscar coincidencia exacta
        let match = recipes.find(r => 
          normalizeName(r.dish_name) === normalizedName
        );
        if (match) return match;
        
        // Luego buscar si contiene el nombre
        match = recipes.find(r => {
          const recipeName = normalizeName(r.dish_name);
          return recipeName.includes(normalizedName) || normalizedName.includes(recipeName);
        });
        if (match) return match;
        
        // Buscar por similitud parcial (primeros 5 caracteres)
        match = recipes.find(r => {
          const recipeName = normalizeName(r.dish_name);
          return recipeName.startsWith(normalizedName.slice(0, 5)) || 
                 normalizedName.startsWith(recipeName.slice(0, 5));
        });
        
        return match || null;
      };

      // Buscar insumo por nombre (fuzzy matching)
      const findMatchingSupplyItem = (name) => {
        const normalizedName = normalizeName(name);
        console.log(`[findMatchingSupplyItem] Buscando: "${name}" → normalizado: "${normalizedName}"`);
        console.log(`[findMatchingSupplyItem] SupplyItems disponibles:`, supplyItems.map(s => `"${s.name}" → "${normalizeName(s.name)}"`));
        
        let match = supplyItems.find(s => 
          normalizeName(s.name) === normalizedName
        );
        if (match) {
          console.log(`[findMatchingSupplyItem] Coincidencia EXACTA encontrada: ${match.name}`);
          return match;
        }
        
        match = supplyItems.find(s => {
          const supplyName = normalizeName(s.name);
          return supplyName.includes(normalizedName) || normalizedName.includes(supplyName);
        });
        
        if (match) {
          console.log(`[findMatchingSupplyItem] Coincidencia PARCIAL encontrada: ${match.name}`);
        } else {
          console.log(`[findMatchingSupplyItem] NO se encontró coincidencia para "${name}"`);
        }
        
        return match || null;
      };

      // Crear mapa de recetas por ID para sub-recetas
      const recipesById = {};
      recipes.forEach(r => {
        recipesById[r.id] = r;
      });

      // Crear mapa de insumos por nombre (normalizado)
      const supplyItemsMap = {};
      supplyItems.forEach(item => {
        supplyItemsMap[normalizeName(item.name)] = item;
      });

      // Función recursiva para descontar ingredientes de una receta (incluyendo sub-recetas)
      // IMPORTANTE: Los ingredientes de una receta están definidos para `servings` porciones
      // Si vendes 1 plato, debes descontar ingrediente.quantity / recipe.servings
      const deductRecipeIngredients = (recipe, quantitySold, supplyStockUpdates, processedRecipes = new Set()) => {
        if (!recipe || processedRecipes.has(recipe.id)) return; // Evitar ciclos infinitos
        processedRecipes.add(recipe.id);

        // Las porciones que rinde la receta (default 1 si no está definido)
        const recipeServings = recipe.servings || 1;
        
        // Factor de conversión: cuántas "recetas completas" necesito para las porciones vendidas
        // Si la receta rinde 10 porciones y vendí 1, necesito 1/10 de los ingredientes
        const portionFactor = quantitySold / recipeServings;

        // 1. Descontar ingredientes directos de la receta
        if (recipe.ingredients?.length > 0) {
          for (const ingredient of recipe.ingredients) {
            const supplyKey = normalizeName(ingredient.supply_name);
            if (!supplyKey) continue;
            
            const supplyItem = supplyItemsMap[supplyKey];
            if (supplyItem) {
              if (!supplyStockUpdates[supplyItem.id]) {
                supplyStockUpdates[supplyItem.id] = {
                  item: supplyItem,
                  quantityToDeduct: 0
                };
              }
              // Cantidad del ingrediente × factor de porción
              // Ej: Si el ingrediente es 5kg para 10 porciones, y vendí 1 porción: 5 * (1/10) = 0.5kg
              // Precisión de 6 decimales intermedios para evitar errores acumulados
              supplyStockUpdates[supplyItem.id].quantityToDeduct += parseFloat(((ingredient.quantity || 0) * portionFactor).toFixed(6));
            }
          }
        }

        // 2. Procesar sub-recetas recursivamente
        if (recipe.sub_recipes?.length > 0) {
          for (const subRecipeRef of recipe.sub_recipes) {
            const subRecipe = recipesById[subRecipeRef.recipe_id];
            if (subRecipe) {
              // Cantidad de sub-receta necesaria para las porciones vendidas
              // subRecipeRef.quantity es cuánta sub-receta necesita la receta COMPLETA
              // Entonces para 1 porción vendida: subRecipeRef.quantity * portionFactor
              const subRecipeQuantityNeeded = (subRecipeRef.quantity || 1) * portionFactor;
              
              // Pasar directamente la cantidad - la función ya maneja servings internamente
              deductRecipeIngredients(subRecipe, subRecipeQuantityNeeded, supplyStockUpdates, new Set(processedRecipes));
            }
          }
        }
      };

      // Verificar productos y preparar actualizaciones de stock
      const supplyStockUpdates = {}; // Para insumos de recetas (movement_type: recipe_sale)
      const directSupplyUpdates = {}; // Para productos vendidos directamente como supply (movement_type: sale)
      const notFoundProducts = new Set();

      for (const sale of sales) {
        if (sale.is_cancelled) continue;
        
        for (const product of sale.products) {
          if (product.is_cancelled) continue;
          
          // COMBO/CONTENEDOR: No descuenta stock directamente (sus sub-items sí lo hacen)
          if (product.is_combo_container) continue;
          
          // 1. Buscar en recetas y descontar ingredientes (incluyendo sub-recetas)
          const matchedRecipe = findMatchingRecipe(product.product_name);
          if (matchedRecipe) {
            deductRecipeIngredients(matchedRecipe, product.quantity, supplyStockUpdates);
          } 
          // 2. Si NO es receta, buscar en SupplyItem (ej: Coca Cola, Agua)
          else {
            const matchedSupply = findMatchingSupplyItem(product.product_name);
            if (matchedSupply) {
              if (!directSupplyUpdates[matchedSupply.id]) {
                directSupplyUpdates[matchedSupply.id] = {
                  item: matchedSupply,
                  quantityToDeduct: 0
                };
              }
              directSupplyUpdates[matchedSupply.id].quantityToDeduct += product.quantity;
            } else {
              notFoundProducts.add(product.product_name);
            }
          }
        }
      }

      // Ya no mostramos warnings - los productos se importan igual aunque no estén en inventario

      // Crear ventas en bulk para evitar rate limit
      if (sales.length > 0) {
        await base44.entities.Sale.bulkCreate(sales);
      }

      // Actualizar stock de insumos (ingredientes de recetas) y crear movimientos
      const batchSize = 10;
      const supplyUpdatesList = Object.values(supplyStockUpdates);
      const supplyMovementsToCreate = [];
      
      for (let i = 0; i < supplyUpdatesList.length; i += batchSize) {
        const batch = supplyUpdatesList.slice(i, i + batchSize);
        await Promise.all(batch.map(async (update) => {
          const previousStock = update.item.current_stock || 0;
          const newStock = Math.max(0, previousStock - update.quantityToDeduct);
          
          await base44.entities.SupplyItem.update(update.item.id, { current_stock: newStock });
          
          // Usar la fecha más reciente de las ventas importadas
          const latestSaleDateForSupply = sales.reduce((latest, sale) => {
            const saleDate = new Date(sale.date_time);
            return saleDate > latest ? saleDate : latest;
          }, new Date(sales[0]?.date_time || new Date()));

          // Registrar movimiento de stock para insumos
          supplyMovementsToCreate.push({
            restaurant_id: restaurantId,
            product_name: update.item.name,
            product_id: update.item.id,
            item_type: 'supply',
            movement_type: 'recipe_sale',
            quantity: -update.quantityToDeduct,
            previous_stock: previousStock,
            new_stock: newStock,
            transaction_date: latestSaleDateForSupply.toISOString(),
            notes: `Ingredientes descontados - Importación XLSX ${sales.length} ventas`
          });
        }));
      }
      
      // Crear movimientos de insumos de recetas en bulk
      if (supplyMovementsToCreate.length > 0) {
        await base44.entities.StockMovement.bulkCreate(supplyMovementsToCreate);
      }

      // Actualizar stock de productos vendidos directamente como supply (Coca Cola, Agua, etc.)
      const directSupplyList = Object.values(directSupplyUpdates);
      const directSupplyMovements = [];
      
      for (let i = 0; i < directSupplyList.length; i += batchSize) {
        const batch = directSupplyList.slice(i, i + batchSize);
        await Promise.all(batch.map(async (update) => {
          const previousStock = update.item.current_stock || 0;
          const newStockDirect = parseFloat(Math.max(0, previousStock - update.quantityToDeduct).toFixed(3));
          
          await base44.entities.SupplyItem.update(update.item.id, { current_stock: newStockDirect });
          
          const latestSaleDateDirect = sales.reduce((latest, sale) => {
            const saleDate = new Date(sale.date_time);
            return saleDate > latest ? saleDate : latest;
          }, new Date(sales[0]?.date_time || new Date()));

          directSupplyMovements.push({
            restaurant_id: restaurantId,
            product_name: update.item.name,
            product_id: update.item.id,
            item_type: 'supply',
            movement_type: 'sale', // Venta directa, NO recipe_sale
            quantity: -update.quantityToDeduct,
            previous_stock: previousStock,
            new_stock: newStockDirect,
            transaction_date: latestSaleDateDirect.toISOString(),
            notes: `Venta directa - Importación XLSX ${sales.length} ventas`
          });
        }));
      }
      
      if (directSupplyMovements.length > 0) {
        await base44.entities.StockMovement.bulkCreate(directSupplyMovements);
      }

      // Auto-sincronizar configuración: agregar salas, métodos de pago y categorías nuevas
      if (restaurant) {
        const newValues = extractValuesFromSalesImport(sales);
        const syncResult = await syncConfigAfterImport(restaurantId, restaurant, newValues);
        if (syncResult.updated) {
          queryClient.invalidateQueries({ queryKey: ['restaurants'] });
          queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
        }
      }

      onSuccess?.(sales.length, 0, supplyUpdatesList.length + directSupplyList.length);
      onOpenChange(false);
      resetState();
    } catch (err) {
      console.error('Import error:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Error desconocido';
      setError(`Error al importar: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setWarnings([]);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            Importar Ventas desde XLSX
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
            {!file ? (
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1">
                  Arrastra tu archivo XLSX aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-gray-400">
                  Solo archivos .xlsx o .xls
                </p>
              </label>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {preview?.rowCount || 0} filas → {preview?.transactionCount || 0} transacciones
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetState}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Info sobre formato */}
          <Alert className="bg-emerald-50 border-emerald-200">
            <AlertCircle className="w-4 h-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800">
              <strong>Formato XLSX:</strong> Cada producto va en una fila separada. Las filas con el mismo <code>id_transaccion</code> se agrupan en una sola venta. Marca <code>es_combo=true</code> para combos y <code>es_sub_item=true</code> + <code>producto_padre</code> para sus componentes.
            </AlertDescription>
          </Alert>

          {/* Tax Info */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <Label className="font-medium text-blue-900">El precio ya incluye IVA</Label>
                <p className="text-sm text-blue-700 mt-1">
                  El sistema calculará automáticamente el valor <strong>NETO</strong> (sin IVA) para tus análisis.
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <Label className="text-blue-800">Tasa de IVA:</Label>
                  <Input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 19)}
                    className="w-20 bg-white"
                  />
                  <span className="text-sm text-blue-600">%</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Preview */}
          {preview && (
            <Card className="p-4 overflow-hidden">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Vista previa ({preview.transactionCount} transacciones)
              </h4>
              <div className="overflow-x-auto max-w-full">
                <table className="text-xs table-fixed min-w-0">
                  <thead>
                    <tr className="border-b">
                      {preview.headers.slice(0, 5).map((h, i) => (
                        <th key={i} className="text-left p-2 text-gray-600 truncate max-w-[100px]">{h}</th>
                      ))}
                      {preview.headers.length > 5 && (
                        <th className="text-left p-2 text-gray-400 whitespace-nowrap">+{preview.headers.length - 5} más</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {row.slice(0, 5).map((cell, j) => (
                          <td key={j} className="p-2 text-gray-700 truncate max-w-[100px]" title={cell}>
                            {cell || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>{warnings.length} producto(s) no encontrados en inventario:</strong>
                <span className="text-sm ml-2">{warnings.slice(0, 5).join(', ')}{warnings.length > 5 ? ` y ${warnings.length - 5} más...` : ''}</span>
              </AlertDescription>
            </Alert>
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
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || !preview || loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Importar {preview?.transactionCount || 0} ventas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}