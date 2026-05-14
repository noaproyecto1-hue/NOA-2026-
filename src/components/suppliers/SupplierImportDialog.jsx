import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X, Truck, Download, Info
} from "lucide-react";
import * as XLSX from 'xlsx';
import { normalizeSupplyCategories } from '@/components/utils/supplyCategoryHelper';

const paymentMethodMap = {
  'efectivo': 'efectivo', 'cash': 'efectivo',
  'transferencia': 'transferencia', 'transfer': 'transferencia', 'banco': 'transferencia',
  'tarjeta': 'tarjeta', 'card': 'tarjeta',
  'cheque': 'cheque'
};

const paymentTermsMap = {
  'contado': 'contado', 'al contado': 'contado', 'inmediato': 'contado',
  '7 dias': '7_dias', '7 días': '7_dias', '7_dias': '7_dias', '7': '7_dias',
  '15 dias': '15_dias', '15 días': '15_dias', '15_dias': '15_dias', '15': '15_dias',
  '30 dias': '30_dias', '30 días': '30_dias', '30_dias': '30_dias', '30': '30_dias',
};

export default function SupplierImportDialog({ 
  open, onOpenChange, restaurantId, onSuccess,
  rawSupplyCategories = [], costCenters = []
}) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  // Derive config info for the template
  const normalized = useMemo(() => normalizeSupplyCategories(rawSupplyCategories), [rawSupplyCategories]);
  const foodCostCats = useMemo(() => normalized.filter(c => c.cost_type === 'food_cost').map(c => c.name), [normalized]);
  const ccSupplyCats = useMemo(() => normalized.filter(c => c.cost_type === 'cost_center'), [normalized]);
  const opexCenters = useMemo(() => (costCenters || []).filter(cc => cc.type === 'opex'), [costCenters]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(null); parsePreview(f); }
  };

  const parsePreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (json.length < 2) { setError('El archivo debe tener al menos una fila de datos'); return; }
      const headers = json[0].map(h => String(h || '').trim().toLowerCase());
      const rows = json.slice(1).filter(r => r.some(c => c != null && c !== ''));
      setPreview({ headers, rowCount: rows.length, sample: rows.slice(0, 5), rawHeaders: json[0] });
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const headers = ['nombre', 'rut', 'telefono', 'email', 'metodo_pago', 'condicion_pago', 'tipo', 'categorias', 'centro_costo', 'subcategoria_opex', 'notas'];

    // Build example rows that reflect the user's actual config
    const rows = [];

    // Example 1: Food cost supplier with multiple categories
    if (foodCostCats.length > 0) {
      const cats = foodCostCats.slice(0, Math.min(3, foodCostCats.length)).join(', ');
      rows.push(['Distribuidora Alimentos Sur', '76.123.456-7', '+56 9 1234 5678', 'ventas@dist.cl', 'transferencia', '30_dias', 'insumos', cats, '', '', 'Entrega lunes y jueves']);
    }

    // Example 2: Another food cost supplier
    if (foodCostCats.length > 2) {
      const cats2 = foodCostCats.slice(2, Math.min(5, foodCostCats.length)).join(', ');
      rows.push(['Proveedora del Pacífico', '77.222.333-4', '+56 9 8765 4321', 'contacto@pacifico.cl', 'transferencia', '15_dias', 'insumos', cats2, '', '', 'Pedido mínimo $100.000']);
    }

    // Example 3: Cost center supply supplier (e.g. cleaning → HIGIENE)
    if (ccSupplyCats.length > 0) {
      const cat = ccSupplyCats[0];
      rows.push([`Comercial ${cat.name}`, '78.444.555-6', '', '', 'efectivo', 'contado', 'insumos', cat.name, '', '', `Insumo → centro: ${cat.cost_center_name}`]);
    }

    // Example 4+: OPEX suppliers — one per center with specific subcategories
    opexCenters.forEach((center, idx) => {
      const subs = center.categories || [];
      if (subs.length > 0) {
        // Show first subcategory as example
        const exampleNames = ['Inmobiliaria Central SpA', 'Consultora RRHH Ltda.', 'Empresa de Servicios', 'Proveedor Logístico', 'Agencia Digital'];
        const name = exampleNames[idx % exampleNames.length];
        rows.push([name, '', '', '', 'transferencia', '30_dias', 'opex', '', center.name, subs[0], `Ejemplo: ${center.name} → ${subs[0]}`]);
      } else {
        rows.push([`Proveedor ${center.name}`, '', '', '', 'transferencia', '30_dias', 'opex', '', center.name, '', `Centro sin subcategorías`]);
      }
    });

    // Example: "ambos" supplier
    if (foodCostCats.length > 0 && opexCenters.length > 0) {
      const mixCat = foodCostCats[0];
      const mixCenter = opexCenters[0];
      const mixSub = (mixCenter.categories || [])[0] || '';
      rows.push(['Multiservicio Gastro', '81.777.888-9', '+56 9 5555 5555', 'info@multigastro.cl', 'tarjeta', '15_dias', 'ambos', mixCat, mixCenter.name, mixSub, 'Provee insumos + servicios']);
    }

    // Fallback
    if (rows.length === 0) {
      rows.push(['Distribuidora Sur', '76.123.456-7', '+56 9 1234 5678', 'ventas@dist.cl', 'transferencia', '30_dias', 'insumos', 'Verduras, Carnes', '', '', 'Entrega los lunes']);
      rows.push(['Servicios Limpieza', '77.000.000-0', '', '', 'transferencia', 'contado', 'opex', '', 'GASTOS FIJOS', 'Electricidad', 'Gasto operativo']);
    }

    // ====== Instructions sheet ======
    const instrHeaders = ['Campo', 'Descripción', 'Valores posibles'];
    const instrRows = [
      ['nombre', 'Nombre o empresa del proveedor (OBLIGATORIO)', 'Texto libre'],
      ['rut', 'RUT/NIT del proveedor', 'Ej: 76.123.456-7'],
      ['telefono', 'Teléfono de contacto', 'Ej: +56 9 1234 5678'],
      ['email', 'Email de contacto', 'Ej: contacto@empresa.cl'],
      ['metodo_pago', 'Método de pago habitual', 'efectivo, transferencia, tarjeta, cheque'],
      ['condicion_pago', 'Condición de pago', 'contado, 7_dias, 15_dias, 30_dias'],
      ['tipo', 'Clasificación del proveedor', 'insumos = suministros (food cost + insumos centro de costos)\nopex = gastos operativos (arriendo, nómina, servicios...)\nambos = provee ambos tipos'],
      ['categorias', 'Para tipo "insumos" o "ambos". Categorías de insumo separadas por coma.',
        foodCostCats.concat(ccSupplyCats.map(c => c.name)).join(', ') || '(configura primero)'],
      ['centro_costo', 'Para tipo "opex" o "ambos". Nombre del centro de costos OPEX.',
        opexCenters.map(c => c.name).join(', ') || '(configura primero)'],
      ['subcategoria_opex', 'Subcategoría dentro del centro de costos (obligatoria si el centro tiene subcategorías).',
        opexCenters.flatMap(c => (c.categories || []).slice(0, 2)).join(', ') || '(depende del centro)'],
      ['notas', 'Notas adicionales', 'Texto libre (opcional)'],
    ];

    // ====== Categorías de Insumos reference ======
    const catHeaders = ['Categoría de Insumo', 'Destino Contable', 'Centro de Costos', 'Explicación'];
    const catRows = [];
    foodCostCats.forEach(c => catRows.push([c, 'FOOD COST', '—', 'Se contabiliza como Costo de Ventas']));
    ccSupplyCats.forEach(c => catRows.push([c.name, 'CENTRO DE COSTOS', c.cost_center_name || '—', `Va como OPEX bajo ${c.cost_center_name}`]));

    // ====== Centros de Costo OPEX with ALL subcategories ======
    const opexHeaders = ['Centro de Costos', 'Subcategoría', '¿Obligatoria?'];
    const opexRows = [];
    opexCenters.forEach(center => {
      const subs = center.categories || [];
      if (subs.length > 0) {
        subs.forEach(sub => opexRows.push([center.name, sub, 'Sí — debe elegir una']));
      } else {
        opexRows.push([center.name, '(sin subcategorías)', 'No — se usa el centro directamente']);
      }
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1: Proveedores
    const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws1['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Proveedores');

    // Sheet 2: Instructions
    const ws2 = XLSX.utils.aoa_to_sheet([instrHeaders, ...instrRows]);
    ws2['!cols'] = [{ wch: 20 }, { wch: 55 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Instrucciones');

    // Sheet 3: Categorías de Insumos
    if (catRows.length > 0) {
      const ws3 = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
      ws3['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 28 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Categorías Insumos');
    }

    // Sheet 4: Centros OPEX + subcategorías
    if (opexRows.length > 0) {
      const ws4 = XLSX.utils.aoa_to_sheet([opexHeaders, ...opexRows]);
      ws4['!cols'] = [{ wch: 28 }, { wch: 35 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Centros OPEX');
    }

    XLSX.writeFile(wb, 'plantilla_proveedores.xlsx');
  };

  const handleImport = async () => {
    if (!file || !restaurantId) return;
    setLoading(true); setError(null);
    try {
      const reader = new FileReader();
      const data = await new Promise((resolve) => {
        reader.onload = (e) => {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }));
        };
        reader.readAsBinaryString(file);
      });

      const headers = data[0].map(h => String(h || '').trim().toLowerCase().replace(/\s+/g, '_'));
      const rows = data.slice(1).filter(r => r.some(c => c != null && c !== ''));

      const findCol = (aliases) => {
        for (const a of aliases) {
          const idx = headers.indexOf(a);
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const nameIdx = findCol(['nombre', 'name', 'empresa', 'proveedor']);
      const taxIdx = findCol(['rut', 'tax_id', 'rut_proveedor', 'nit']);
      const phoneIdx = findCol(['telefono', 'phone', 'tel', 'fono']);
      const emailIdx = findCol(['email', 'correo', 'mail']);
      const payMethodIdx = findCol(['metodo_pago', 'payment_method', 'pago']);
      const payTermsIdx = findCol(['condicion_pago', 'payment_terms', 'condicion', 'plazo']);
      const typeIdx = findCol(['tipo', 'type', 'supplier_type', 'tipo_proveedor']);
      const catIdx = findCol(['categorias', 'categories', 'categoria', 'rubros']);
      const centerIdx = findCol(['centro_costo', 'centro_de_costo', 'cost_center']);
      const subCatIdx = findCol(['subcategoria_opex', 'subcategoria', 'sub_categoria']);
      const notesIdx = findCol(['notas', 'notes', 'observaciones']);

      if (nameIdx === -1) { setError('No se encontró la columna "nombre" o "proveedor"'); setLoading(false); return; }

      const suppliers = rows.map(row => {
        const name = String(row[nameIdx] || '').trim();
        if (!name) return null;
        const payMethodRaw = payMethodIdx !== -1 ? String(row[payMethodIdx] || '').trim().toLowerCase() : '';
        const payTermsRaw = payTermsIdx !== -1 ? String(row[payTermsIdx] || '').trim().toLowerCase() : '';
        const typeRaw = typeIdx !== -1 ? String(row[typeIdx] || '').trim().toLowerCase() : '';
        const catsRaw = catIdx !== -1 ? String(row[catIdx] || '') : '';
        const categories = catsRaw.split(/[,;]/).map(c => c.trim()).filter(Boolean);

        const supplierTypeMap = { 'insumos': 'supply', 'supply': 'supply', 'food_cost': 'supply', 'foodcost': 'supply', 'opex': 'opex', 'gasto': 'opex', 'gasto operativo': 'opex', 'ambos': 'both', 'both': 'both', 'mixto': 'both' };
        const supplierType = supplierTypeMap[typeRaw] || 'supply';

        // Parse OPEX center + subcategory
        const centerRaw = centerIdx !== -1 ? String(row[centerIdx] || '').trim() : '';
        const subCatRaw = subCatIdx !== -1 ? String(row[subCatIdx] || '').trim() : '';
        const opex_categories = [];
        if ((supplierType === 'opex' || supplierType === 'both') && centerRaw) {
          opex_categories.push({ cost_center: centerRaw, category: subCatRaw });
        }

        return {
          restaurant_id: restaurantId,
          name,
          tax_id: taxIdx !== -1 ? String(row[taxIdx] || '').trim() : '',
          contact_phone: phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '',
          contact_email: emailIdx !== -1 ? String(row[emailIdx] || '').trim() : '',
          payment_method: paymentMethodMap[payMethodRaw] || 'transferencia',
          payment_terms: paymentTermsMap[payTermsRaw] || 'contado',
          supplier_type: supplierType,
          supply_categories: supplierType !== 'opex' ? categories : [],
          opex_categories,
          notes: notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '',
          is_active: true
        };
      }).filter(Boolean);

      onSuccess(suppliers);
      resetState();
      onOpenChange(false);
    } catch (err) {
      setError(`Error al importar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => { setFile(null); setPreview(null); setError(null); };

  const allCatNames = foodCostCats.concat(ccSupplyCats.map(c => c.name));

  return (
    <Dialog open={open} onOpenChange={() => { resetState(); onOpenChange(false); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-teal-600" />
            Importar Proveedores desde Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
            {!file ? (
              <label className="cursor-pointer">
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
                <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Haz clic para seleccionar tu archivo</p>
                <p className="text-xs text-gray-400 mt-1">
                  Columnas: nombre, rut, telefono, email, tipo, categorias, centro_costo, subcategoria_opex
                </p>
              </label>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-teal-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">{preview?.rowCount || 0} proveedores detectados</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetState}><X className="w-4 h-4" /></Button>
              </div>
            )}
          </div>

          {/* Smart Template Download */}
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 w-full">
            <Download className="w-4 h-4" />
            Descargar plantilla personalizada
          </Button>

          {/* Config summary — two cards: Suministros + OPEX */}
          {(allCatNames.length > 0 || opexCenters.length > 0) && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                Referencia rápida de tu configuración
              </p>

              {/* Card 1: Suministros (Insumos) — tipo = "insumos" */}
              {allCatNames.length > 0 && (
                <div className="bg-emerald-50/70 rounded-xl p-3.5 border border-emerald-200/60 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">S</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-800">Suministros / Insumos</p>
                      <p className="text-[10px] text-emerald-600/80">tipo = <code className="bg-emerald-100 px-1 rounded font-mono">insumos</code></p>
                    </div>
                  </div>

                  {/* Food Cost subcategories */}
                  {foodCostCats.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-700 mb-1">💰 Food Cost (Costo de Ventas)</p>
                      <div className="flex flex-wrap gap-1">
                        {foodCostCats.map(c => (
                          <Badge key={c} variant="outline" className="text-[10px] bg-white/80 border-emerald-200 text-emerald-700">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Supply categories that go to cost centers */}
                  {ccSupplyCats.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-amber-700 mb-1">🏢 Van a Centro de Costos</p>
                      <div className="flex flex-wrap gap-1">
                        {ccSupplyCats.map(c => (
                          <Badge key={c.name} variant="outline" className="text-[10px] bg-white/80 border-amber-200 text-amber-700">
                            {c.name} → {c.cost_center_name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Card 2: Gastos Operativos (OPEX) — tipo = "opex" */}
              {opexCenters.length > 0 && (
                <div className="bg-blue-50/70 rounded-xl p-3.5 border border-blue-200/60 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">G</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-800">Gastos Operativos (OPEX)</p>
                      <p className="text-[10px] text-blue-600/80">tipo = <code className="bg-blue-100 px-1 rounded font-mono">opex</code></p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {opexCenters.map(center => (
                      <div key={center.name} className="bg-white/60 rounded-lg px-2.5 py-1.5 border border-blue-100">
                        <p className="text-[11px] font-semibold text-blue-800">{center.name}</p>
                        {center.categories?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {center.categories.map(cat => (
                              <Badge key={cat} variant="outline" className="text-[9px] bg-blue-50 border-blue-200/60 text-blue-600 py-0">{cat}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200/60">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  En la columna <strong>tipo</strong> usa: <code className="bg-gray-200 px-1 rounded">insumos</code> (suministros), <code className="bg-gray-200 px-1 rounded">opex</code> (gastos operativos) o <code className="bg-gray-200 px-1 rounded">ambos</code>.
                  En <strong>categorias</strong> usa los nombres de las categorías de insumos separados por coma. Los proveedores OPEX no necesitan categorías aquí.
                </p>
              </div>
            </div>
          )}

          {preview && (
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="font-medium text-sm">{preview.rowCount} proveedores listos para importar</span>
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b">{preview.rawHeaders?.slice(0, 5).map((h, i) => (
                      <th key={i} className="text-left p-1.5 text-gray-600">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>{preview.sample.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">{row.slice(0, 5).map((cell, j) => (
                      <td key={j} className="p-1.5 text-gray-700 truncate max-w-[120px]">{cell || '-'}</td>
                    ))}</tr>
                  ))}</tbody>
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
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!file || !preview || loading} className="bg-teal-600 hover:bg-teal-700">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</> : <><Upload className="w-4 h-4 mr-2" />Importar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}