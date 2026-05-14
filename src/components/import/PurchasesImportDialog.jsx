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
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  X,
  Receipt,
  Package,
  Wallet
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from '@tanstack/react-query';
import { syncConfigAfterImport, extractValuesFromPurchasesImport } from '../utils/configAutoSync';
import * as XLSX from 'xlsx';

// Mapeo de headers - ALINEADO con plantilla XLSX de TemplatesDownloadDialog
const headerMap = {
  // Headers de la plantilla XLSX
  'fecha': 'date',
  'proveedor': 'supplier',
  'rut_proveedor': 'supplier_tax_id',
  'numero_factura': 'invoice_number',
  'monto_neto': 'net_amount',
  'exento_iva': 'is_tax_exempt',
  'iva': 'tax_amount_csv',
  'detalles_compra': 'notes',
  'cantidad': 'quantity',
  'unidad': 'unit',
  'centro_costo': 'cost_center',
  'tipo': 'cost_center',
  'fecha_pago': 'payment_date',
  'estado_pago': 'payment_status',
  'comprador': 'buyer',
  'categoria': 'supply_category_override',
  'categoria_insumo': 'supply_category_override',
  'subcategoria': 'supply_category_override',
  // Alias adicionales
  'factura': 'invoice_number',
  'item': 'item',
  'detalle': 'notes',
  'insumo': 'supply_item_name',
  'nombre_insumo': 'supply_item_name',
  'cantidad_comprada': 'quantity',
  'unidad_medida': 'unit',
  // Inglés
  'date': 'date',
  'supplier': 'supplier',
  'invoice_number': 'invoice_number',
  'net_amount': 'net_amount',
  'is_tax_exempt': 'is_tax_exempt',
  'cost_center': 'cost_center',
  'item': 'item',
  'notes': 'notes',
  'payment_date': 'payment_date',
  'buyer': 'buyer',
  'supply_item_name': 'supply_item_name',
  'quantity': 'quantity',
  'unit': 'unit'
};

