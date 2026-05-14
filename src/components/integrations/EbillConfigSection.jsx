import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { safeRestaurantUpdate } from '@/components/utils/safeRestaurantUpdate';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, CheckCircle2, XCircle, Link2, Unlink, Eye, EyeOff, 
  RefreshCw, Clock, AlertCircle, FileText
} from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const EBILL_LOGO = "/images/ebill-logo.png";

export default function EbillConfigSection({ restaurant, onUpdate }) {
  const queryClient = useQueryClient();
  const ebillConfig = restaurant?.ebill_config || {};
  const isConnected = ebillConfig.is_connected && ebillConfig.api_key;

  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [environment, setEnvironment] = useState('production');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey.trim() || !accessToken.trim()) throw new Error('Completa ambos campos');
      
      // Test connection first
      const testRes = await base44.functions.invoke('testEbillConnection', {
        action: 'test_connection',
        restaurant_id: restaurant.id,
        api_key: apiKey.trim(),
        access_token: accessToken.trim(),
        environment
      });

      if (!testRes.data.success) throw new Error(testRes.data.error || 'Error de conexión');

      // Save credentials on restaurant
      await safeRestaurantUpdate(restaurant.id, {
        ebill_config: {
          api_key: apiKey.trim(),
          access_token: accessToken.trim(),
          environment,
          is_connected: true,
          company_rut: testRes.data.company?.Rut || '',
          company_name: testRes.data.company?.BusinessName || '',
          last_sync: null
        }
      }, restaurant);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      setApiKey('');
      setAccessToken('');
      setTestResult({ success: true, message: '¡Conectado exitosamente a eBill!' });
      onUpdate?.();
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || err.message || 'Error desconocido';
      setTestResult({ success: false, message: msg });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await safeRestaurantUpdate(restaurant.id, {
        ebill_config: {
          api_key: '',
          access_token: '',
          environment: 'production',
          is_connected: false,
          company_rut: '',
          company_name: '',
          last_sync: null
        }
      }, restaurant);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      setTestResult(null);
      onUpdate?.();
    }
  });

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !accessToken.trim()) {
      setTestResult({ success: false, message: 'Completa ambos campos' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('testEbillConnection', {
        action: 'test_connection',
        restaurant_id: restaurant.id,
        api_key: apiKey.trim(),
        access_token: accessToken.trim(),
        environment
      });
      if (res.data.success) {
        const company = res.data.company;
        setTestResult({ 
          success: true, 
          message: `Conexión válida ✓ — ${company?.BusinessName || 'Empresa'} (${company?.Rut || ''})` 
        });
      } else {
        setTestResult({ success: false, message: res.data.error || 'Error de conexión' });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Error desconocido';
      setTestResult({ success: false, message: msg });
    }
    setTesting(false);
  };

  return (
    <Card className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border-0 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <img 
          src={EBILL_LOGO}
          alt="eBill"
          className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-emerald-200"
        />
        <div className="flex-1">
          <Label className="text-gray-900 font-semibold">Integración eBill</Label>
          <p className="text-xs text-gray-500">Facturación electrónica SII — Recepción de compras y emisión de DTE</p>
        </div>
        {isConnected && (
          <Badge className="bg-emerald-100 text-emerald-700 border-0">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        )}
      </div>

      {/* Info de la integración */}
      <div className="p-3 bg-teal-50/80 rounded-xl border border-teal-200 text-xs text-teal-800 space-y-2 mb-4">
        <p className="font-semibold flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" /> ¿Qué hace esta integración?
        </p>
        <ul className="list-disc pl-4 space-y-0.5 text-teal-700">
          <li><strong>Recepción de facturas:</strong> Las facturas de compra emitidas por tus proveedores en eBill llegarán automáticamente a NOA.</li>
          <li><strong>Auto-clasificación:</strong> NOA mapeará cada factura al proveedor, categoría de insumo y centro de costo correspondiente.</li>
          <li><strong>Actualización de stock:</strong> Los insumos facturados se agregarán al inventario automáticamente.</li>
          <li><strong>Validación previa:</strong> Verás una preview de cada factura antes de confirmarla en el sistema.</li>
        </ul>
        <p className="text-teal-600 italic">Próximamente: emisión de facturas a clientes directamente desde NOA.</p>
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">eBill conectado</p>
              <p className="text-xs text-gray-500">
                {ebillConfig.company_name && <span className="font-medium">{ebillConfig.company_name}</span>}
                {ebillConfig.company_rut && <span> — RUT: {ebillConfig.company_rut}</span>}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Ambiente: {ebillConfig.environment === 'development' ? '🔧 Desarrollo (qaapi)' : '🟢 Producción'}
              </p>
              <p className="text-xs text-gray-400">
                API Key: {ebillConfig.api_key?.slice(0, 6)}•••{ebillConfig.api_key?.slice(-4)}
              </p>
              {ebillConfig.last_sync && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  Última sincronización: {format(new Date(ebillConfig.last_sync), "dd/MM/yyyy HH:mm", { locale: es })}
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
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Desconectando...</>
            ) : (
              <><Unlink className="w-4 h-4 mr-2" />Desconectar eBill</>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 bg-amber-100/50 rounded-xl border border-amber-200 text-xs text-amber-800">
            <p className="font-medium mb-1">¿Cómo obtener credenciales?</p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>Contrata un plan en <a href="https://www.ebill.cl" target="_blank" rel="noopener noreferrer" className="underline font-medium">ebill.cl</a></li>
              <li>El equipo de soporte te entregará tu <strong>X-Api-Key</strong> y <strong>X-Access-Token</strong></li>
              <li>Si necesitas renovar credenciales, escribe a <strong>soporte@ebill.cl</strong></li>
            </ol>
          </div>

          {/* Ambiente */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Ambiente</Label>
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="bg-white h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">🟢 Producción (api.ebill.cl)</SelectItem>
                <SelectItem value="development">🔧 Desarrollo / Pruebas (qaapi.ebill.cl)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-600">X-Api-Key</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Tu API Key de eBill"
              className="bg-white h-10"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-600">X-Access-Token</Label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Tu Access Token de eBill"
                className="bg-white h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`p-2 rounded-lg text-xs flex items-start gap-2 ${
              testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleTestConnection}
              disabled={testing || !apiKey || !accessToken}
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Probar
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending || !apiKey || !accessToken}
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