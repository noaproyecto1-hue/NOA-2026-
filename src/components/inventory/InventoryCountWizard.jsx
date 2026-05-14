import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, ChevronRight, Check, Loader2, Carrot, 
  ClipboardCheck, AlertTriangle, Package, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getTodayInUserTz, getCurrentDateInUserTz, formatDateInUserTz } from '@/components/utils/timezoneHelper';

export default function InventoryCountWizard({
  open,
  onOpenChange,
  countType, // 'daily' | 'monthly'
  restaurantId,
  supplyItems = [],
  isManager = false,
  onSuccess
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [counts, setCounts] = useState({}); // { itemId: quantity }
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [countStarted, setCountStarted] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Cargar config de conteo diario
  const { data: dailyConfig } = useQuery({
    queryKey: ['dailyCountConfig', restaurantId],
    queryFn: async () => {
      const configs = await base44.entities.DailyCountConfig.filter({ restaurant_id: restaurantId });
      return configs[0] || null;
    },
    enabled: !!restaurantId && open
  });

  // Verificar si ya se hizo un conteo hoy (para bloqueo de 1 vez al día)
  const todayStr = getTodayInUserTz(null); // fecha de hoy en timezone
  const { data: todayCounts = [] } = useQuery({
    queryKey: ['todayCounts', restaurantId, todayStr, countType],
    queryFn: async () => {
      const counts = await base44.entities.InventoryCount.filter({
        restaurant_id: restaurantId,
        date: todayStr,
        count_type: countType
      });
      return counts;
    },
    enabled: !!restaurantId && open && !!todayStr
  });

  const alreadyCountedToday = todayCounts.length > 0;
  const allowMultiple = dailyConfig?.allow_multiple_daily === true;

  // Items a contar según tipo
  const itemsToCount = useMemo(() => {
    const restItems = supplyItems.filter(s => s.restaurant_id === restaurantId && s.is_active !== false);
    
    if (countType === 'monthly') return restItems.sort((a, b) => (a.category || '').localeCompare(b.category || '', 'es') || (a.name || '').localeCompare(b.name || '', 'es'));
    
    if (!dailyConfig) return [];
    
    if (dailyConfig.mode === 'categories' && dailyConfig.selected_categories?.length > 0) {
      return restItems
        .filter(i => dailyConfig.selected_categories.includes(i.category))
        .sort((a, b) => (a.category || '').localeCompare(b.category || '', 'es') || (a.name || '').localeCompare(b.name || '', 'es'));
    }
    
    if (dailyConfig.mode === 'areas' && dailyConfig.selected_areas?.length > 0) {
      return restItems
        .filter(i => dailyConfig.selected_areas.includes(i.area))
        .sort((a, b) => (a.area || '').localeCompare(b.area || '', 'es') || (a.name || '').localeCompare(b.name || '', 'es'));
    }
    
    if (dailyConfig.mode === 'supplies' && dailyConfig.selected_supply_ids?.length > 0) {
      return restItems
        .filter(i => dailyConfig.selected_supply_ids.includes(i.id))
        .sort((a, b) => (a.category || '').localeCompare(b.category || '', 'es') || (a.name || '').localeCompare(b.name || '', 'es'));
    }
    
    return [];
  }, [supplyItems, restaurantId, countType, dailyConfig]);

  const currentItem = itemsToCount[currentIndex];
  const progress = itemsToCount.length > 0 ? ((Object.keys(counts).length) / itemsToCount.length) * 100 : 0;
  const allCounted = Object.keys(counts).length === itemsToCount.length;

  const handleSetCount = useCallback((value) => {
    if (!currentItem) return;
    if (!countStarted) setCountStarted(true);
    const num = value === '' ? '' : value;
    setCounts(prev => ({ ...prev, [currentItem.id]: num }));
  }, [currentItem, countStarted]);

  const goNext = useCallback(() => {
    if (currentIndex < itemsToCount.length - 1) {
      setCurrentIndex(i => i + 1);
    }
  }, [currentIndex, itemsToCount.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    }
  }, [currentIndex]);

  const handleSubmit = async () => {
    setSubmitting(true);
    // Usar la zona horaria del usuario para la fecha del conteo
    const today = getTodayInUserTz(user);
    const nowFormatted = formatDateInUserTz(new Date(), "yyyy-MM-dd'T'HH:mm:ss", user);
    const sessionId = `${countType}_${restaurantId}_${Date.now()}`;
    const displayName = user?.display_name || user?.full_name || user?.email || 'Desconocido';
    const userEmail = user?.email || '';

    const countRecords = [];
    const inventoryUpdates = [];

    for (const item of itemsToCount) {
      const countedValue = counts[item.id];
      if (countedValue === undefined || countedValue === '') continue;
      
      const countedQty = parseFloat(countedValue);
      if (isNaN(countedQty)) continue;

      const expectedQty = item.current_stock || 0;
      const lossQty = expectedQty - countedQty;

      countRecords.push({
        restaurant_id: restaurantId,
        date: today,
        supply_name: item.name,
        area: item.area || '',
        expected_quantity: expectedQty,
        actual_quantity: countedQty,
        unit: item.unit_of_measure || 'unidad',
        loss_quantity: lossQty,
        loss_value: lossQty * (item.average_unit_cost || 0),
        count_type: countType,
        counted_by_name: displayName,
        counted_by_email: userEmail,
        session_id: sessionId
      });

      inventoryUpdates.push({
        id: item.id,
        data: { current_stock: countedQty }
      });
    }

    // Guardar registros de conteo
    if (countRecords.length > 0) {
      await base44.entities.InventoryCount.bulkCreate(countRecords);
    }

    // Actualizar stock y registrar movimiento de stock
    for (const update of inventoryUpdates) {
      const item = itemsToCount.find(i => i.id === update.id);
      const previousStock = item?.current_stock || 0;
      const newStock = update.data.current_stock;
      const diff = newStock - previousStock;

      await base44.entities.SupplyItem.update(update.id, update.data);

      // Registrar movimiento de stock tipo "count"
      if (diff !== 0) {
        await base44.entities.StockMovement.create({
          restaurant_id: restaurantId,
          product_name: item?.name || '',
          product_id: update.id,
          item_type: 'supply',
          movement_type: 'count',
          quantity: diff,
          previous_stock: previousStock,
          new_stock: newStock,
          transaction_date: nowFormatted,
          reference_name: countType === 'daily' ? 'Conteo Diario' : 'Conteo Mensual',
          notes: `${countType === 'daily' ? 'Conteo diario' : 'Conteo mensual'} por ${displayName}`
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
    queryClient.invalidateQueries({ queryKey: ['inventoryCounts'] });

    setSubmitting(false);
    setFinished(true);
    onSuccess?.(countRecords.length);
  };

  const handleAttemptClose = () => {
    // Si ya empezó a contar y no terminó, bloquear
    if (countStarted && !finished) {
      setShowExitConfirm(true);
      return;
    }
    doClose();
  };

  const doClose = () => {
    setCurrentIndex(0);
    setCounts({});
    setFinished(false);
    setCountStarted(false);
    setShowExitConfirm(false);
    onOpenChange(false);
  };

  // Bloquear navegación del browser cuando el conteo está en progreso
  useEffect(() => {
    if (!open || !countStarted || finished) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '¿Estás seguro? Perderás el conteo en progreso.';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [open, countStarted, finished]);

  if (!open) return null;

  // Pantalla de bloqueo: ya se contó hoy y no se permite múltiples
  if (alreadyCountedToday && !allowMultiple && !finished) {
    return (
      <Dialog open={open} onOpenChange={doClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Conteo ya realizado hoy</h3>
            <p className="text-sm text-gray-500 mb-6">
              Ya se realizó un {countType === 'daily' ? 'conteo diario' : 'conteo mensual'} hoy para este local. 
              Solo se permite un conteo por día.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Si necesitas contar de nuevo, pide al manager que active "Permitir varios conteos al día" en la configuración.
            </p>
            <Button variant="outline" onClick={doClose}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Pantalla de no hay items configurados (conteo diario sin config)
  if (countType === 'daily' && itemsToCount.length === 0) {
    return (
      <Dialog open={open} onOpenChange={doClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Sin configuración de conteo diario</h3>
            <p className="text-sm text-gray-500 mb-6">
              El administrador aún no ha configurado qué insumos se deben contar en el conteo diario.
            </p>
            <Button variant="outline" onClick={doClose}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Pantalla de éxito
  if (finished) {
    return (
      <Dialog open={open} onOpenChange={doClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"
            >
              <Check className="w-10 h-10 text-white" />
            </motion.div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Conteo completado!</h3>
            <p className="text-gray-500 mb-1">
              Se registraron <span className="font-bold text-emerald-600">{Object.keys(counts).length}</span> insumos
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {countType === 'daily' ? 'Conteo Diario' : 'Conteo Mensual'}
            </p>
            <Button onClick={doClose} className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-8">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    {/* Alerta de confirmación para salir */}
    <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-5 h-5" />
            ¿Abandonar el conteo?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tienes un conteo en progreso con <span className="font-bold">{Object.keys(counts).length} insumos</span> registrados.
            Si sales ahora, <span className="font-bold text-red-600">perderás todo el progreso</span> y deberás empezar de nuevo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar conteo</AlertDialogCancel>
          <AlertDialogAction onClick={doClose} className="bg-red-600 hover:bg-red-700">
            Sí, abandonar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={open} onOpenChange={handleAttemptClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden [&>button.absolute]:hidden">
        {/* Header con progreso */}
        <div className={`p-5 pb-4 ${countType === 'daily' ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'} relative`}>
          {/* Botón X personalizado */}
          <button
            onClick={handleAttemptClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors z-10"
          >
            <span className="text-white text-lg leading-none">✕</span>
          </button>

          <div className="flex items-center justify-between mb-3 pr-10">
            <Badge className="bg-white/20 text-white border-0 font-medium">
              {countType === 'daily' ? '📋 Conteo Diario' : '📦 Conteo Mensual'}
            </Badge>
            <span className="text-white/80 text-sm font-medium">
              {currentIndex + 1} / {itemsToCount.length}
            </span>
          </div>
          <Progress 
            value={progress} 
            className="h-3 bg-white/20 [&>[role=progressbar]]:bg-white rounded-full"
          />
          <p className="text-white/70 text-xs mt-2">
            {Object.keys(counts).length} de {itemsToCount.length} contados — {Math.round(progress)}%
          </p>
        </div>

        {/* Alerta de bloqueo al iniciar conteo */}
        {countStarted && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-700">
              Conteo en progreso — finaliza antes de salir
            </p>
          </div>
        )}

        {/* Item actual */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {currentItem && (
              <motion.div
                key={currentItem.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Categoría y Área */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">
                    {currentItem.category || 'Sin categoría'}
                  </Badge>
                  {currentItem.area && (
                    <Badge className="bg-blue-100 text-blue-600 border-0 text-xs">
                      📍 {currentItem.area}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {currentItem.unit_of_measure}
                  </Badge>
                </div>

                {/* Nombre del insumo */}
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Carrot className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900">{currentItem.name}</h2>
                  {currentItem.supplier && (
                    <p className="text-sm text-gray-400 mt-1">Proveedor: {currentItem.supplier}</p>
                  )}
                </div>

                {/* Input de cantidad — SOLO el input, sin mostrar stock esperado al staff */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 block text-center">
                    ¿Cuánto hay en stock?
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={counts[currentItem.id] ?? ''}
                    onChange={e => handleSetCount(e.target.value)}
                    className="text-center text-3xl font-black h-20 rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 text-center">
                    Ingresa la cantidad real en {currentItem.unit_of_measure}
                  </p>

                  {/* Solo el manager ve la referencia del stock esperado */}
                  {isManager && (
                    <div className="bg-amber-50 rounded-xl p-3 mt-3">
                      <p className="text-xs text-amber-700 font-medium text-center">
                        📊 Stock en sistema: <span className="font-bold">{currentItem.current_stock || 0} {currentItem.unit_of_measure}</span>
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navegación */}
        <div className="p-5 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="gap-2 rounded-xl"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>

            {currentIndex === itemsToCount.length - 1 && allCounted ? (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white flex-1 h-12 text-base font-bold shadow-lg"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                ) : (
                  <><ClipboardCheck className="w-5 h-5" /> Finalizar Conteo</>
                )}
              </Button>
            ) : (
              <Button
                onClick={goNext}
                disabled={currentIndex === itemsToCount.length - 1}
                className="gap-2 rounded-xl flex-1 h-12"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Dots / mini nav */}
          <div className="flex justify-center mt-4 gap-1 flex-wrap max-h-[40px] overflow-hidden">
            {itemsToCount.slice(Math.max(0, currentIndex - 8), currentIndex + 9).map((item, idx) => {
              const realIdx = Math.max(0, currentIndex - 8) + idx;
              const isCounted = counts[item.id] !== undefined && counts[item.id] !== '';
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentIndex(realIdx)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    realIdx === currentIndex
                      ? 'bg-blue-500 scale-125'
                      : isCounted 
                        ? 'bg-emerald-400'
                        : 'bg-gray-300'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}