// Función para normalizar texto (quitar tildes, mayúsculas, caracteres raros de encoding)
const normalizeText = (text) => {
  if (!text) return '';
  let result = text
    .toString()
    .toUpperCase()
    .trim()
    // Normalizar caracteres con tildes mal codificados (UTF-8 leído como Latin1)
    .replace(/Ã³/gi, 'O').replace(/Ã"/gi, 'O').replace(/ó/gi, 'O')
    .replace(/Ã¡/gi, 'A').replace(/Ã/gi, 'A').replace(/á/gi, 'A')
    .replace(/Ã©/gi, 'E').replace(/Ã‰/gi, 'E').replace(/é/gi, 'E')
    .replace(/Ã­/gi, 'I').replace(/í/gi, 'I')
    .replace(/Ãº/gi, 'U').replace(/Ãš/gi, 'U').replace(/ú/gi, 'U')
    .replace(/Ã±/gi, 'N').replace(/Ã'/gi, 'N').replace(/ñ/gi, 'N')
    .replace(/Ã/gi, '') // Limpiar caracteres residuales
    // Normalizar tildes normales
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Limpiar espacios extras y caracteres especiales
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Debug para ver qué se está procesando
  console.log('normalizeText:', text, '->', result);
  return result;
};

// Mapeo por defecto de Centro de Costo (se usa si el restaurante no tiene configuración)
// IMPORTANTE: Las claves ya están normalizadas (sin tildes, mayúsculas)
const defaultCostCenterMapping = {
  // Suministros / Costos de venta
  'FOOD COST': { entity: 'SupplyCost', opexType: null },
  'FOODCOST': { entity: 'SupplyCost', opexType: null },
  'EXPLOTACION': { entity: 'SupplyCost', opexType: null },
  'SUMINISTROS': { entity: 'SupplyCost', opexType: null },
  'COSTOS': { entity: 'SupplyCost', opexType: null },
  'COSTO DE VENTA': { entity: 'SupplyCost', opexType: null },
  'COSTO VENTA': { entity: 'SupplyCost', opexType: null },
  'MATERIAS PRIMAS': { entity: 'SupplyCost', opexType: null },
  'INSUMOS': { entity: 'SupplyCost', opexType: null },
  
  // Gastos Operativos - Nómina/Personal
  'PAYROLL': { entity: 'OpEx', opexType: 'payroll' },
  'PAYROLLRRHH': { entity: 'OpEx', opexType: 'payroll' },
  'PAYROLL RRHH': { entity: 'OpEx', opexType: 'payroll' },
  'NOMINA': { entity: 'OpEx', opexType: 'payroll' },
  'PERSONAL': { entity: 'OpEx', opexType: 'payroll' },
  'SUELDOS': { entity: 'OpEx', opexType: 'payroll' },
  'SALARIOS': { entity: 'OpEx', opexType: 'payroll' },
  
  // Gastos Operativos - Arriendo/Alquiler
  'ARRIENDO': { entity: 'OpEx', opexType: 'rent' },
  'ALQUILER': { entity: 'OpEx', opexType: 'rent' },
  'RENTA': { entity: 'OpEx', opexType: 'rent' },
  'REAL STATE': { entity: 'OpEx', opexType: 'rent' },
  'REAL STATERENTA': { entity: 'OpEx', opexType: 'rent' },
  'REAL STATE RENTA': { entity: 'OpEx', opexType: 'rent' },
  
  // Gastos Operativos - Servicios/Utilities
  'SERVICIOS': { entity: 'OpEx', opexType: 'utilities' },
  'UTILITIES': { entity: 'OpEx', opexType: 'utilities' },
  'LUZ': { entity: 'OpEx', opexType: 'utilities' },
  'AGUA': { entity: 'OpEx', opexType: 'utilities' },
  'GAS': { entity: 'OpEx', opexType: 'utilities' },
  'ELECTRICIDAD': { entity: 'OpEx', opexType: 'utilities' },
  
  // Gastos Operativos - Mantenimiento
  'MANTENIMIENTO': { entity: 'OpEx', opexType: 'maintenance' },
  'REPARACIONES': { entity: 'OpEx', opexType: 'maintenance' },
  
  // Gastos Operativos - Marketing/Comunicación
  'COMUNICACION': { entity: 'OpEx', opexType: 'marketing' },
  'MARKETING': { entity: 'OpEx', opexType: 'marketing' },
  'PUBLICIDAD': { entity: 'OpEx', opexType: 'marketing' },
  
  // Gastos Operativos - Tecnología
  'TECNOLOGIA': { entity: 'OpEx', opexType: 'technology' },
  'INTERNET': { entity: 'OpEx', opexType: 'technology' },
  'SOFTWARE': { entity: 'OpEx', opexType: 'technology' },
  'SISTEMAS': { entity: 'OpEx', opexType: 'technology' },
  
  // Gastos Operativos - Seguros
  'SEGUROS': { entity: 'OpEx', opexType: 'insurance' },
  'INSURANCE': { entity: 'OpEx', opexType: 'insurance' },
  
  // Gastos Operativos - Licencias
  'LICENCIAS': { entity: 'OpEx', opexType: 'licenses' },
  'PERMISOS': { entity: 'OpEx', opexType: 'licenses' },
  'PATENTES': { entity: 'OpEx', opexType: 'licenses' },
  
  // Gastos Operativos - Administración/Inversiones (van a "other")
  'ADMINISTRACION': { entity: 'OpEx', opexType: 'other' },
  'INVERSIONES': { entity: 'OpEx', opexType: 'other' },
  'INVERSION': { entity: 'OpEx', opexType: 'other' },
  'OFICINA': { entity: 'OpEx', opexType: 'other' },
  'INSUMOS DE OFICINA': { entity: 'OpEx', opexType: 'other' },
  'GASTOS GENERALES': { entity: 'OpEx', opexType: 'other' },
  'GASTOS FIJOS': { entity: 'OpEx', opexType: 'insurance' },
  'HIGIENE E INOCUIDAD': { entity: 'OpEx', opexType: 'other' },
  'LOGISTICA': { entity: 'OpEx', opexType: 'other' },
  'OTROS': { entity: 'OpEx', opexType: 'other' }
};

// Construir mapeo dinámico basado en configuración del restaurante
const buildCostCenterMapping = (restaurantConfig) => {
  const costCenters = restaurantConfig?.cost_centers || [];
  
  // Si no hay configuración o son strings antiguos, usar mapeo por defecto
  if (costCenters.length === 0 || typeof costCenters[0] === 'string') {
    return defaultCostCenterMapping;
  }
  
  const mapping = {};
  costCenters.forEach(center => {
    const normalizedName = normalizeText(center.name);
    if (center.type === 'supply') {
      mapping[normalizedName] = { entity: 'SupplyCost', opexType: null };
    } else {
      mapping[normalizedName] = { entity: 'OpEx', opexType: center.opex_type || 'other' };
    }
  });
  
  return { ...defaultCostCenterMapping, ...mapping };
};

// Mapeo de Items a supply_type para SupplyCost
const itemToSupplyType = {
  'ALIMENTOS': 'ingredients',
  'CARNES': 'ingredients',
  'VERDURAS': 'ingredients',
  'LACTEOS': 'ingredients',
  'LÁCTEOS': 'ingredients',
  'PESCADOS': 'ingredients',
  'BEBIDAS': 'ingredients',
  'PACKAGING': 'packaging',
  'EMPAQUES': 'packaging',
  'DESECHABLES': 'packaging',
  'LIMPIEZA': 'cleaning',
  'UNIFORMES': 'uniforms',
  'EQUIPOS': 'equipment'
};

const DEFAULT_TAX_RATE = 19;

// Función para encontrar insumo por nombre (fuzzy matching)
const findMatchingSupplyItem = (searchName, supplyItems) => {
  if (!searchName || !supplyItems.length) return null;
  
  const normalizedSearch = searchName.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Primero buscar coincidencia exacta
  let match = supplyItems.find(s => 
    s.name.toLowerCase().trim() === normalizedSearch
  );
  if (match) return match;
  
  // Luego buscar si contiene el nombre
  match = supplyItems.find(s => {
    const normalizedName = s.name.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName);
  });
  if (match) return match;
  
  // Buscar por similitud parcial (primeras letras)
  match = supplyItems.find(s => {
    const normalizedName = s.name.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedName.startsWith(normalizedSearch.slice(0, 4)) || 
           normalizedSearch.startsWith(normalizedName.slice(0, 4));
  });
  
  return match || null;
};

export default function PurchasesImportDialog({ 
  open, 
  onOpenChange, 
  restaurantId,
  restaurant,
  restaurantConfig,
  supplyItems = [],
  suppliers = [],
  onSuccess 
}) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [stockUpdatesPreview, setStockUpdatesPreview] = useState([]);
  const queryClient = useQueryClient();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      parseXLSXPreview(selectedFile);
    }
  };

  // Función compartida para clasificar un registro
  const classifyRecord = (costCenterRaw, costCenterMapping) => {
    const costCenterNormalized = normalizeText(costCenterRaw);
    
    // Buscar mapping - primero exacto
    let mapping = costCenterMapping[costCenterNormalized];
    
    // Si no hay match exacto, buscar parcial
    if (!mapping) {
      for (const [key, value] of Object.entries(costCenterMapping)) {
        if (costCenterNormalized.includes(key) || key.includes(costCenterNormalized)) {
          mapping = value;
          break;
        }
      }
    }
    
    return mapping || { entity: 'OpEx', opexType: 'other' };
  };

  // Parsear XLSX para preview
  const parseXLSXPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (jsonData.length < 2) {
        setError('El archivo debe contener al menos una fila de encabezados y una de datos');
        return;
      }

      const headers = jsonData[0].map(h => String(h || '').trim());
      const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

      // Contar por centro de costo
      const headerIndex = {};
      headers.forEach((h, i) => {
        const normalized = h.toLowerCase().trim().replace(/\s+/g, '_');
        const mapped = headerMap[normalized] || normalized;
        headerIndex[mapped] = i;
      });

      let supplyCostCount = 0;
      let opexCount = 0;

      const costCenterMappingPreview = buildCostCenterMapping(restaurantConfig);
      dataRows.forEach(row => {
        const costCenterRaw = row[headerIndex['cost_center']] || '';
        const mapping = classifyRecord(costCenterRaw, costCenterMappingPreview);
        if (mapping.entity === 'SupplyCost') {
          supplyCostCount++;
        } else {
          opexCount++;
        }
      });
      
      setPreview({
        headers,
        rowCount: dataRows.length,
        supplyCostCount,
        opexCount,
        sample: dataRows.slice(0, 5)
      });
    };
    reader.readAsBinaryString(file);
  };

  // Leer archivo XLSX y devolver datos
  const readXLSXFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        resolve(jsonData);
      };
      reader.readAsBinaryString(file);
    });
  };

  const parseFlexibleDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    const str = dateStr.toString().trim();
    
    // Si es un número (Excel serial date)
    if (!isNaN(str) && parseFloat(str) > 40000) {
      const excelDate = parseFloat(str);
      const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
      return jsDate.toISOString().split('T')[0];
    }
    
    // Si ya es ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.split('T')[0];
    }
    
    const parts = str.split(/[\/\-]/);
    if (parts.length >= 3) {
      const first = parseInt(parts[0]) || 1;
      const second = parseInt(parts[1]) || 1;
      let third = parseInt(parts[2]) || 2025;
      
      let year, month, day;
      
      // Formato DD/MM/YYYY (más común en español)
      if (third > 100) {
        day = first;
        month = second;
        year = third;
      } else if (first > 31) {
        year = first; month = second; day = third;
      } else if (first > 12) {
        day = first; month = second; year = third;
      } else if (second > 12) {
        month = first; day = second; year = third;
      } else {
        // Asumir DD/MM/YYYY por defecto (formato español/chileno)
        day = first; month = second; year = third;
      }
      
      if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
      
      month = Math.min(12, Math.max(1, month));
      day = Math.min(31, Math.max(1, day));
      
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    return new Date().toISOString().split('T')[0];
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

      // Mapear headers
      const headerIndex = {};
      headers.forEach((h, i) => {
        const normalized = h.toLowerCase().trim().replace(/\s+/g, '_');
        const mapped = headerMap[normalized] || normalized;
        headerIndex[mapped] = i;
      });

      const supplyCostRecords = [];
      const opexRecords = [];

      for (const row of dataRows) {
        if (row.length < 2) continue;

        const getValue = (key) => {
          const idx = headerIndex[key];
          if (idx === undefined || row[idx] === undefined || row[idx] === null) return null;
          return String(row[idx]).trim();
        };

        const costCenterRaw = getValue('cost_center') || '';
        const costCenterMapping = buildCostCenterMapping(restaurantConfig);
        const mapping = classifyRecord(costCenterRaw, costCenterMapping);
        
        // Función para limpiar montos
        const cleanAmount = (rawValue) => {
          if (!rawValue) return 0;
          let cleaned = String(rawValue).replace(/[$\s]/g, '');
          
          if (cleaned.includes('.') && cleaned.includes(',')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
          } else if (cleaned.includes('.')) {
            const parts = cleaned.split('.');
            if (parts.length === 2 && parts[1].length === 3) {
              cleaned = cleaned.replace(/\./g, '');
            }
          } else if (cleaned.includes(',')) {
            const parts = cleaned.split(',');
            if (parts.length === 2 && parts[1].length === 3) {
              cleaned = cleaned.replace(/,/g, '');
            } else {
              cleaned = cleaned.replace(',', '.');
            }
          }
          return parseFloat(cleaned) || 0;
        };
        
        const netAmount = cleanAmount(getValue('net_amount'));
        const isExemptStr = (getValue('is_tax_exempt') || '').toLowerCase();
        const isExempt = isExemptStr === 'true' || isExemptStr === 'si' || isExemptStr === 'sí' || isExemptStr === '1';
        
        // Leer IVA del archivo si existe, sino calcularlo
        const taxRate = restaurantConfig?.default_tax_rate || DEFAULT_TAX_RATE;
        const ivaFromFile = cleanAmount(getValue('tax_amount_csv'));
        const taxAmount = ivaFromFile > 0 ? ivaFromFile : (isExempt ? 0 : Math.round(netAmount * (taxRate / 100)));
        const totalAmount = netAmount + taxAmount;

        // Obtener detalles de compra (puede contener nombre del insumo)
        const detailsCompra = getValue('notes') || '';
        const item = getValue('item') || detailsCompra;
        const itemNormalized = normalizeText(item);
        const date = parseFlexibleDate(getValue('date'));

        if (mapping.entity === 'SupplyCost') {
          // Determinar supply_type basado en item o centro de costo
          const costCenterNormalized = normalizeText(costCenterRaw);
          const itemUpper = itemNormalized || costCenterNormalized;
          let supplyType = 'ingredients';
          for (const [key, type] of Object.entries(itemToSupplyType)) {
            if (itemUpper.includes(key)) {
              supplyType = type;
              break;
            }
          }

          // Campos para gestión de stock - extraer del detalle si no hay campo específico
          let supplyItemName = getValue('supply_item_name') || null;
          const quantity = parseFloat(getValue('quantity')) || 0;
          const unit = getValue('unit') || null;
          
          // Si no hay supply_item_name pero hay detalle con cantidad, intentar extraer nombre del insumo
          if (!supplyItemName && detailsCompra) {
            const matchedSupply = findMatchingSupplyItem(detailsCompra.split(',')[0].trim(), supplyItems);
            if (matchedSupply) {
              supplyItemName = matchedSupply.name;
            }
          }

          // === RESOLUCIÓN AUTOMÁTICA DE CATEGORÍA ===
          // Prioridad: 1) columna "categoria" del XLSX, 2) match por nombre de insumo en catálogo, 3) centro_costo
          const categoryOverride = getValue('supply_category_override');
          let resolvedCategory = costCenterRaw || item || 'General';
          
          if (categoryOverride) {
            // 1) Si el usuario puso categoría explícita en el XLSX, usarla
            resolvedCategory = categoryOverride;
          } else if (supplyItemName) {
            // 2) Buscar la categoría del insumo en el catálogo de SupplyItems
            const catalogMatch = supplyItems.find(s => 
              s.name?.toLowerCase().trim() === supplyItemName.toLowerCase().trim()
            );
            if (catalogMatch?.category) {
              resolvedCategory = catalogMatch.category;
            }
          } else if (detailsCompra) {
            // 3) Intentar match por detalle de compra
            const catalogMatch = findMatchingSupplyItem(detailsCompra.split(',')[0].trim(), supplyItems);
            if (catalogMatch?.category) {
              resolvedCategory = catalogMatch.category;
              // También asignar el nombre correcto del insumo
              if (!supplyItemName) supplyItemName = catalogMatch.name;
            }
          }

          // Estado de pago
          const paymentStatusRaw = (getValue('payment_status') || '').toLowerCase();
          const paymentStatus = paymentStatusRaw === 'pendiente' ? 'pendiente' : 'pagado';
          const paymentDateParsed = getValue('payment_date') ? parseFlexibleDate(getValue('payment_date')) : null;

          // Obtener proveedor, RUT y factura
          const supplier = getValue('supplier');
          const supplierTaxId = getValue('supplier_tax_id');
          const invoiceNumber = getValue('invoice_number');

          const supplyCostRecord = {
            restaurant_id: restaurantId,
            date,
            supply_category: resolvedCategory,
            supply_type: supplyType,
            subtotal: netAmount,
            is_tax_exempt: isExempt,
            tax_rate: isExempt ? 0 : taxRate,
            tax_amount: taxAmount,
            total_cost: totalAmount,
            payment_status: paymentStatus,
            stock_updated: false
          };
          
          // Campos opcionales - agregar siempre que tengan valor
          if (supplyItemName) supplyCostRecord.supply_item_name = supplyItemName;
          if (quantity > 0) supplyCostRecord.quantity_purchased = quantity;
          if (unit) supplyCostRecord.unit_of_measure = unit;
          if (supplier) supplyCostRecord.supplier = supplier;
          if (supplierTaxId) supplyCostRecord.supplier_tax_id = supplierTaxId;
          if (invoiceNumber) supplyCostRecord.invoice_number = invoiceNumber;
          if (detailsCompra) supplyCostRecord.notes = detailsCompra;
          if (paymentDateParsed) supplyCostRecord.payment_date = paymentDateParsed;
          
          supplyCostRecords.push(supplyCostRecord);
        } else {
          // OpEx - Estado de pago
          const paymentStatusRawOpex = (getValue('payment_status') || '').toLowerCase();
          const paymentStatusOpex = paymentStatusRawOpex === 'pendiente' ? 'pendiente' : 'pagado';
          const paymentDateOpexParsed = getValue('payment_date') ? parseFlexibleDate(getValue('payment_date')) : null;

          // Obtener proveedor, RUT y factura como campos separados
          const supplier = getValue('supplier');
          const supplierTaxId = getValue('supplier_tax_id');
          const invoiceNumber = getValue('invoice_number');
          const description = detailsCompra || item || '';

          // Resolver cost_center_name y category para OpEx
          const costCenterNormalizedOpex = normalizeText(costCenterRaw);
          // Buscar el nombre original del centro en la config
          const matchedCenter = (restaurantConfig?.cost_centers || []).find(c => {
            const norm = normalizeText(c.name);
            return norm === costCenterNormalizedOpex || costCenterNormalizedOpex.includes(norm) || norm.includes(costCenterNormalizedOpex);
          });
          const resolvedCostCenterName = matchedCenter?.name || costCenterRaw;
          
          // Intentar resolver categoría: usar campo "categoria" del XLSX si existe
          const opexCategoryOverride = getValue('supply_category_override');

          const opexRecord = {
            restaurant_id: restaurantId,
            date,
            type: mapping.opexType || 'other',
            cost_center_name: resolvedCostCenterName,
            description: description.trim(),
            subtotal: netAmount,
            is_tax_exempt: isExempt,
            tax_rate: isExempt ? 0 : taxRate,
            tax_amount: taxAmount,
            amount: totalAmount,
            payment_status: paymentStatusOpex,
            is_recurring: false
          };
          
          if (opexCategoryOverride) {
            opexRecord.category = opexCategoryOverride;
          }

          // Campos opcionales - agregar como campos separados
          if (supplier) opexRecord.supplier = supplier;
          if (supplierTaxId) opexRecord.supplier_tax_id = supplierTaxId;
          if (invoiceNumber) opexRecord.invoice_number = invoiceNumber;
          if (paymentDateOpexParsed) opexRecord.payment_date = paymentDateOpexParsed;

          opexRecords.push(opexRecord);
        }
      }

      // Guardar registros
      if (supplyCostRecords.length > 0) {
        await base44.entities.SupplyCost.bulkCreate(supplyCostRecords);
      }
      
      if (opexRecords.length > 0) {
        await base44.entities.OpEx.bulkCreate(opexRecords);
      }

      // Actualizar stock de insumos si hay datos
      let stockUpdatesCount = 0;
      const stockUpdates = {};
      
      for (const record of supplyCostRecords) {
        if (record.supply_item_name && record.quantity_purchased > 0) {
          // Buscar insumo por nombre (fuzzy matching simple)
          const matchedSupply = findMatchingSupplyItem(record.supply_item_name, supplyItems);
          
          if (matchedSupply) {
            if (!stockUpdates[matchedSupply.id]) {
              stockUpdates[matchedSupply.id] = {
                item: matchedSupply,
                quantityToAdd: 0
              };
            }
            stockUpdates[matchedSupply.id].quantityToAdd += record.quantity_purchased;
          }
        }
      }

      // Aplicar actualizaciones de stock y crear movimientos
      // Solo actualizar stock para compras PAGADAS
      const stockMovementsToCreate = [];
      
      for (const [supplyId, update] of Object.entries(stockUpdates)) {
        // Encontrar los records asociados a este insumo y sumar solo los pagados
        const paidRecords = supplyCostRecords.filter(r => 
          r.supply_item_name === update.item.name && r.payment_status === 'pagado'
        );
        const paidQuantity = paidRecords.reduce((sum, r) => sum + (r.quantity_purchased || 0), 0);
        const paidTotalCost = paidRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0);
        
        if (paidQuantity > 0) {
          const previousStock = update.item.current_stock || 0;
          const newStock = previousStock + paidQuantity;
          
          // Calcular nuevo costo unitario promedio ponderado
          const previousTotalValue = (update.item.average_unit_cost || 0) * previousStock;
          const newTotalValue = previousTotalValue + paidTotalCost;
          const newAverageUnitCost = newStock > 0 ? parseFloat((newTotalValue / newStock).toFixed(3)) : 0;
          
          await base44.entities.SupplyItem.update(supplyId, { 
            current_stock: newStock,
            average_unit_cost: newAverageUnitCost
          });
          stockUpdatesCount++;
          
          // Obtener fecha de pago del primer registro pagado
          const paidRecord = supplyCostRecords.find(r => 
            r.supply_item_name === update.item.name && r.payment_status === 'pagado'
          );
          const transactionDate = paidRecord?.payment_date 
            ? new Date(paidRecord.payment_date).toISOString() 
            : new Date().toISOString();
          
          // Registrar movimiento de stock con fecha de pago
          stockMovementsToCreate.push({
            restaurant_id: restaurantId,
            product_name: update.item.name,
            product_id: supplyId,
            item_type: 'supply',
            movement_type: 'purchase',
            quantity: paidQuantity,
            previous_stock: previousStock,
            new_stock: newStock,
            transaction_date: transactionDate,
            notes: `Importación CSV - Compra de insumos`
          });
        }
      }
      
      // Crear movimientos en bulk
      if (stockMovementsToCreate.length > 0) {
        await base44.entities.StockMovement.bulkCreate(stockMovementsToCreate);
      }

      // Auto-crear proveedores nuevos
      const allRecords = [...supplyCostRecords, ...opexRecords];
      const uniqueSuppliers = {};
      allRecords.forEach(r => {
        if (r.supplier && r.supplier.trim()) {
          const key = r.supplier.trim().toLowerCase();
          if (!uniqueSuppliers[key]) {
            uniqueSuppliers[key] = {
              name: r.supplier.trim(),
              tax_id: r.supplier_tax_id || '',
              categories: new Set()
            };
          }
          if (r.supply_category) uniqueSuppliers[key].categories.add(r.supply_category);
        }
      });

      const existingNames = suppliers.map(s => s.name?.toLowerCase().trim());
      const newSuppliers = Object.values(uniqueSuppliers)
        .filter(s => !existingNames.includes(s.name.toLowerCase().trim()))
        .map(s => ({
          restaurant_id: restaurantId,
          name: s.name,
          tax_id: s.tax_id,
          supply_categories: [...s.categories],
          is_active: true
        }));

      if (newSuppliers.length > 0) {
        await base44.entities.Supplier.bulkCreate(newSuppliers);
      }

      // Auto-sincronizar configuración: agregar categorías de insumos nuevas
      if (restaurant) {
        const newValues = extractValuesFromPurchasesImport(supplyCostRecords);
        const syncResult = await syncConfigAfterImport(restaurantId, restaurant, newValues);
        if (syncResult.updated) {
          queryClient.invalidateQueries({ queryKey: ['restaurants'] });
          queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
        }
      }

      onSuccess?.(supplyCostRecords.length, opexRecords.length, stockUpdatesCount);
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
  };

  return (
    <Dialog open={open} onOpenChange={() => { resetState(); onOpenChange(false); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Importar Compras y Gastos desde XLSX
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
                  Arrastra tu archivo XLSX o haz clic para seleccionar
                </p>
                <p className="text-xs text-gray-400">
                  Formato unificado de compras y gastos
                </p>
              </label>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-blue-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {preview?.rowCount || 0} registros detectados
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetState}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Info */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              La columna <strong>"tipo"</strong> (o "centro_costo") determina la clasificación:
              <br />• <strong>FOOD COST</strong> → Suministros (costos de venta, actualiza stock)
              <br />• <strong>PAYROLL/RRHH, MARKETING, ADMINISTRACIÓN...</strong> → Gastos Operativos
              <br />
              <span className="text-xs text-blue-600 mt-1 block">
                💡 <strong>Categoría:</strong> Si incluyes la columna <strong>"categoria"</strong> (ej: FRUTAS Y VERDURAS, CARNES), se usa directamente. Si no, se detecta automáticamente desde el catálogo de insumos.
              </span>
            </AlertDescription>
          </Alert>

          {/* Preview con clasificación */}
          {preview && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="font-medium">Clasificación automática</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-800">Suministros</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-700">{preview.supplyCostCount}</p>
                  <p className="text-xs text-amber-600">registros → SupplyCost</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-800">Gastos Operativos</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{preview.opexCount}</p>
                  <p className="text-xs text-blue-600">registros → OpEx</p>
                </div>
              </div>

              {/* Sample rows */}
              <div className="mt-4 overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b">
                      {preview.headers.slice(0, 6).map((h, i) => (
                        <th key={i} className="text-left p-2 text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {row.slice(0, 6).map((cell, j) => (
                          <td key={j} className="p-2 text-gray-700 truncate max-w-[100px]">
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

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || !preview || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Importar {preview?.rowCount || 0} registros
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}