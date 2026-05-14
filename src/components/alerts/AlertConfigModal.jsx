import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Save,
  AlertTriangle,
  Loader2,
  ShoppingCart,
  Users,
  Info,
  CheckCircle2,
  Lock,
  Heart,
  Bell,
} from 'lucide-react';

const FAMILY_META = {
  food_cost: { label: '🛒 Food Cost', icon: ShoppingCart, healthKey: 'food_cost' },
  costo_personal: { label: '👥 Costo Personal', icon: Users, healthKey: 'labor_cost' },
  opex: { label: '⚙️ OPEX', icon: Settings, healthKey: 'opex_percentage' },
  ebitda: { label: '📊 EBITDA', icon: Settings, healthKey: null }, // EBITDA no tiene salud financiera
};

const SMART_DEFAULTS = {
  food_cost_percent: { green: 30, yellow: 35, red: 40 },
  supply_price_change: { green: 5, yellow: 10, red: 15 },
  labor_cost_percent: { green: 25, yellow: 30, red: 35 },
  opex_percent: { green: 15, yellow: 22, red: 30 },
  ebitda_percent: { green: 12, yellow: 5, red: 0 },
};

const DEFAULT_HEALTH = {
  food_cost: { excellent: 45, good_min: 45, good_max: 55 },
  labor_cost: { excellent: 25, good_min: 25, good_max: 35 },
  opex_percentage: { excellent: 20, good_min: 20, good_max: 30 },
};

