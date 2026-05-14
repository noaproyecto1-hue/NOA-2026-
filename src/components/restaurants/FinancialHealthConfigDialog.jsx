import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { 
  Heart,
  Loader2,
  TrendingDown,
  Users,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Valores por defecto basados en industria de restaurantes
// excellent = "menor que este valor"
// good_min / good_max = "entre estos dos valores"  
// warning = "mayor que este valor" (= good_max)
const defaultFinancialHealth = {
  food_cost: { excellent: 45, good_min: 45, good_max: 55 },
  opex_percentage: { excellent: 20, good_min: 20, good_max: 30 },
  labor_cost: { excellent: 25, good_min: 25, good_max: 35 }
};

// Migrar formato viejo (excellent/good/warning) al nuevo (excellent/good_min/good_max)
const migrateOldFormat = (health) => {
  const migrated = {};
  ['food_cost', 'opex_percentage', 'labor_cost'].forEach(key => {
    const old = health?.[key];
    if (!old) {
      migrated[key] = defaultFinancialHealth[key];
    } else if (old.good_min !== undefined) {
      // Ya está en formato nuevo
      migrated[key] = old;
    } else {
      // Formato viejo: excellent, good, warning
      migrated[key] = {
        excellent: old.excellent || defaultFinancialHealth[key].excellent,
        good_min: old.excellent || defaultFinancialHealth[key].good_min,
        good_max: old.warning || old.good || defaultFinancialHealth[key].good_max
      };
    }
  });
  return migrated;
};

const MetricConfigCard = ({ 
  title, 
  icon: Icon, 
  iconColor, 
  values, 
  onChange, 
  tooltip 
}) => {
  return (
    <Card className="p-4 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900">{title}</h4>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-xs text-gray-500">Menor es mejor</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Excelente: menor que X */}
        <div className="p-2 rounded-xl border-2 border-emerald-300 bg-emerald-50">
          <div className="flex items-center gap-1 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium">Excelente</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-gray-500 block mb-1">Menor que</span>
            <div className="flex items-center justify-center gap-0.5">
              <Input
                type="number"
                value={values.excellent || ''}
                onChange={(e) => onChange('excellent', parseFloat(e.target.value) || 0)}
                className="h-8 w-14 text-center font-bold text-sm px-1"
              />
              <span className="text-xs text-gray-500">%</span>
            </div>
          </div>
        </div>

        {/* Aceptable: entre X y Y */}
        <div className="p-2 rounded-xl border-2 border-amber-300 bg-amber-50">
          <div className="flex items-center gap-1 mb-2">
            <Info className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium">Aceptable</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-gray-500 block mb-1">Entre</span>
            <div className="flex items-center justify-center gap-0.5">
              <Input
                type="number"
                value={values.good_min || ''}
                onChange={(e) => onChange('good_min', parseFloat(e.target.value) || 0)}
                className="h-7 w-12 text-center font-bold text-xs px-0.5"
              />
              <span className="text-[10px] text-gray-500">y</span>
              <Input
                type="number"
                value={values.good_max || ''}
                onChange={(e) => onChange('good_max', parseFloat(e.target.value) || 0)}
                className="h-7 w-12 text-center font-bold text-xs px-0.5"
              />
              <span className="text-xs text-gray-500">%</span>
            </div>
          </div>
        </div>

        {/* Alerta: mayor que Y */}
        <div className="p-2 rounded-xl border-2 border-red-300 bg-red-50">
          <div className="flex items-center gap-1 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium">Alerta</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-gray-500 block mb-1">Mayor que</span>
            <div className="flex items-center justify-center gap-0.5">
              <Input
                type="number"
                value={values.good_max || ''}
                readOnly
                className="h-8 w-14 text-center font-bold text-sm px-1 bg-red-100/50 cursor-not-allowed"
              />
              <span className="text-xs text-gray-500">%</span>
            </div>
            <span className="text-[9px] text-red-400 block mt-0.5">(auto del rango aceptable)</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function FinancialHealthConfigDialog({ 
  open, 
  onOpenChange, 
  restaurant,
  onSave,
  isSaving = false
}) {
  const [financialHealth, setFinancialHealth] = useState(defaultFinancialHealth);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && restaurant) {
      setFinancialHealth(migrateOldFormat(restaurant.financial_health));
    }
  }, [open, restaurant?.id]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      financial_health: financialHealth,
    });
    setSaving(false);
  };

  const handleResetDefaults = () => {
    setFinancialHealth(defaultFinancialHealth);
  };

  const updateFinancialHealth = (metric, field, value) => {
    setFinancialHealth(prev => {
      const updated = { ...prev, [metric]: { ...prev[metric], [field]: value } };
      // Auto-sincronizar: good_min = excellent, para mantener coherencia
      if (field === 'excellent') {
        updated[metric].good_min = value;
      }
      return updated;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Configuración de Salud Financiera</DialogTitle>
              <DialogDescription>
                Define qué considera saludable para <span className="font-semibold text-gray-700">{restaurant?.name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-4">
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-4 rounded-xl border border-rose-100">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-rose-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Sistema Semáforo</h4>
                <p className="text-sm text-gray-600">
                  Configura los rangos de distribución ideal del <strong>total de gastos</strong> entre las 3 familias. Las tarjetas de Gastos Generales cambiarán de color:
                  <span className="inline-flex items-center gap-1 mx-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>verde</span>si está excelente,
                  <span className="inline-flex items-center gap-1 mx-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>amarillo</span>si es aceptable, y
                  <span className="inline-flex items-center gap-1 mx-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>rojo</span>si está en alerta.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-1 gap-4">
            <MetricConfigCard
              title="Food Cost"
              icon={ShoppingCart}
              iconColor="bg-gradient-to-br from-amber-500 to-orange-500"
              values={financialHealth.food_cost}
              onChange={(field, value) => updateFinancialHealth('food_cost', field, value)}
              tooltip="Porcentaje del TOTAL DE GASTOS que representa el costo de insumos. Ej: si el 50% de tus gastos totales son Food Cost, configura los rangos aquí."
            />

            <MetricConfigCard
              title="Gastos Operativos"
              icon={TrendingDown}
              iconColor="bg-gradient-to-br from-purple-500 to-violet-500"
              values={financialHealth.opex_percentage}
              onChange={(field, value) => updateFinancialHealth('opex_percentage', field, value)}
              tooltip="Porcentaje del TOTAL DE GASTOS que representan los gastos operativos (sin nómina). Ej: si el 25% de tus gastos son OPEX, configura aquí."
            />

            <MetricConfigCard
              title="Costo Personal"
              icon={Users}
              iconColor="bg-gradient-to-br from-cyan-500 to-blue-500"
              values={financialHealth.labor_cost}
              onChange={(field, value) => updateFinancialHealth('labor_cost', field, value)}
              tooltip="Porcentaje del TOTAL DE GASTOS que representan sueldos y nómina. Ej: si el 30% de tus gastos son personal, configura aquí."
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
          <Button variant="ghost" onClick={handleResetDefaults} className="mr-auto text-gray-500">
            Restaurar valores por defecto
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saving || isSaving}
            className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
          >
            {(saving || isSaving) ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Heart className="w-4 h-4 mr-2" />
                Guardar Configuración
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}