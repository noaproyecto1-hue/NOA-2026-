import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, Download, CheckCircle2, AlertCircle, 
  Calendar, Eye, ArrowRight, ShoppingCart
} from "lucide-react";
import { format } from 'date-fns';
import { getTodayInUserTz, getUserTimezone, formatDateInUserTz } from '@/components/utils/timezoneHelper';

export default function FudoSyncDialog({ open, onOpenChange, restaurant, onSuccess }) {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const [step, setStep] = useState('dates'); // dates, preview, syncing, done
  const today = getTodayInUserTz(user); // Usa zona horaria del usuario (Chile por defecto)
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [previewData, setPreviewData] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('');
  const progressTimerRef = useRef(null);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('syncFudoSales', {
        action: 'preview_sales',
        restaurant_id: restaurant.id,
        date_from: dateFrom,
        date_to: dateTo,
        timezone: getUserTimezone(user)
      });
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setStep('preview');
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      // Start animated progress
      setSyncProgress(0);
      setSyncStatusText('Conectando con FUDO...');
      const totalSales = previewData?.new_count || 10;
      const estimatedSeconds = Math.max(5, Math.ceil(totalSales * 0.15)); // ~150ms per sale
      let elapsed = 0;

      progressTimerRef.current = setInterval(() => {
        elapsed += 0.5;
        const pct = Math.min(92, (elapsed / estimatedSeconds) * 100);
        setSyncProgress(pct);
        if (pct < 15) setSyncStatusText('Conectando con FUDO...');
        else if (pct < 40) setSyncStatusText('Obteniendo datos de productos...');
        else if (pct < 70) setSyncStatusText('Procesando ventas...');
        else if (pct < 90) setSyncStatusText('Guardando en NOA...');
        else setSyncStatusText('Finalizando...');
      }, 500);

      const res = await base44.functions.invoke('syncFudoSales', {
        action: 'sync_sales',
        restaurant_id: restaurant.id,
        date_from: dateFrom,
        date_to: dateTo,
        timezone: getUserTimezone(user)
      });
      return res.data;
    },
    onSuccess: (data) => {
      clearInterval(progressTimerRef.current);
      setSyncProgress(100);
      setSyncStatusText('¡Listo!');
      setTimeout(() => {
        setSyncResult(data);
        setStep('done');
        onSuccess?.(data);
      }, 500);
    },
    onError: () => {
      clearInterval(progressTimerRef.current);
      setSyncProgress(0);
      setSyncStatusText('');
    }
  });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(progressTimerRef.current);
  }, []);

  const handleClose = () => {
    setStep('dates');
    setPreviewData(null);
    setSyncResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden p-1">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6945d758a942733d687ef522/9587d9ffd_idv1Sgc_6-_logos.png"
                alt="FUDO"
                className="w-full h-full object-contain rounded"
              />
            </div>
            <div>
              <span className="block">Sincronizar Ventas FUDO</span>
              <span className="text-sm font-normal text-gray-500">{restaurant?.name}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Step: Select dates */}
        {step === 'dates' && (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-800">
              <p>Selecciona el rango de fechas para importar ventas desde FUDO. Las ventas duplicadas se omitirán automáticamente.</p>
            </div>

            {/* Quick select buttons */}
            <div className="flex gap-2">
              <Button
                variant={dateFrom === today && dateTo === today ? "default" : "outline"}
                size="sm"
                className={`flex-1 text-xs ${dateFrom === today && dateTo === today ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                onClick={() => { setDateFrom(today); setDateTo(today); }}
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  // Calcular "ayer" en la zona horaria del usuario
                  const todayParts = today.split('-').map(Number);
                  const d = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
                  d.setDate(d.getDate() - 1);
                  const yd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  setDateFrom(yd);
                  setDateTo(yd);
                }}
              >
                Ayer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  const todayParts = today.split('-').map(Number);
                  const d = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
                  d.setDate(d.getDate() - 2);
                  const twoDaysAgo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  setDateFrom(twoDaysAgo);
                  setDateTo(today);
                }}
              >
                Últimos 3 días
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Desde</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  max={dateTo || today}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    // If dateTo is before new dateFrom, adjust it
                    if (e.target.value > dateTo) setDateTo(e.target.value);
                  }}
                  className="h-10"
                  lang="es-CL"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Hasta</Label>
                <Input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  max={today}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10"
                  lang="es-CL"
                />
              </div>
            </div>

            {/* Range warning */}
            {dateFrom && dateTo && (() => {
              const diffDays = Math.round((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24));
              if (diffDays > 3) return (
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700 text-xs flex items-center gap-2 border border-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Rango de {diffDays} días. Se recomienda máximo 3 días para evitar límites de la API de FUDO.
                </div>
              );
              return null;
            })()}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Consultando...</>
                ) : (
                  <><Eye className="w-4 h-4 mr-2" />Ver Preview</>
                )}
              </Button>
            </div>

            {previewMutation.isError && (
              <div className="p-2 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4" />
                {previewMutation.error?.message || 'Error al consultar FUDO'}
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && previewData && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 text-center bg-blue-50 border-blue-200">
                <p className="text-2xl font-bold text-blue-700">{previewData.total}</p>
                <p className="text-xs text-blue-600">Total en FUDO</p>
              </Card>
              <Card className="p-3 text-center bg-emerald-50 border-emerald-200">
                <p className="text-2xl font-bold text-emerald-700">{previewData.new_count}</p>
                <p className="text-xs text-emerald-600">Nuevas</p>
              </Card>
              <Card className="p-3 text-center bg-amber-50 border-amber-200">
                <p className="text-2xl font-bold text-amber-700">{previewData.duplicate_count}</p>
                <p className="text-xs text-amber-600">Ya importadas</p>
              </Card>
            </div>

            {/* Preview list */}
            {previewData.preview?.length > 0 && (
              <div className="max-h-[250px] overflow-y-auto space-y-1.5 border rounded-xl p-2 bg-gray-50">
                {previewData.preview.slice(0, 10).map((sale, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border text-xs">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-3.5 h-3.5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-800">
                          {sale.products?.length || 0} productos
                        </p>
                        <p className="text-gray-400">
                          {sale.date_time ? formatDateInUserTz(sale.date_time, 'dd/MM HH:mm', user) : '—'}
                          {sale.waiter_name && ` · ${sale.waiter_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">${(sale.total_amount || 0).toLocaleString()}</p>
                      <Badge variant="outline" className="text-[10px]">{sale.payment_method}</Badge>
                    </div>
                  </div>
                ))}
                {previewData.preview.length > 10 && (
                  <p className="text-center text-xs text-gray-400 py-1">
                    +{previewData.preview.length - 10} más...
                  </p>
                )}
              </div>
            )}

            {previewData.new_count === 0 && (
              <div className="p-4 text-center bg-amber-50 rounded-xl border border-amber-200">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-amber-800">No hay ventas nuevas para importar</p>
                <p className="text-xs text-amber-600">Todas las ventas del período ya fueron importadas</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('dates')}>
                ← Cambiar fechas
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || previewData.new_count === 0}
              >
                {syncMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" />Importar {previewData.new_count} ventas</>
                )}
              </Button>
            </div>

            {/* Progress bar during sync */}
            {syncMutation.isPending && (
              <div className="space-y-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-medium">{syncStatusText}</span>
                  <span className="text-emerald-600 font-bold">{Math.round(syncProgress)}%</span>
                </div>
                <Progress value={syncProgress} className="h-2 [&>div]:bg-emerald-500" />
                <p className="text-[10px] text-emerald-600 text-center">
                  Importando {previewData.new_count} ventas · No cierres esta ventana
                </p>
              </div>
            )}

            {syncMutation.isError && (
              <div className="p-2 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4" />
                {syncMutation.error?.message || 'Error al sincronizar'}
              </div>
            )}
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && syncResult && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">¡Sincronización completa!</p>
              <p className="text-sm text-gray-600 mt-1">{syncResult.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 text-center bg-emerald-50 border-emerald-200">
                <p className="text-2xl font-bold text-emerald-700">{syncResult.imported}</p>
                <p className="text-xs text-emerald-600">Importadas</p>
              </Card>
              <Card className="p-3 text-center bg-gray-50 border-gray-200">
                <p className="text-2xl font-bold text-gray-500">{syncResult.skipped}</p>
                <p className="text-xs text-gray-500">Omitidas (duplicadas)</p>
              </Card>
            </div>
            <Button className="w-full bg-gray-900 hover:bg-gray-800" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}