export default function AlertConfigModal({
  open,
  onOpenChange,
  familyId,
  thresholds = {},
  thresholdConfig = [],
  onSave,
  restaurantName = '',
  restaurant = null,
}) {
  const [localThresholds, setLocalThresholds] = useState({});
  const [localHealth, setLocalHealth] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('alerts');

  const meta = FAMILY_META[familyId] || FAMILY_META.opex;
  const hasHealthTab = !!meta.healthKey;

  // Compute green values from proforma
  const proformaGreens = useMemo(() => {
    const proforma = restaurant?.proforma;
    const result = {};
    if (proforma) {
      result.food_cost_percent = proforma.direct_cost_percent || 0;
      const payrollBudget = (proforma.cost_centers_budget || []).find(b => {
        const n = (b.name || '').toUpperCase();
        return n.includes('PAYROLL') || n.includes('RRHH') || n.includes('PERSONAL');
      });
      result.labor_cost_percent = payrollBudget?.percent || 0;
      const opexBudgets = (proforma.cost_centers_budget || []).filter(b => {
        const n = (b.name || '').toUpperCase();
        return !n.includes('PAYROLL') && !n.includes('RRHH') && !n.includes('PERSONAL');
      });
      result.opex_percent = parseFloat(opexBudgets.reduce((s, b) => s + (b.percent || 0), 0).toFixed(1));
      result.ebitda_percent = proforma.target_ebitda_percent || 0;
    }
    // supply_price_change does NOT come from proforma — it's always user-editable
    return result;
  }, [restaurant]);

  useEffect(() => {
    if (open) {
      // Init alert thresholds
      const clone = {};
      thresholdConfig.forEach(tc => {
        const existing = thresholds[tc.key] || {};
        const defaultVals = SMART_DEFAULTS[tc.key] || { green: 10, yellow: 15, red: 20 };
        const proformaGreen = proformaGreens[tc.key];
        clone[tc.key] = {
          green: proformaGreen || existing.green || defaultVals.green,
          yellow: existing.yellow || defaultVals.yellow,
          red: existing.red || defaultVals.red,
        };
      });
      setLocalThresholds(clone);

      // Init financial health
      if (hasHealthTab) {
        const healthKey = meta.healthKey;
        const existingHealth = restaurant?.financial_health?.[healthKey];
        const defaults = DEFAULT_HEALTH[healthKey] || { excellent: 30, good_min: 30, good_max: 40 };
        
        if (existingHealth && existingHealth.good_min !== undefined) {
          setLocalHealth(existingHealth);
        } else if (existingHealth) {
          // Migrate old format
          setLocalHealth({
            excellent: existingHealth.excellent || defaults.excellent,
            good_min: existingHealth.excellent || defaults.good_min,
            good_max: existingHealth.warning || existingHealth.good || defaults.good_max,
          });
        } else {
          setLocalHealth(defaults);
        }
      }

      setActiveTab('alerts');
    }
  }, [open, thresholds, thresholdConfig, proformaGreens, restaurant]);

  const updateField = (key, field, value) => {
    setLocalThresholds(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: parseFloat(value) || 0 }
    }));
  };

  const updateHealth = (field, value) => {
    setLocalHealth(prev => {
      const updated = { ...prev, [field]: parseFloat(value) || 0 };
      if (field === 'excellent') updated.good_min = parseFloat(value) || 0;
      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);

    // Build alert thresholds
    const relevantThresholds = {};
    thresholdConfig.forEach(tc => {
      if (localThresholds[tc.key]) {
        const proformaGreen = proformaGreens[tc.key];
        const yellowVal = localThresholds[tc.key].yellow || 0;
        relevantThresholds[tc.key] = {
          green: proformaGreen || localThresholds[tc.key].green || 0,
          yellow: yellowVal,
          red: yellowVal,
        };
      }
    });

    await onSave(relevantThresholds, {});
    setIsSaving(false);
    onOpenChange(false);
  };

  const hasProforma = !!restaurant?.proforma;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="block text-lg font-bold">Configurar — {meta.label}</span>
                <span className="text-sm font-normal text-white/60">{restaurantName}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto">
          <div className="space-y-4">
            <AlertThresholdSection
              thresholdConfig={thresholdConfig}
              localThresholds={localThresholds}
              proformaGreens={proformaGreens}
              hasProforma={hasProforma}
              familyId={familyId}
              updateField={updateField}
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-gray-50/50">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-slate-800 hover:bg-slate-900 gap-1.5">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Alert Thresholds Section (% sobre ventas) ──
function AlertThresholdSection({ thresholdConfig, localThresholds, proformaGreens, hasProforma, familyId, updateField }) {
  return (
    <>
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          {familyId === 'ebitda' ? (
            <>El <strong>verde</strong> se toma de tu <strong>EBITDA objetivo</strong> en la Proforma. Si el EBITDA real es <strong>≥ verde</strong>, estás bien. Puedes personalizar el umbral <strong>amarillo</strong>.</>
          ) : familyId === 'food_cost' ? (
            <>Configura los umbrales para generar <strong>alertas de costo de insumos</strong>. Incluye el <strong>food cost sobre ventas</strong> (verde viene de tu Proforma) y la <strong>variación de precios</strong> de tus insumos. Puedes personalizar <strong>amarillo</strong> y <strong>rojo</strong>.</>
          ) : (
            <>Estos umbrales generan <strong>alertas</strong> basadas en el <strong>% sobre ventas</strong>. El verde viene de tu Proforma Ideal. Puedes personalizar <strong>amarillo</strong> y <strong>rojo</strong>.</>
          )}
          {!hasProforma && (
            <span className="block mt-1 text-amber-700 font-medium">
              ⚠️ No tienes proforma configurada. Se usan valores por defecto.
            </span>
          )}
        </p>
      </div>

      {thresholdConfig.map((tc) => {
        const vals = localThresholds[tc.key] || {};
        const proformaGreen = proformaGreens[tc.key];
        const greenIsFromProforma = proformaGreen && proformaGreen > 0;
        const greenDisplay = greenIsFromProforma ? proformaGreen : (vals.green || 0);

        return (
          <div key={tc.key} className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
            <p className="text-sm font-semibold text-gray-800">{tc.label}{tc.inverted ? ' — Mayor es mejor' : ''}</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Green */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                  <span className="text-xs font-bold text-emerald-700">Verde ({tc.inverted ? '≥' : '≤'})</span>
                  {greenIsFromProforma && <Lock className="w-3 h-3 text-emerald-400" />}
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 border-2 border-emerald-200 rounded-lg px-2 py-1.5">
                  <Input type="number" value={greenDisplay} disabled={greenIsFromProforma}
                    onChange={(e) => !greenIsFromProforma && updateField(tc.key, 'green', e.target.value)}
                    className={`h-8 text-center font-bold text-base border-0 bg-transparent p-0 ${greenIsFromProforma ? 'text-emerald-600 cursor-not-allowed' : ''}`}
                  />
                  <span className="text-xs text-emerald-600 font-medium">{tc.unit}</span>
                </div>
                <p className="text-[10px] text-emerald-600">{greenIsFromProforma ? '🔒 Proforma' : 'Editable'}</p>
              </div>

              {/* Yellow */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
                  <span className="text-xs font-bold text-amber-700">{tc.inverted ? 'Amarillo (piso)' : 'Amarillo (hasta)'}</span>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 border-2 border-amber-200 rounded-lg px-2 py-1.5">
                  <Input type="number" value={vals.yellow ?? ''}
                    onChange={(e) => updateField(tc.key, 'yellow', e.target.value)}
                    className="h-8 text-center font-bold text-base border-0 bg-transparent p-0"
                  />
                  <span className="text-xs text-amber-600 font-medium">{tc.unit}</span>
                </div>
                <p className="text-[10px] text-amber-600">✏️ Personalizable</p>
              </div>

              {/* Red */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                  <span className="text-xs font-bold text-red-700">{tc.inverted ? 'Rojo (<)' : 'Rojo (>)'}</span>
                  <Lock className="w-3 h-3 text-red-400" />
                </div>
                <div className="flex items-center gap-1 bg-red-50 border-2 border-red-200 rounded-lg px-2 py-1.5">
                  <Input type="number" value={vals.yellow ?? ''} disabled
                    className="h-8 text-center font-bold text-base border-0 bg-transparent p-0 text-red-600 cursor-not-allowed"
                  />
                  <span className="text-xs text-red-600 font-medium">{tc.unit}</span>
                </div>
                <p className="text-[10px] text-red-600">{tc.inverted ? '🔒 Auto (< amarillo)' : '🔒 Auto (> amarillo)'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border text-xs text-gray-500">
              {tc.inverted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>≥{greenDisplay}{tc.unit}</span>
                  <span className="text-gray-300">→</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>{vals.yellow || '?'}-{greenDisplay}{tc.unit}</span>
                  <span className="text-gray-300">→</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  <span>&lt;{vals.yellow || '?'}{tc.unit}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>≤{greenDisplay}{tc.unit}</span>
                  <span className="text-gray-300">→</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>{greenDisplay}-{vals.yellow || '?'}{tc.unit}</span>
                  <span className="text-gray-300">→</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  <span>&gt;{vals.yellow || '?'}{tc.unit}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Health Config Section (% sobre total de gastos) ──
function HealthConfigSection({ localHealth, updateHealth, familyId, meta }) {
  const FAMILY_LABELS = {
    food_cost: 'Food Cost',
    costo_personal: 'Costo Personal',
    opex: 'OPEX',
  };
  const label = FAMILY_LABELS[familyId] || 'Familia';

  return (
    <>
      <div className="flex items-start gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100">
        <Heart className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-rose-700 leading-relaxed">
          Configura cómo se evalúa <strong>{label}</strong> dentro del <strong>total de gastos</strong> en las tarjetas de "Gastos Generales" del Dashboard. Esto es diferente a las alertas (que usan % sobre ventas).
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
        <p className="text-sm font-semibold text-gray-800">{label} sobre Total de Gastos (%)</p>
        <p className="text-xs text-gray-500">Menor es mejor — se compara el % que representa esta familia del total de gastos</p>

        <div className="grid grid-cols-3 gap-3">
          {/* Excelente */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
              <span className="text-xs font-bold text-emerald-700">Excelente (≤)</span>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50 border-2 border-emerald-200 rounded-lg px-2 py-1.5">
              <Input type="number" value={localHealth.excellent || ''}
                onChange={(e) => updateHealth('excellent', e.target.value)}
                className="h-8 text-center font-bold text-base border-0 bg-transparent p-0"
              />
              <span className="text-xs text-emerald-600 font-medium">%</span>
            </div>
            <p className="text-[10px] text-emerald-600">✏️ Editable</p>
          </div>

          {/* Aceptable */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
              <span className="text-xs font-bold text-amber-700">Aceptable (hasta)</span>
            </div>
            <div className="flex items-center gap-1 bg-amber-50 border-2 border-amber-200 rounded-lg px-2 py-1.5">
              <Input type="number" value={localHealth.good_max || ''}
                onChange={(e) => updateHealth('good_max', e.target.value)}
                className="h-8 text-center font-bold text-base border-0 bg-transparent p-0"
              />
              <span className="text-xs text-amber-600 font-medium">%</span>
            </div>
            <p className="text-[10px] text-amber-600">✏️ Editable</p>
          </div>

          {/* Alerta */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
              <span className="text-xs font-bold text-red-700">Alerta (&gt;)</span>
              <Lock className="w-3 h-3 text-red-400" />
            </div>
            <div className="flex items-center gap-1 bg-red-50 border-2 border-red-200 rounded-lg px-2 py-1.5">
              <Input type="number" value={localHealth.good_max || ''} disabled
                className="h-8 text-center font-bold text-base border-0 bg-transparent p-0 text-red-600 cursor-not-allowed"
              />
              <span className="text-xs text-red-600 font-medium">%</span>
            </div>
            <p className="text-[10px] text-red-600">🔒 Auto (&gt; aceptable)</p>
          </div>
        </div>

        {/* Visual summary */}
        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border text-xs text-gray-500">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>≤{localHealth.excellent || '?'}%</span>
          <span className="text-gray-300">→</span>
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>{localHealth.excellent || '?'}-{localHealth.good_max || '?'}%</span>
          <span className="text-gray-300">→</span>
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <span>&gt;{localHealth.good_max || '?'}%</span>
        </div>
      </div>
    </>
  );
}