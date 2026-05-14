import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { safeRestaurantUpdate } from '@/components/utils/safeRestaurantUpdate';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, CheckCircle2, XCircle, Link2, Unlink, Eye, EyeOff, 
  RefreshCw, Clock, AlertCircle
} from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function FudoConfigSection({ restaurant, onUpdate }) {
  const queryClient = useQueryClient();
  const fudoConfig = restaurant?.fudo_config || {};
  const isConnected = fudoConfig.is_connected && fudoConfig.api_key;

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey.trim() || !apiSecret.trim()) throw new Error('Completa ambos campos');
      
      // Test connection first
      const testRes = await base44.functions.invoke('syncFudoSales', {
        action: 'test_connection',
        restaurant_id: restaurant.id,
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim()
      });

      if (!testRes.data.success) throw new Error(testRes.data.error || 'Error de conexión');

      // Save credentials
      await safeRestaurantUpdate(restaurant.id, {
        fudo_config: {
          api_key: apiKey.trim(),
          api_secret: apiSecret.trim(),
          is_connected: true,
          last_sync: null
        }
      }, restaurant);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      setApiKey('');
      setApiSecret('');
      setTestResult({ success: true, message: '¡Conectado exitosamente!' });
      onUpdate?.();
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || err.message || 'Error desconocido';
      if (msg.includes('401') || msg.includes('unauthorized')) {
        setTestResult({ success: false, message: 'Credenciales inválidas. Verifica tu API Key y API Secret, y que la API esté habilitada en tu cuenta FUDO.' });
      } else {
        setTestResult({ success: false, message: msg });
      }
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await safeRestaurantUpdate(restaurant.id, {
        fudo_config: {
          api_key: '',
          api_secret: '',
          is_connected: false,
          last_sync: null,
          today_tx_date: '',
          today_tx_ids: []
        }
      }, restaurant);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['dashRestaurants'] });
      setApiKey('');
      setApiSecret('');
      setTestResult({ success: true, message: 'FUDO desconectado correctamente' });
      onUpdate?.();
    }
  });

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setTestResult({ success: false, message: 'Completa ambos campos' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('syncFudoSales', {
        action: 'test_connection',
        restaurant_id: restaurant.id,
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim()
      });
      if (res.data.success) {
        setTestResult({ success: true, message: 'Conexión válida ✓' });
      } else {
        setTestResult({ success: false, message: res.data.error || 'Error de conexión' });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Error desconocido';
      if (msg.includes('401') || msg.includes('unauthorized')) {
        setTestResult({ success: false, message: 'Credenciales inválidas. Verifica tu API Key y API Secret, y que tu cuenta FUDO tenga la API habilitada (escribe a soporte@fu.do).' });
      } else {
        setTestResult({ success: false, message: msg });
      }
    }
    setTesting(false);
  };

  return (
    <Card className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 border-0 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <img 
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6945d758a942733d687ef522/9587d9ffd_idv1Sgc_6-_logos.png"
          alt="FUDO"
          className="w-10 h-10 rounded-xl object-cover"
        />
        <div className="flex-1">
          <Label className="text-gray-900 font-semibold">Integración FUDO</Label>
          <p className="text-xs text-gray-500">Sincroniza ventas desde tu POS FUDO</p>
        </div>
        {isConnected && (
          <Badge className="bg-emerald-100 text-emerald-700 border-0">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        )}
      </div>

      {/* Guía de nomenclatura FUDO */}
      <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-800 space-y-2">
        <p className="font-semibold flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Importante para deducción de inventario
        </p>
        <p>
          Para que las ventas de FUDO descuenten correctamente el inventario, los <strong>nombres de los productos en FUDO</strong> deben coincidir <strong>exactamente</strong> con los nombres de tus <strong>recetas</strong> o <strong>insumos</strong> registrados en NOA.
        </p>
        <ul className="list-disc pl-4 space-y-0.5 text-blue-700">
          <li>Si vendes "Tiramisú Keto" en FUDO, debe existir una receta o insumo llamado exactamente "Tiramisú Keto" en NOA.</li>
          <li>Evita nombres genéricos tipo "Opcional genérico", "Producto", "Bebida" — estos no podrán mapearse al inventario.</li>
          <li>Los combos/menús (ej: Menú Ejecutivo) se desglosan por sub-items, cada uno debe tener nombre real.</li>
        </ul>
        <p className="text-blue-600 italic">Si un producto de FUDO no tiene match, recibirás una alerta automática.</p>
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">FUDO conectado</p>
              <p className="text-xs text-gray-500">
                API Key: {fudoConfig.api_key?.slice(0, 6)}•••{fudoConfig.api_key?.slice(-4)}
              </p>
              {fudoConfig.last_sync && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  Última sincronización: {format(new Date(fudoConfig.last_sync), "dd/MM/yyyy HH:mm", { locale: es })}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className={`w-full ${disconnectMutation.isPending ? 'text-amber-600 border-amber-300 bg-amber-50' : 'text-red-600 hover:bg-red-50 hover:border-red-300'}`}
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
          >
            {disconnectMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Desconectando...
              </>
            ) : (
              <>
                <Unlink className="w-4 h-4 mr-2" />
                Desconectar FUDO
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 bg-amber-100/50 rounded-xl border border-amber-200 text-xs text-amber-800">
            <p className="font-medium mb-1">¿Cómo obtener credenciales?</p>
            <p>En FUDO: Administración → Usuarios → Selecciona un usuario → "Establecer API Secret"</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-600">API Key</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Tu API Key de FUDO"
              className="bg-white h-10"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-600">API Secret</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Tu API Secret de FUDO"
                className="bg-white h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
              testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleTestConnection}
              disabled={testing || !apiKey || !apiSecret}
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Probar
            </Button>
            <Button
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending || !apiKey || !apiSecret}
            >
              {connectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Conectar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}