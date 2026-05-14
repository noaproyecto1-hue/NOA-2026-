import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { 
  Camera, FileText, Loader2, CheckCircle2, AlertCircle, 
  Upload, Package, Building2, ArrowRight, Sparkles, Eye
} from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import InvoicePreviewForm from './InvoicePreviewForm';

export default function InvoiceUploadDialog({ 
  open, onOpenChange, restaurant, supplyItems = [], suppliers = [],
  currency = 'CLP', onSubmitSupply, onSubmitOpex
}) {
  const [step, setStep] = useState(1); // 1: tipo, 2: subir, 3: revisión
  const [invoiceType, setInvoiceType] = useState(null); // 'supply' o 'opex'
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [reanalyzeFeedback, setReanalyzeFeedback] = useState(null);
  const [pendingReanalyze, setPendingReanalyze] = useState(false);

  const config = restaurant?.config || {};
  const rawSupplyCategories = config.supply_categories || [];
  // Normalize: extract name strings from supply_categories (can be objects or strings)
  const supplyCategories = rawSupplyCategories.map(c => typeof c === 'string' ? c : c?.name || '').filter(Boolean);
  const opexCostCenters = (config.cost_centers || []).filter(c => c.type === 'opex');

  const reset = () => {
    setStep(1);
    setInvoiceType(null);
    setFile(null);
    setFileUrl(null);
    setIsUploading(false);
    setIsExtracting(false);
    setExtractedData(null);
    setError(null);
    setReanalyzeFeedback(null);
    setPendingReanalyze(false);
  };

  const handleClose = (v) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Auto re-extract when returning from feedback dialog
  useEffect(() => {
    if (pendingReanalyze && fileUrl && step === 2) {
      setPendingReanalyze(false);
      handleExtract();
    }
  }, [pendingReanalyze, step]);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError(null);
    setIsUploading(true);

    const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
    setFileUrl(file_url);
    setIsUploading(false);
  };

  const handleExtract = async () => {
    if (!fileUrl) return;
    setIsExtracting(true);
    setError(null);

    // Construir info detallada de proveedores para la IA
    const supplierDetails = suppliers.map(s => {
      const rutStr = s.tax_id ? ` (RUT: ${s.tax_id})` : '';
      return `${s.name}${rutStr}`;
    }).join('; ');
    const supplierNames = suppliers.map(s => s.name).join(', ');
    const categoriesStr = invoiceType === 'supply' 
      ? `Categorías de insumos EXISTENTES (USAR ESTAS si coinciden): ${supplyCategories.length > 0 ? supplyCategories.join(', ') : 'ninguna configurada'}` 
      : `Centros de costo OPEX EXISTENTES (USAR ESTOS si coinciden): ${opexCostCenters.length > 0 ? opexCostCenters.map(c => `${c.name}${c.categories?.length > 0 ? ` [subcategorías: ${c.categories.join(', ')}]` : ''}`).join('; ') : 'ninguno configurado'}`;
    const supplyItemsStr = invoiceType === 'supply' && supplyItems.length > 0
      ? `\nInsumos existentes: ${supplyItems.slice(0, 50).map(s => s.name).join(', ')}`
      : '';

    const schema = invoiceType === 'supply' ? {
      type: "object",
      properties: {
        supplier_name: { type: "string", description: "Nombre comercial del proveedor/emisor (NO el comprador)" },
        supplier_tax_id: { type: "string", description: "RUT del proveedor en formato XX.XXX.XXX-X" },
        invoice_number: { type: "string", description: "Número de factura o boleta" },
        date: { type: "string", description: "Fecha de emisión en formato YYYY-MM-DD" },
        payment_method: { type: "string", description: "Forma de pago: contado, credito, tarjeta, transferencia" },
        payment_due_date: { type: "string", description: "Fecha de vencimiento del pago (si es a crédito) en YYYY-MM-DD" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre del producto/insumo" },
              quantity: { type: "number", description: "Cantidad comprada (puede ser decimal, ej: 10.5, 3.75)" },
              unit: { type: "string", description: "Unidad: kg, g, L, ml, unidad, caja, docena, lb, oz, paquete" },
              unit_price: { type: "number", description: "Precio unitario sin IVA" },
              subtotal: { type: "number", description: "Subtotal de este item sin IVA" },
              category: { type: "string", description: "Categoría del insumo. DEBE coincidir con categorías existentes del restaurante." }
            }
          }
        },
        subtotal_neto: { type: "number", description: "Monto neto total sin IVA" },
        iva_amount: { type: "number", description: "Monto del IVA" },
        total: { type: "number", description: "Total con IVA incluido" },
        is_tax_exempt: { type: "boolean", description: "true solo si NO hay desglose de IVA" },
        suggested_category: { type: "string", description: "Categoría de insumo. DEBE coincidir con las categorías existentes del restaurante si hay alguna similar. Si no hay ninguna similar, sugerir una nueva." },
        notes: { type: "string", description: "Resumen breve: qué se compró" }
      }
    } : {
      type: "object",
      properties: {
        supplier_name: { type: "string", description: "Nombre comercial del proveedor/emisor" },
        supplier_tax_id: { type: "string", description: "RUT del proveedor en formato XX.XXX.XXX-X" },
        invoice_number: { type: "string", description: "Número de factura" },
        date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
        payment_method: { type: "string", description: "Forma de pago: contado, credito, tarjeta, transferencia" },
        payment_due_date: { type: "string", description: "Fecha de vencimiento del pago (si es a crédito) en YYYY-MM-DD" },
        description: { type: "string", description: "Descripción detallada de los items/servicios" },
        subtotal_neto: { type: "number", description: "Monto neto sin IVA" },
        iva_amount: { type: "number", description: "Monto del IVA" },
        total: { type: "number", description: "Total con IVA" },
        is_tax_exempt: { type: "boolean", description: "true solo si NO hay desglose de IVA" },
        suggested_cost_center: { type: "string", description: "Centro de costo sugerido para OPEX" },
        suggested_category: { type: "string", description: "Subcategoría dentro del centro de costo" },
        notes: { type: "string", description: "Resumen del gasto" }
      }
    };

    const currentYear = new Date().getFullYear();
    const prompt = `Eres un experto en extracción de datos de facturas y boletas chilenas (SII). Analiza esta imagen/PDF con MÁXIMO cuidado.

🔴 REGLA #1 — FECHA:
- Fecha actual: ${new Date().toISOString().split('T')[0]}. Año actual: ${currentYear}.
- Lee la fecha EXACTA del documento. Formatos: "FECHA: 2026-02-13 14:40:20" → "2026-02-13". "13/02/2026" → "2026-02-13".
- Si el año tiene 2 dígitos (ej: "26"), interpreta como 20XX → 2026.

TIPO DE REGISTRO: ${invoiceType === 'supply' ? 'COMPRA DE SUMINISTROS (ingredientes, alimentos, bebidas, insumos de cocina, limpieza)' : 'GASTO OPERATIVO (servicios, arriendo, nómina, marketing, etc.)'}

CONTEXTO DEL NEGOCIO:
⚠️ RUT DEL RESTAURANTE (COMPRADOR): ${restaurant?.tax_id || 'no configurado'}.
Este RUT es del COMPRADOR. JAMÁS lo uses como RUT del proveedor. El PROVEEDOR/EMISOR es la OTRA empresa.

PROVEEDORES EXISTENTES: ${supplierDetails || 'ninguno registrado'}
→ Si el emisor coincide con algún proveedor de esta lista, usa EXACTAMENTE el nombre de la base de datos.

${categoriesStr}
${supplyItemsStr}

══════════════════════════════════════════════════════════════════
🔴🔴🔴 INSTRUCCIÓN CRÍTICA: LECTURA DE MONTOS NUMÉRICOS 🔴🔴🔴
══════════════════════════════════════════════════════════════════

Las facturas chilenas usan FORMATO CHILENO para números:
- PUNTO (.) = separador de MILES → $23.530 = veintitrés mil quinientos treinta = 23530
- COMA (,) = separador DECIMAL → $4.117,65 = cuatro mil ciento diecisiete con sesenta y cinco = 4117.65
- NUNCA confundas: $23.530 NO es 23.53, ES 23530 (veintitrés mil)
- $4.117,65 NO es 4117650, ES 4117.65 (cuatro mil ciento diecisiete con sesenta y cinco)
- $210,08 = 210.08 (doscientos diez con ocho centavos)
- $2.712,81 = 2712.81 (dos mil setecientos doce con ochenta y uno)

CONVERSIÓN OBLIGATORIA al JSON:
- Elimina TODOS los puntos de miles
- Reemplaza la coma decimal por punto decimal
- $23.530 → 23530
- $4.117,65 → 4117.65
- $2.712,81 → 2712.81
- $82.434 → 82434
- $15.662 → 15662
- $98.096 → 98096

══════════════════════════════════════════════════════════════════
🔴 LECTURA DE TABLA DE ITEMS — MÉTODO PASO A PASO
══════════════════════════════════════════════════════════════════

PASO 1: Identifica las COLUMNAS de la tabla. Las facturas chilenas típicamente tienen:
CANT. | ITEM (descripción) | VAL. UNITARIO | %DCTO | SUBTOTAL

PASO 2: Para CADA fila, lee los valores de DERECHA A IZQUIERDA:
1. SUBTOTAL: el último número de la fila (columna más a la derecha con $)
2. VAL. UNITARIO: el número antes del % DCTO (o antes del subtotal si no hay dcto)
3. CANT.: el PRIMER número de la fila, ANTES del nombre del producto

PASO 3: VERIFICA con la fórmula: CANTIDAD × PRECIO_UNITARIO = SUBTOTAL
Si no cuadra, RE-LEE los números.

EJEMPLO CON LA FACTURA TÍPICA:
Fila: "1.000  PAPEL ANTIGRASA 28X34 | PAROLE VERDE    $23.530  0.0%  $23.530"
→ Subtotal = $23.530 → 23530
→ Precio unitario = $23.530 → 23530  
→ Cantidad = 23530 ÷ 23530 = 1 (pero la columna CANT dice "1.000" que en formato chileno = 1)
→ RESULTADO: quantity=1, unit_price=23530, subtotal=23530, name="PAPEL ANTIGRASA 28X34 PAROLE VERDE"

Fila: "1  CLORO, HIPOCLORITO SODIO 3%, ENV. 5L, WK-CL3 - WINKLER    $4.117,65  0.0%  $4.118"
→ Subtotal = $4.118 → 4118
→ Precio = $4.117,65 → 4117.65
→ Cantidad = 4118 ÷ 4117.65 ≈ 1 ✓
→ RESULTADO: quantity=1, unit_price=4117.65, subtotal=4118

Fila: "4  BOLSA DE BASURA NEGRA 110X120CM 0.30MICRAS 10 UNIDADES    $2.712,81  0.0%  $10.850"
→ Subtotal = $10.850 → 10850 (NOTA: aquí el punto ES separador de miles, no decimal, porque 10.850 redondeado tiene sentido con 4 × 2712.81 ≈ 10851)
→ Precio = $2.712,81 → 2712.81
→ Cantidad = 10850 ÷ 2712.81 ≈ 3.998 ≈ 4 ✓
→ RESULTADO: quantity=4, unit_price=2712.81, subtotal=10850

⚠️ NÚMEROS EN EL NOMBRE DEL PRODUCTO:
"28X34", "110X120CM", "0.30MICRAS", "10 UNIDADES", "3%", "5L", "1 KILO", "70%", "750 GRS"
→ TODOS son parte del NOMBRE del producto, NO son la cantidad ni el precio.
→ La CANTIDAD siempre viene de la primera columna o del cálculo SUBTOTAL ÷ PRECIO_UNITARIO.

4. PRECIO UNITARIO: SIEMPRE es el valor SIN IVA que aparece en la columna "VAL. UNITARIO".
5. UNIDAD: Para productos de limpieza/empaques/bolsas → "unidad". Para ingredientes con peso → "kg"/"g". Para líquidos → "L"/"ml".
6. Ignora sellos como "PAGADO", "REVISADO", "DESPACHADO".
7. Forma de pago: "contado", "credito", "tarjeta", "transferencia". "A Crédito" → "credito".
8. MONTOS TOTALES: Busca "NETO ($)", "I.V.A. 19%", "TOTAL ($)". Convierte de formato chileno a números.

${invoiceType === 'opex' ? `
9. Para GASTOS OPERATIVOS: Clasifica según items:
   - Limpieza/Higiene = HIGIENE, INOCUIDAD, LIMPIEZA
   - Material Oficina = ADMINISTRACIÓN
   - Luz/Agua/Gas = SERVICIOS BÁSICOS
   - Arriendos = REAL ESTATE / RENTA
   - Personal = PAYROLL / RRHH
