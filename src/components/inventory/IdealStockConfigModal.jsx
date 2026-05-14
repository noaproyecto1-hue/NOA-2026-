import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Info, Check } from 'lucide-react';

// Porcentajes sugeridos de stock ideal sobre ventas mensuales por tipo de negocio
const BUSINESS_PRESETS = [
  { label: 'Restaurante tradicional', value: 10, emoji: '🍽️', desc: 'Rotación media-alta, menú variado' },
  { label: 'Cafetería / Coffee Shop', value: 12, emoji: '☕', desc: 'Menor rotación, productos secos y perecederos' },
  { label: 'Fast Food / Comida rápida', value: 8, emoji: '🍔', desc: 'Alta rotación, stock mínimo' },
  { label: 'Food Truck', value: 7, emoji: '🚚', desc: 'Espacio limitado, stock ajustado' },
  { label: 'Bar / Pub', value: 15, emoji: '🍺', desc: 'Bebidas con mayor vida útil' },
  { label: 'Catering / Eventos', value: 5, emoji: '🎉', desc: 'Stock por evento, bajo inventario fijo' },
  { label: 'Panadería / Pastelería', value: 10, emoji: '🥐', desc: 'Materias primas con rotación media' },
  { label: 'Dark Kitchen', value: 8, emoji: '👻', desc: 'Similar a fast food, operación eficiente' },
];

export default function IdealStockConfigModal({ open, onOpenChange, currentPercent, onSave, restaurantName }) {
  const [percent, setPercent] = useState(currentPercent || 10);
  const [selectedPreset, setSelectedPreset] = useState(null);

  useEffect(() => {
    if (open) {
      setPercent(currentPercent || 10);
      setSelectedPreset(null);
    }
  }, [open, currentPercent]);

  const handlePresetClick = (preset) => {
    setPercent(preset.value);
    setSelectedPreset(preset.label);
  };

  const handleSave = () => {
    onSave(percent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Configurar Stock Ideal</h3>
              <p className="text-emerald-100 text-xs">
                {restaurantName ? `${restaurantName} — ` : ''}Porcentaje del valor de inventario sobre ventas mensuales
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Explicación */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700 leading-relaxed">
              <p className="font-semibold mb-1">¿Qué es el Stock Ideal?</p>
              <p>Es el porcentaje máximo recomendado del valor de tu inventario respecto a tus ventas mensuales. 
              Si tu stock supera este porcentaje, podrías estar sobreestockeado y amarrando capital innecesariamente.</p>
            </div>
          </div>

          {/* Input directo */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Porcentaje de stock ideal (% sobre ventas)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={percent}
                onChange={e => { setPercent(parseFloat(e.target.value) || 0); setSelectedPreset(null); }}
                className="h-12 text-2xl font-bold text-center w-28 rounded-xl border-gray-200"
              />
              <span className="text-xl font-bold text-gray-400">%</span>
              <div className="flex-1 text-right">
                <p className="text-xs text-gray-500">de las ventas mensuales netas</p>
              </div>
            </div>
          </div>

          {/* Presets por tipo de negocio */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Sugeridos por tipo de negocio
            </Label>
            <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1">
              {BUSINESS_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all duration-200 ${
                    selectedPreset === preset.label
                      ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200 shadow-sm'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{preset.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-gray-800 truncate">{preset.label}</p>
                      {selectedPreset === preset.label && <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{preset.desc}</p>
                    <Badge className="mt-1 bg-gray-100 text-gray-700 border-0 text-[10px] px-1.5 py-0">
                      {preset.value}%
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-11 rounded-xl">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg"
            >
              Guardar configuración
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}