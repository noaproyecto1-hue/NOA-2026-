// Tab "Agente IA" en Settings.
// Permite editar el system prompt del agente NOA Copilot (ventana flotante
// que el manager puede abrir en cualquier página de la plataforma).

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Bot, Save, RotateCcw, CheckCircle2, AlertCircle, Sparkles, Database, MessageSquare } from 'lucide-react';
import {
  loadIntegrations, updateIntegration, isConfigured, DEFAULT_AGENT_PROMPT,
} from '@/lib/integrations';

const AGENT_ACCESS_AREAS = [
  'Dashboard',
  'Inventario',
  'Cocina (recetas)',
  'Ventas y Compras',
  'SII (RCV / boletas / facturas)',
  'Team / RRHH (empleados)',
  'Clientes',
  'Restaurantes',
  'Mi Perfil',
];

const AGENT_BLOCKED_AREAS = ['NOA Copilot (sí mismo)', 'Ajustes / configuración'];

export default function AgentSettings() {
  const [cfg, setCfg] = useState(loadIntegrations());
  const [draftPrompt, setDraftPrompt] = useState(cfg.agent.prompt);
  const [savedAt, setSavedAt] = useState(null);
  const aiOk = isConfigured('ai');

  useEffect(() => {
    setDraftPrompt(cfg.agent.prompt);
  }, [cfg.agent.prompt]);

  const isDirty = draftPrompt !== cfg.agent.prompt;

  const handleSave = () => {
    const next = updateIntegration('agent', { prompt: draftPrompt });
    setCfg(next);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2500);
  };

  const handleReset = () => {
    if (window.confirm('¿Restaurar el prompt por defecto? Perderás tus cambios.')) {
      setDraftPrompt(DEFAULT_AGENT_PROMPT);
      const next = updateIntegration('agent', { prompt: DEFAULT_AGENT_PROMPT });
      setCfg(next);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    }
  };

  const toggleLiveContext = (value) => {
    const next = updateIntegration('agent', { includeLiveContext: value });
    setCfg(next);
  };

  return (
    <div className="space-y-6">
      {savedAt && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg">
          <CheckCircle2 className="w-4 h-4" /> Prompt guardado
        </div>
      )}

      {!aiOk && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Falta configurar la API de IA</AlertTitle>
          <AlertDescription className="text-sm">
            El agente necesita un proveedor de IA configurado (Anthropic / OpenAI / Gemini / DeepSeek). Ve a
            <strong> Configuración → Integraciones</strong> y carga tu API key. Sin eso, el agente solo responde con un mensaje de aviso.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-noa-orange-light">
                <Bot className="w-5 h-5 text-noa-orange-dark" />
              </div>
              <div>
                <CardTitle>Agente IA — Gerente General</CardTitle>
                <CardDescription>
                  Configura cómo se comporta el chat flotante que aparece en toda la plataforma.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Proveedor: {cfg.ai.provider || '—'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Acceso a datos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-noa-navy" /> Acceso a datos
          </CardTitle>
          <CardDescription className="text-xs">
            El agente solo lee estas áreas — no modifica configuración ni crea usuarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-gray-500">Puede acceder</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {AGENT_ACCESS_AREAS.map((a) => (
                  <Badge key={a} className="bg-green-50 text-green-700 border border-green-200 font-normal">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> {a}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-gray-500">Bloqueado</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {AGENT_BLOCKED_AREAS.map((a) => (
                  <Badge key={a} className="bg-red-50 text-red-700 border border-red-200 font-normal">
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contexto en vivo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-noa-orange" /> Contexto en vivo
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Antes de cada respuesta, le inyectamos al agente un snapshot del estado actual: stock bajo, ventas del día, alertas activas, etc.
                Así responde con datos reales en vez de inventar.
              </CardDescription>
            </div>
            <Switch
              checked={cfg.agent.includeLiveContext}
              onCheckedChange={toggleLiveContext}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Prompt editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-noa-navy" /> System Prompt
          </CardTitle>
          <CardDescription className="text-xs">
            Define la personalidad y reglas del agente. Acepta Markdown. Se guarda al pulsar "Guardar".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            rows={22}
            className="font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <p className="text-xs text-gray-500">
              {draftPrompt.length} caracteres · ~{Math.ceil(draftPrompt.length / 4)} tokens estimados
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" /> Restaurar por defecto
              </Button>
              <Button onClick={handleSave} disabled={!isDirty}>
                <Save className="w-4 h-4 mr-2" /> {isDirty ? 'Guardar' : 'Sin cambios'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sugerencias de preguntas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ejemplos de preguntas que te puede responder</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              '¿Qué productos están bajo el stock mínimo y cuánto debo comprar?',
              '¿La receta "Arroz con Pollo" tiene todos los ingredientes en stock?',
              '¿Cuáles son los KPIs de ventas del mes? ¿Voy bien en el balance?',
              '¿Compré el tomate más caro este mes que el anterior? ¿Cuánto subió?',
              '¿Qué desviaciones tengo en compras / inventario / ventas hoy?',
              '¿Cuál fue mi ticket promedio esta semana? ¿Sube o baja?',
              '¿Cuántos platos de "X" puedo producir con el stock actual?',
              '¿Hay alguna alerta activa que deba revisar antes del cierre?',
            ].map((q, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-noa-orange mt-0.5">→</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