` : `
9. Para insumos: clasifica en categorías QUE COINCIDAN con las del restaurante.
`}

══════════════════════════════════════════════════════════════════
🔴 VERIFICACIÓN FINAL OBLIGATORIA (ANTES DE RESPONDER)
══════════════════════════════════════════════════════════════════
1. Para CADA item: subtotal = quantity × unit_price (tolerancia ±2 por redondeo)
2. Suma de TODOS los subtotales ≈ subtotal_neto de la factura (tolerancia ±5)
3. subtotal_neto + iva_amount = total
4. Si CUALQUIER verificación falla, RE-LEE los números de la factura desde cero.
5. Los valores numéricos en el JSON deben ser NÚMEROS, no strings. Sin puntos de miles, con punto decimal.`;

    // Inject user feedback from re-analysis if available
    let feedbackPrompt = '';
    if (reanalyzeFeedback) {
      const errorLabels = {
        supplier_name: 'el nombre del proveedor',
        supplier_rut: 'el RUT del proveedor',
        products: 'los productos/items detectados',
        quantities: 'las cantidades o precios',
        category: 'la categoría asignada',
        amounts: 'los montos (neto/IVA/total)',
        date: 'la fecha',
        invoice_number: 'el número de factura',
      };
      const errorsList = (reanalyzeFeedback.errors || []).map(e => errorLabels[e] || e).join(', ');
      if (errorsList || reanalyzeFeedback.details) {
        feedbackPrompt = `\n\n══════════════════════════════════════════════════════════════════
🔴🔴🔴 CORRECCIONES DEL USUARIO (RE-ANÁLISIS) 🔴🔴🔴
══════════════════════════════════════════════════════════════════
El usuario indica que el análisis anterior tuvo errores. PRESTA ESPECIAL ATENCIÓN a corregir estos aspectos:
${errorsList ? `\n❌ ERRORES REPORTADOS: ${errorsList}` : ''}
${reanalyzeFeedback.details ? `\n📝 DETALLES DEL USUARIO: "${reanalyzeFeedback.details}"` : ''}

INSTRUCCIÓN: Re-lee la factura con MUCHO CUIDADO en los campos mencionados. Los datos anteriores estaban MAL.`;
      }
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: prompt + feedbackPrompt,
      file_urls: [fileUrl],
      response_json_schema: schema
    });

    setExtractedData(result);
    setIsExtracting(false);
    setStep(3);
  };

  // Auto-agregar categorías/centros de costo nuevos detectados por la IA al config del restaurante
  const autoAddMissingConfig = async (d) => {
    if (!restaurant?.id) return;
    const currentConfig = { ...(restaurant.config || {}) };
    let needsUpdate = false;

    if (invoiceType === 'supply') {
      // Auto-agregar categoría de suministro si no existe
      const cat = d.suggested_category?.trim();
      if (cat) {
        const existingCats = currentConfig.supply_categories || [];
        const existingNames = existingCats.map(c => typeof c === 'string' ? c : c?.name || '').map(n => n.toLowerCase());
        if (!existingNames.includes(cat.toLowerCase())) {
          // Add as object format to match schema
          currentConfig.supply_categories = [...existingCats, { name: cat, cost_type: 'food_cost' }];
          needsUpdate = true;
        }
      }
    } else {
      // Auto-agregar centro de costo OPEX si no existe
      const centerName = d.suggested_cost_center?.trim();
      if (centerName) {
        const existingCenters = currentConfig.cost_centers || [];
        let center = existingCenters.find(c => c.name.toLowerCase() === centerName.toLowerCase());
        
        if (!center) {
          // Crear el centro de costo nuevo
          center = { name: centerName.toUpperCase(), type: 'opex', categories: [] };
          currentConfig.cost_centers = [...existingCenters, center];
          needsUpdate = true;
        }

        // Auto-agregar subcategoría dentro del centro de costo
        const subCat = (d.suggested_opex_category || d.suggested_category || '').trim();
        if (subCat && center) {
          const centerIndex = (currentConfig.cost_centers || []).findIndex(
            c => c.name.toLowerCase() === (centerName || '').toLowerCase()
          );
          if (centerIndex >= 0) {
            const cats = currentConfig.cost_centers[centerIndex].categories || [];
            if (!cats.some(c => c.toLowerCase() === subCat.toLowerCase())) {
              currentConfig.cost_centers[centerIndex] = {
                ...currentConfig.cost_centers[centerIndex],
                categories: [...cats, subCat]
              };
              needsUpdate = true;
            }
          }
        }
      }
    }

    if (needsUpdate) {
      await base44.entities.Restaurant.update(restaurant.id, { config: currentConfig });
    }
  };

  const handleConfirm = async (editedForm) => {
    const d = editedForm || extractedData;
    if (!d) return;

    // 🔴 Seguridad: JAMÁS guardar el RUT del restaurante como RUT del proveedor
    const normalizeR = (r) => (r || '').replace(/[\.\s\-]/g, '').toLowerCase().trim();
    if (restaurant?.tax_id && d.supplier_tax_id && normalizeR(d.supplier_tax_id) === normalizeR(restaurant.tax_id)) {
      d.supplier_tax_id = '';
    }

    // Auto-agregar categorías/centros nuevos al config del restaurante
    await autoAddMissingConfig(d);

    const dateVal = d.date || new Date().toISOString().split('T')[0];
    const paymentStatus = d.payment_status || 'pagado';

    // Derive supply_category from items' individual categories
    const items = d.items || [];
    const derivedCategory = (items.length > 0 && items[0].category) 
      ? items[0].category 
      : (d.suggested_category || '');

    const baseSupplyFields = {
      restaurant_id: restaurant.id,
      date: dateVal,
      supply_category: derivedCategory,
      is_tax_exempt: d.is_tax_exempt || false,
      supplier: d.supplier_name || '',
      supplier_tax_id: d.supplier_tax_id || '',
      invoice_number: d.invoice_number || '',
      payment_status: paymentStatus,
      payment_date: paymentStatus === 'pagado' ? dateVal : '',
      payment_due_date: d.payment_due_date || '',
      supply_type: 'ingredients',
      notes: d.notes || '',
    };

    if (invoiceType === 'supply') {
      const items = d.items || [];
      // Crear UN SOLO registro con el neto total de la factura
      // Los items individuales van como detalle en las notas y se pasan para actualizar stock
      const sym = currency === 'CLP' ? '$' : currency === 'USD' ? 'US$' : '$';
      const itemsDetail = items.map(item => 
        `${item.quantity || ''} ${item.unit || ''} ${item.name} (${sym}${Math.round(parseFloat(item.subtotal) || 0).toLocaleString('es-CL')})`
      ).join(', ');

      // Si hay un solo item, usar su nombre e info directamente
      const singleItem = items.length === 1 ? items[0] : null;

      // Build items array with category info for persistence
      const mappedItems = items.map(item => ({
        name: item.name || '',
        quantity: parseFloat(item.quantity) || 0,
        received_quantity: item.received_quantity != null ? parseFloat(item.received_quantity) : parseFloat(item.quantity) || 0,
        unit: item.unit || 'kg',
        subtotal: parseFloat(item.subtotal) || 0,
        category: item.category || d.suggested_category || '',
      }));

      const record = {
        ...baseSupplyFields,
        supply_item_name: singleItem ? (singleItem.name || '') : '',
        quantity_purchased: singleItem ? (parseFloat(singleItem.quantity) || 0) : 0,
        unit_of_measure: singleItem ? (singleItem.unit || 'kg') : 'unidad',
        subtotal: parseFloat(d.subtotal_neto) || 0,
        notes: d.notes || itemsDetail,
        // Persist items on the entity for later editing
        invoice_items: mappedItems,
        // Also pass as _invoice_items for stock update logic in the mutation
        _invoice_items: mappedItems,
      };

      onSubmitSupply(record);
    } else {
      onSubmitOpex({
        restaurant_id: restaurant.id,
        date: dateVal,
        cost_center_name: d.suggested_cost_center || '',
        category: d.suggested_opex_category || d.suggested_category || '',
        description: d.description || d.notes || '',
        subtotal: parseFloat(d.subtotal_neto) || 0,
        is_tax_exempt: d.is_tax_exempt || false,
        supplier: d.supplier_name || '',
        supplier_tax_id: d.supplier_tax_id || '',
        invoice_number: d.invoice_number || '',
        payment_status: paymentStatus,
        payment_date: paymentStatus === 'pagado' ? dateVal : '',
        payment_due_date: d.payment_due_date || '',
        type: 'other',
      });
    }
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            Subir Factura con IA
            <Badge variant="outline" className="text-violet-600 border-violet-200 bg-violet-50 text-[10px]">BETA</Badge>
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* STEP 1: Tipo */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <p className="text-sm text-gray-600">¿Qué tipo de gasto es esta factura?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setInvoiceType('supply'); setStep(2); }}
                  className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    invoiceType === 'supply' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                    <Package className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="font-semibold text-gray-900">Suministro</p>
                  <p className="text-xs text-gray-500 mt-1">Compra de insumos, alimentos, bebidas, limpieza</p>
                </button>
                <button
                  onClick={() => { setInvoiceType('opex'); setStep(2); }}
                  className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    invoiceType === 'opex' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="font-semibold text-gray-900">Gasto Operativo</p>
                  <p className="text-xs text-gray-500 mt-1">Servicios, arriendo, nómina, marketing, etc.</p>
                </button>
              </div>

              {/* Disclaimer con animación */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.3 }}
                className="relative overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 p-4"
              >
                <div className="flex gap-3">
                  {/* Animación celular + factura */}
                  <div className="flex-shrink-0 w-14 h-20 relative">
                    {/* Celular */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-b from-slate-700 to-slate-800 rounded-lg border-2 border-slate-600 shadow-lg flex items-center justify-center overflow-hidden"
                      animate={{ rotate: [0, -3, 0, 3, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {/* Pantalla */}
                      <div className="w-[85%] h-[80%] bg-white rounded-sm relative overflow-hidden">
                        {/* Factura miniatura */}
                        <div className="p-0.5 space-y-0.5">
                          <div className="h-[3px] w-8 bg-gray-300 rounded mx-auto" />
                          <div className="h-[2px] w-6 bg-gray-200 rounded mx-auto" />
                          <div className="mt-0.5 space-y-[1.5px] px-0.5">
                            <div className="h-[2px] w-full bg-gray-100 rounded" />
                            <div className="h-[2px] w-full bg-gray-100 rounded" />
                            <div className="h-[2px] w-3/4 bg-gray-100 rounded" />
                            <div className="h-[2px] w-full bg-gray-100 rounded" />
                          </div>
                          <div className="h-[3px] w-5 bg-emerald-200 rounded ml-auto mr-0.5 mt-0.5" />
                        </div>
                        {/* Flash de cámara */}
                        <motion.div
                          className="absolute inset-0 bg-white"
                          animate={{ opacity: [0, 0, 0, 0.8, 0, 0, 0, 0, 0] }}
                          transition={{ duration: 4, repeat: Infinity }}
                        />
                      </div>
                      {/* Cámara dot */}
                      <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-500" />
                    </motion.div>
                    {/* Destellos de IA */}
                    <motion.div
                      className="absolute -right-1 -top-1"
                      animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className="w-4 h-4 text-violet-500" />
                    </motion.div>
                  </div>

                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-violet-800 flex items-center gap-1.5 mb-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      La IA puede cometer errores
                    </p>
                    <ul className="text-[11px] text-violet-700/80 space-y-1 leading-tight">
                      <li className="flex items-start gap-1">
                        <span className="mt-0.5">•</span>
                        <span>Configura tus <strong>proveedores</strong> para mejor precisión automática</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <span className="mt-0.5">•</span>
                        <span><strong>Revisa el preview</strong> de datos antes de confirmar</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <span className="mt-0.5">•</span>
                        <span>Puedes <strong>re-analizar</strong> si los datos no son correctos</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* STEP 2: Subir archivo */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={invoiceType === 'supply' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}>
                  {invoiceType === 'supply' ? '🍽️ Suministro' : '💼 Gasto Operativo'}
                </Badge>
                <button onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-gray-600">Cambiar</button>
              </div>

              <p className="text-sm text-gray-600">Sube una foto o PDF de la factura</p>

              {!file ? (
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-violet-400 hover:bg-violet-50/30 transition-all">
                    <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Camera className="w-8 h-8 text-violet-600" />
                    </div>
                    <p className="font-semibold text-gray-700">Toca para subir</p>
                    <p className="text-xs text-gray-400 mt-1">Foto, imagen o PDF de la factura</p>
                  </div>
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border">
                    <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    )}
                  </div>

                  {fileUrl && !isUploading && (
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => { setFile(null); setFileUrl(null); }}>
                        Cambiar archivo
                      </Button>
                      <Button 
                        onClick={handleExtract} 
                        disabled={isExtracting}
                        className="flex-1 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
                      >
                        {isExtracting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analizando...</>
                        ) : (
                          <><Sparkles className="w-4 h-4 mr-2" /> Extraer datos</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3: Revisión con formulario editable */}
          {step === 3 && extractedData && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <InvoicePreviewForm
                extractedData={extractedData}
                invoiceType={invoiceType}
                restaurant={restaurant}
                supplyItems={supplyItems}
                suppliers={suppliers}
                currency={currency}
                onConfirm={handleConfirm}
                onBack={(feedback) => {
                  setReanalyzeFeedback(feedback || null);
                  setExtractedData(null);
                  setStep(2);
                  setPendingReanalyze(true);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}