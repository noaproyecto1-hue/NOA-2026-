import React, { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles, Trash2, Store } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/components/utils/currencyHelper';
import { motion } from 'framer-motion';

const REASON_LABELS = {
  vencimiento: { label: 'Vencimiento', emoji: '⏰' },
  daño: { label: 'Daño físico', emoji: '💔' },
  contaminacion: { label: 'Contaminación', emoji: '☣️' },
  preparacion: { label: 'Error preparación', emoji: '👨‍🍳' },
  otro: { label: 'Otro', emoji: '📋' }
};

export default function WasteImportDialog({
  open,
  onOpenChange,
  supplyItems = [],
  restaurants = [],
  selectedRestaurant = 'all',
  currency = 'USD'
}) {
  const [step, setStep] = useState('upload'); // upload | restaurant | preview | done
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedRestId, setSelectedRestId] = useState(selectedRestaurant !== 'all' ? selectedRestaurant : '');
  const [extractedData, setExtractedData] = useState([]);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const restSupplyItems = useMemo(() => {
    if (!selectedRestId) return supplyItems;
    return supplyItems.filter(s => s.restaurant_id === selectedRestId);
  }, [supplyItems, selectedRestId]);

  const needsRestaurantSelection = selectedRestaurant === 'all' && restaurants.length > 1;

  const handleFileSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');

    // Si necesita seleccionar restaurante y no lo ha hecho
    if (needsRestaurantSelection && !selectedRestId) {
      setStep('restaurant');
      return;
    }

    await processFile(f);
  };

  const processFile = async (fileToProcess) => {
    setLoading(true);
    setError('');

    const restId = selectedRestId || selectedRestaurant;
    const items = supplyItems.filter(s => s.restaurant_id === restId || selectedRestaurant === 'all');
    const itemNames = items.map(s => `${s.name} (${s.unit_of_measure}, costo: ${s.average_unit_cost || 0})`).join(', ');

    const { file_url } = await base44.integrations.Core.UploadFile({ file: fileToProcess });

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          waste_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                supply_name: { type: "string", description: "Nombre del insumo tal como aparece en el catálogo" },
                quantity: { type: "number", description: "Cantidad perdida/mermada" },
                unit: { type: "string", description: "Unidad de medida (kg, g, L, ml, unidad, etc.)" },
                reason: { type: "string", enum: ["vencimiento", "daño", "contaminacion", "preparacion", "otro"], description: "Motivo de la merma" },
                notes: { type: "string", description: "Notas o detalle adicional" },
                date: { type: "string", description: "Fecha en formato YYYY-MM-DD" }
              }
            }
          }
        }
      }
    });

    if (result.status === 'error') {
      setError(result.details || 'No se pudo procesar el archivo');
      setLoading(false);
      return;
    }

    const extracted = (result.output?.waste_items || []).map(item => {
      // Buscar match en insumos del catálogo
      const match = items.find(s =>
        s.name?.toLowerCase().trim() === item.supply_name?.toLowerCase().trim()
      ) || items.find(s =>
        s.name?.toLowerCase().includes(item.supply_name?.toLowerCase()) ||
        item.supply_name?.toLowerCase().includes(s.name?.toLowerCase())
      );

      return {
        ...item,
        supply_id: match?.id || '',
        matched_name: match?.name || '',
        unit: item.unit || match?.unit_of_measure || 'kg',
        estimated_value: match ? (match.average_unit_cost || 0) * (item.quantity || 0) : 0,
        date: item.date || new Date().toISOString().slice(0, 10),
        reason: item.reason || 'otro',
        isMatched: !!match
      };
    });

    setExtractedData(extracted);
    setStep('preview');
    setLoading(false);
  };

  const handleSelectRestaurant = async (restId) => {
    setSelectedRestId(restId);
    setStep('upload');
    if (file) {
      await processFile(file);
    }
  };

  const removeItem = (idx) => {
    setExtractedData(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    setExtractedData(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };

      // Si cambio supply_name, re-match
      if (field === 'supply_id' && value) {
        const match = restSupplyItems.find(s => s.id === value);
        if (match) {
          updated.matched_name = match.name;
          updated.supply_name = match.name;
          updated.unit = match.unit_of_measure || updated.unit;
          updated.estimated_value = (match.average_unit_cost || 0) * (updated.quantity || 0);
          updated.isMatched = true;
        }
      }

      if (field === 'quantity') {
        const match = restSupplyItems.find(s => s.id === updated.supply_id);
        updated.estimated_value = match ? (match.average_unit_cost || 0) * (parseFloat(value) || 0) : 0;
      }

      return updated;
    }));
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const restId = selectedRestId || selectedRestaurant;
      let successCount = 0;

      for (const item of extractedData) {
        if (!item.supply_name || !item.quantity) continue;

        await base44.entities.RegistroMerma.create({
          restaurant_id: restId,
          date: item.date,
          supply_name: item.matched_name || item.supply_name,
          supply_id: item.supply_id || '',
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit,
          estimated_value: item.estimated_value || 0,
          reason: item.reason || 'otro',
          notes: item.notes || 'Importado desde documento'
        });

        // Descontar stock si hay match
        if (item.supply_id) {
          const supply = restSupplyItems.find(s => s.id === item.supply_id);
          if (supply) {
            const newStock = Math.max(0, (supply.current_stock || 0) - (parseFloat(item.quantity) || 0));
            await base44.entities.SupplyItem.update(supply.id, { current_stock: newStock });
            await base44.entities.StockMovement.create({
              restaurant_id: restId,
              product_name: item.matched_name || item.supply_name,
              product_id: supply.id,
              item_type: 'supply',
              movement_type: 'loss',
              quantity: -(parseFloat(item.quantity) || 0),
              previous_stock: supply.current_stock || 0,
              new_stock: newStock,
              transaction_date: new Date().toISOString(),
              notes: `Merma importada: ${REASON_LABELS[item.reason]?.label || item.reason}`
            });
          }
        }
        successCount++;
      }
      return successCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['wasteRecords'] });
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      setImportResult({ success: true, count });
      setStep('done');
    },
    onError: (err) => {
      setError(err.message || 'Error al importar');
    }
  });

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setExtractedData([]);
    setError('');
    setImportResult(null);
    setSelectedRestId(selectedRestaurant !== 'all' ? selectedRestaurant : '');
    onOpenChange(false);
  };

  const totalValue = extractedData.reduce((sum, d) => sum + (d.estimated_value || 0), 0);
  const matchedCount = extractedData.filter(d => d.isMatched).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            Importar Merma desde Documento
          </DialogTitle>
          <DialogDescription>
            Sube tu documento diario de merma y la IA detectará los insumos automáticamente
          </DialogDescription>
        </DialogHeader>

        {/* Step: Seleccionar restaurante */}
        {step === 'restaurant' && (
          <div className="space-y-3 mt-2">
            <Label className="text-sm font-medium">¿A qué local corresponde este documento?</Label>
            {restaurants.map(r => (
              <button
                key={r.id}
                onClick={() => handleSelectRestaurant(r.id)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition-all text-left"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white font-bold">
                  {r.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{r.name}</p>
                  {r.location && <p className="text-xs text-gray-500">{r.location}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 mt-2">
            {selectedRestId && restaurants.length > 1 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-xl border border-orange-100">
                <Store className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-orange-700 font-medium">
                  Local: {restaurants.find(r => r.id === selectedRestId)?.name}
                </span>
                <button onClick={() => setStep('restaurant')} className="ml-auto text-xs text-orange-500 hover:underline">Cambiar</button>
              </div>
            )}

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-orange-400 rounded-2xl p-10 text-center cursor-pointer transition-colors group"
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                  <p className="text-sm text-gray-600 font-medium">Procesando documento con IA...</p>
                  <p className="text-xs text-gray-400">Detectando insumos y cantidades</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Upload className="w-8 h-8 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">Sube tu documento de merma</p>
                    <p className="text-sm text-gray-500 mt-1">Excel (.xlsx) o CSV</p>
                  </div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400">
                <strong>Formato:</strong> Excel o CSV con columnas: insumo, cantidad, unidad, motivo.
                Puedes descargar la plantilla de Merma en Gestión de Datos → Plantillas.
              </p>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4 mt-2">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
                <p className="text-[10px] font-bold text-orange-400 uppercase">Ítems detectados</p>
                <p className="text-xl font-black text-orange-700">{extractedData.length}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-400 uppercase">Coincidencias</p>
                <p className="text-xl font-black text-emerald-700">{matchedCount}/{extractedData.length}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
                <p className="text-[10px] font-bold text-red-400 uppercase">Valor estimado</p>
                <p className="text-xl font-black text-red-700">{formatCurrency(totalValue, currency)}</p>
              </div>
            </div>

            {/* Lista editable */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {extractedData.map((item, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <div className={`p-3 rounded-xl border ${item.isMatched ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.isMatched ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                        {item.isMatched ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          {item.isMatched ? (
                            <p className="font-bold text-gray-900 text-sm">{item.matched_name || item.supply_name}</p>
                          ) : (
                            <Select value={item.supply_id || 'none'} onValueChange={v => updateItem(idx, 'supply_id', v === 'none' ? '' : v)}>
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue placeholder={item.supply_name || 'Seleccionar insumo...'} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">⚠️ {item.supply_name} (sin match)</SelectItem>
                                {restSupplyItems.map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.unit_of_measure})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            className="h-7 w-20 text-xs"
                          />
                          <span className="text-xs text-gray-500">{item.unit}</span>
                          <Select value={item.reason} onValueChange={v => updateItem(idx, 'reason', v)}>
                            <SelectTrigger className="h-7 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(REASON_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {item.estimated_value > 0 && (
                            <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
                              {formatCurrency(item.estimated_value, currency)}
                            </Badge>
                          )}
                          <span className="text-[10px] text-gray-400">{item.date}</span>
                        </div>
                        {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500 shrink-0" onClick={() => removeItem(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Acciones */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || extractedData.length === 0}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              >
                {importMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" /> Importar {extractedData.length} registros</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && importResult && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">¡Merma importada!</h3>
            <p className="text-gray-500 mt-2">Se registraron {importResult.count} ítems de merma correctamente</p>
            <Button onClick={handleClose} className="mt-6 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl px-8">
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}