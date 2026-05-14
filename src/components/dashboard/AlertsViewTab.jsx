import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  TrendingUp,
  Bell,
  CheckCircle2,
  Play,
  Loader2,
  Pin,
  PinOff,
  ShoppingCart,
  Users,
  Settings,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { safeRestaurantUpdate } from '@/components/utils/safeRestaurantUpdate';
import AlertFamilyCard from '@/components/alerts/AlertFamilyCard';
import AlertDetailPanel from '@/components/alerts/AlertDetailPanel';
import AlertConfigModal from '@/components/alerts/AlertConfigModal';
import SelectRestaurantDialog from '@/components/dialogs/SelectRestaurantDialog';

// === 4 FAMILIAS ===
const COST_CENTER_FAMILIES = {
  food_cost: {
    label: 'Food Cost',
    icon: ShoppingCart,
    description: 'Monitorea el costo de insumos y suministros sobre ventas.',
    types: ['cost_increase', 'supply_price_increase', 'supply_price_decrease', 'unusual_purchase_volume', 'supplier_price_trend', 'low_stock_product', 'low_stock_supply'],
    categories: ['costo_ventas', 'inventario'],
    thresholdConfig: [
      { key: 'food_cost_percent', label: 'Food Cost sobre Ventas (%)', unit: '%' },
      { key: 'supply_price_change', label: 'Variación Precio Insumos (%)', unit: '%' },
    ],
  },
  costo_personal: {
    label: 'Costo Personal',
    icon: Users,
    description: 'Controla el gasto de nómina y personal sobre ventas.',
    types: ['payroll_spike', 'labor_cost_high'],
    categories: [],
    thresholdConfig: [
      { key: 'labor_cost_percent', label: 'Costo Personal sobre Ventas (%)', unit: '%' },
    ],
  },
  opex: {
    label: 'OPEX',
    icon: Settings,
    description: 'Todos los gastos operativos (renta, servicios, marketing, etc.) sobre ventas.',
    types: ['opex_spike', 'cash_flow_negative', 'rent_cost_high'],
    categories: ['opex', 'flujo_caja'],
    thresholdConfig: [
      { key: 'opex_percent', label: 'OPEX sobre Ventas (%)', unit: '%' },
    ],
  },
  ebitda: {
    label: 'EBITDA',
    icon: TrendingUp,
    description: 'Utilidad operativa — incluye caída de ventas y margen EBITDA.',
    types: ['ebitda_low', 'proforma_deviation', 'sales_decline'],
    categories: ['ebitda'],
    thresholdConfig: [
      { key: 'ebitda_percent', label: 'EBITDA (%)', unit: '%', inverted: true },
    ],
  }
};

const DEFAULT_THRESHOLDS = {
  food_cost_percent: { red: 40, yellow: 35, green: 30 },
  supply_price_change: { green: 5, yellow: 10, red: 15 },
  labor_cost_percent: { red: 35, yellow: 30, green: 25 },
  opex_percent: { green: 15, yellow: 22, red: 30 },
  ebitda_percent: { green: 12, yellow: 5, red: 0 },
};

const getSeveritySemaforo = (value, thresholds) => {
  if (!thresholds) return 'yellow';
  // green: ≤ green, yellow: > green AND ≤ yellow, red: > yellow
  if (value > thresholds.yellow) return 'red';
  if (value > thresholds.green) return 'yellow';
  return 'green';
};

export default function AlertsViewTab({
  alerts = [],
  restaurantId,
  restaurantConfig = {},
  currentMetrics = {},
  previousMetrics = {},
  currency = 'USD',
  selectedRestaurant = 'all',
  getRestaurantName = () => 'Restaurante',
  restaurants = [],
}) {
  const queryClient = useQueryClient();
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);

  // Config modal state
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configFamilyId, setConfigFamilyId] = useState(null);
  const [configRestaurantId, setConfigRestaurantId] = useState(null);
  const [configRestaurantName, setConfigRestaurantName] = useState('');
  const [restaurantPickerOpen, setRestaurantPickerOpen] = useState(false);
  const [pendingConfigFamily, setPendingConfigFamily] = useState(null);

  // Local state to track resolved/read/pinned changes before BQ syncs
  const [localResolvedIds, setLocalResolvedIds] = useState(new Set());
  const [localReadIds, setLocalReadIds] = useState(new Set());
  const [localPinChanges, setLocalPinChanges] = useState({}); // id -> true/false

  // Deduplicate alerts by id and apply local changes
  const pendingAlerts = useMemo(() => {
    const seen = new Set();
    return alerts.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      if (a.is_resolved || localResolvedIds.has(a.id)) return false;
      return true;
    }).map(a => ({
      ...a,
      is_read: a.is_read || localReadIds.has(a.id),
      is_pinned: a.id in localPinChanges ? localPinChanges[a.id] : a.is_pinned,
    }));
  }, [alerts, localResolvedIds, localReadIds, localPinChanges]);

  const pinnedAlerts = useMemo(() => pendingAlerts.filter(a => a.is_pinned).slice(0, 3), [pendingAlerts]);

  // Mutations — apply locally FIRST, then DELETE from entity (no more is_resolved accumulation)
  const resolveAlertMutation = useMutation({
    mutationFn: (alertId) => {
      setLocalResolvedIds(prev => new Set([...prev, alertId]));
      return base44.entities.Alert.delete(alertId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashAlerts'] });
    }
  });
  const markAsReadMutation = useMutation({
    mutationFn: (alertId) => {
      setLocalReadIds(prev => new Set([...prev, alertId]));
      return base44.entities.Alert.update(alertId, { is_read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    }
  });
  const togglePinMutation = useMutation({
    mutationFn: ({ alertId, isPinned }) => {
      setLocalPinChanges(prev => ({ ...prev, [alertId]: !isPinned }));
      return base44.entities.Alert.update(alertId, { is_pinned: !isPinned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    }
  });
  const createAlertMutation = useMutation({
    mutationFn: (alertData) => base44.entities.Alert.create(alertData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    }
  });

  // Classify alerts into 4 families
  const alertsByFamily = useMemo(() => {
    const result = { food_cost: [], costo_personal: [], opex: [], ebitda: [] };

    pendingAlerts.forEach(a => {
      // EBITDA family (includes sales_decline since it directly impacts EBITDA)
      if (a.type === 'ebitda_low' || a.type === 'sales_decline' || a.category === 'ebitda' ||
          (a.type === 'proforma_deviation' && (a.metadata?.proforma_item || '').toLowerCase() === 'ebitda')) {
        result.ebitda.push(a);
        return;
      }

      if (a.type === 'proforma_deviation') {
        const item = (a.metadata?.proforma_item || '').toUpperCase();
        if (item === 'FOOD_COST' || item.includes('INSUMO') || item.includes('DIRECTO') || item === 'FOOD_COST_PCT') {
          result.food_cost.push(a);
        } else if (item.includes('PAYROLL') || item.includes('RRHH') || item.includes('PERSONAL') || item === 'LABOR_COST_PCT') {
          result.costo_personal.push(a);
        } else {
          result.opex.push(a);
        }
        return;
      }

      if (a.type === 'payroll_spike' || a.type === 'labor_cost_high' ||
          (a.category === 'opex' && a.title?.toLowerCase().includes('personal'))) {
        result.costo_personal.push(a);
        return;
      }

      const fcFamily = COST_CENTER_FAMILIES.food_cost;
      if (fcFamily.types.includes(a.type) || fcFamily.categories.includes(a.category)) {
        result.food_cost.push(a);
        return;
      }

      result.opex.push(a);
    });

    return result;
  }, [pendingAlerts]);

  // Stats — unified semáforo (green/yellow/red only)
  const stats = useMemo(() => ({
    red: pendingAlerts.filter(a => a.severity === 'red').length,
    yellow: pendingAlerts.filter(a => a.severity === 'yellow').length,
    green: pendingAlerts.filter(a => a.severity === 'green').length,
    total: pendingAlerts.length,
    pinned: pinnedAlerts.length
  }), [pendingAlerts, pinnedAlerts]);

  const getMergedThresholds = () => ({ ...DEFAULT_THRESHOLDS, ...restaurantConfig.alert_thresholds });

  const getThreshold = (key) => {
    const all = getMergedThresholds();
    const th = all[key];
    if (th && typeof th === 'object' && ('green' in th || 'yellow' in th)) return th;
    return DEFAULT_THRESHOLDS[key] || { green: 5, yellow: 10, red: 15 };
  };

  // Get selected restaurant object
  const targetRestaurantObj = useMemo(() => {
    if (configRestaurantId) return restaurants.find(r => r.id === configRestaurantId);
    if (restaurantId) return restaurants.find(r => r.id === restaurantId);
    return restaurants[0];
  }, [configRestaurantId, restaurantId, restaurants]);

  // Config handlers
  const handleConfigClick = (familyId) => {
    if (selectedRestaurant === 'all' || !restaurantId) {
      setPendingConfigFamily(familyId);
      setRestaurantPickerOpen(true);
    } else {
      openConfigModal(familyId, restaurantId, getRestaurantName(restaurantId));
    }
  };

  const handleRestaurantPickedForConfig = (restId) => {
    const name = getRestaurantName(restId);
    setConfigRestaurantId(restId);
    setConfigRestaurantName(name);
    if (pendingConfigFamily) {
      openConfigModal(pendingConfigFamily, restId, name);
      setPendingConfigFamily(null);
    }
  };

  const openConfigModal = (familyId, restId, restName) => {
    setConfigFamilyId(familyId);
    setConfigRestaurantId(restId);
    setConfigRestaurantName(restName);
    setConfigModalOpen(true);
  };

  const handleConfigSave = async (thresholdUpdates, healthUpdate) => {
    const targetRestId = configRestaurantId || restaurantId;
    if (!targetRestId) return;
    
    // Always fetch fresh data from the target restaurant (not from consolidated "all" config)
    const targetRest = restaurants.find(r => r.id === targetRestId);
    if (!targetRest) return;
    
    const updatePayload = {};
    if (thresholdUpdates && Object.keys(thresholdUpdates).length > 0) {
      const currentThresholds = targetRest.alert_thresholds || {};
      updatePayload.alert_thresholds = { ...currentThresholds, ...thresholdUpdates };
    }
    if (healthUpdate && Object.keys(healthUpdate).length > 0) {
      const currentHealth = targetRest.financial_health || {};
      updatePayload.financial_health = { ...currentHealth, ...healthUpdate };
    }
    if (Object.keys(updatePayload).length > 0) {
      await safeRestaurantUpdate(targetRestId, updatePayload, targetRest);
    }
    // Invalidate ALL restaurant-related caches so Dashboard picks up new thresholds
    queryClient.invalidateQueries({ queryKey: ['dashRestaurants'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
    queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
  };

  // Manual analysis — calls the backend function, passing restaurant_id to only process the selected one
  const runManualAnalysis = async () => {
    if (!restaurantId) return;
    setIsAnalyzing(true);
    setAnalysisResults(null);

    try {
      const res = await base44.functions.invoke('runScheduledAlertAnalysis', {
        restaurant_id: restaurantId
      });
      const data = res.data;
      const totalCreated = (data.results || []).reduce((sum, r) => sum + (r.alertsCreated || 0), 0);
      
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashAlerts'] });
      
      await new Promise(r => setTimeout(r, 300));
      setAnalysisResults({ 
        alertsCreated: totalCreated, 
        insights: [], 
        alerts: [] 
      });
    } catch (err) {
      console.error('Manual analysis error:', err);
      setAnalysisResults({ alertsCreated: 0, insights: [{ type: 'error', text: 'Error ejecutando análisis.' }], alerts: [] });
    }
    
    setIsAnalyzing(false);
  };

  const commonAlertProps = {
    onResolve: (id) => resolveAlertMutation.mutate(id),
    onMarkRead: (id) => markAsReadMutation.mutate(id),
    onTogglePin: (id, isPinned) => togglePinMutation.mutate({ alertId: id, isPinned }),
    showRestaurant: selectedRestaurant === "all",
    getRestaurantName,
    pinnedCount: stats.pinned,
  };

  return (
    <div className="space-y-6">
      {/* HEADER — simplified, no tabs */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
            <ShieldAlert className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Centro de Alertas</h2>
            <p className="text-xs text-gray-500 font-medium">Monitoreo por centro de costo</p>
          </div>
        </div>

        {/* Manual analysis button */}
        <Button
          onClick={runManualAnalysis}
          disabled={isAnalyzing || !restaurantId}
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg gap-2"
        >
          {isAnalyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Analizando...</>
          ) : (
            <><Play className="w-4 h-4" />Ejecutar Análisis</>
          )}
        </Button>
      </div>

      {/* SEMÁFORO GLOBAL — symmetric 4 cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Crítico', count: stats.red, icon: AlertTriangle, dotColor: 'bg-red-500', bgColor: 'bg-red-50', iconColor: 'text-red-500' },
          { label: 'Atención', count: stats.yellow, icon: Bell, dotColor: 'bg-amber-400', bgColor: 'bg-amber-50', iconColor: 'text-amber-500' },
          { label: 'OK', count: stats.green, icon: CheckCircle2, dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', iconColor: 'text-emerald-500' },
          { label: 'Prioritarias', count: `${stats.pinned}/3`, icon: Pin, dotColor: null, bgColor: 'bg-indigo-50', iconColor: 'text-indigo-500' },
        ].map((s, i) => (
          <Card key={i} className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <div className={`w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center ${s.bgColor}`}>
                <s.icon className={`w-4 h-4 ${s.iconColor}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.count}</p>
              <p className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
                {s.dotColor && <span className={`w-2 h-2 rounded-full ${s.dotColor}`} />} {s.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* PRIORITARIAS */}
      {pinnedAlerts.length > 0 && (
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Pin className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-indigo-900">Alertas Prioritarias</h3>
              <Badge className="bg-indigo-100 text-indigo-700">{pinnedAlerts.length}/3</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {pinnedAlerts.map(alert => (
                <div key={alert.id} className="bg-white rounded-xl p-3 shadow-sm border border-indigo-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{alert.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{alert.message}</p>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-indigo-500 hover:text-indigo-700"
                      onClick={() => togglePinMutation.mutate({ alertId: alert.id, isPinned: true })}
                    >
                      <PinOff className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-2 pt-2 border-t border-indigo-50">
                    <Button
                      size="sm"
                      onClick={() => resolveAlertMutation.mutate(alert.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-3 text-xs w-full gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resuelto
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MAIN LAYOUT: Family cards (left, horizontal) + Detail or Explanation (right) */}
      <div className="flex gap-5 items-start">
        {/* LEFT: 3 family cards stacked */}
        <div className="w-64 min-w-[256px] flex-shrink-0 flex flex-col gap-3">
          {Object.entries(COST_CENTER_FAMILIES).map(([familyId, family]) => (
            <AlertFamilyCard
              key={familyId}
              familyId={familyId}
              label={family.label}
              icon={family.icon}
              alerts={alertsByFamily[familyId] || []}
              isSelected={selectedFamily === familyId}
              onClick={() => setSelectedFamily(selectedFamily === familyId ? null : familyId)}
              onConfigClick={handleConfigClick}
            />
          ))}
        </div>

        {/* RIGHT: Detail panel or explanation — match left column height */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {selectedFamily ? (
              <AlertDetailPanel
                key={selectedFamily}
                familyId={selectedFamily}
                label={COST_CENTER_FAMILIES[selectedFamily]?.label || ''}
                alerts={alertsByFamily[selectedFamily] || []}
                onClose={() => setSelectedFamily(null)}
                {...commonAlertProps}
              />
            ) : (
              <motion.div
                key="explanation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="bg-gradient-to-br from-slate-50 to-blue-50/50 border-slate-200 shadow-sm h-full">
                      <CardContent className="p-6 space-y-5 h-full flex flex-col">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                        <Info className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">¿Cómo funciona el Centro de Alertas?</h3>
                        <p className="text-xs text-gray-500">Selecciona una familia a la izquierda para ver sus alertas</p>
                      </div>
                    </div>

                    <div className="space-y-4 flex-1">
                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <h4 className="font-semibold text-gray-800 text-sm mb-2">🚦 Sistema Semáforo</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Hay 4 familias de costos: <strong>Food Cost</strong>, <strong>Costo Personal</strong>, <strong>OPEX</strong> y <strong>EBITDA</strong>. Cada una tiene umbrales de <span className="font-bold text-emerald-600">verde</span>, <span className="font-bold text-amber-600">amarillo</span> y <span className="font-bold text-red-600">rojo</span>. Al presionar <strong>"Ejecutar Análisis"</strong>, el sistema compara tus datos reales del mes contra estos umbrales y genera alertas automáticas.
                        </p>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <h4 className="font-semibold text-gray-800 text-sm mb-2">🟢 Verde = Proforma Ideal (automático)</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          El umbral verde se toma <strong>automáticamente</strong> de tu Proforma. Para <strong>Food Cost</strong> es el % de costo directo. Para <strong>Costo Personal</strong> es el % de PAYROLL/RRHH. Para <strong>OPEX</strong> es la suma de todos los centros de costo OPEX (sin incluir Payroll). Para <strong>EBITDA</strong> es tu EBITDA objetivo. Si no tienes Proforma configurada, se usan valores por defecto. Para cambiarlo, edita la Proforma en la configuración del restaurante.
                        </p>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <h4 className="font-semibold text-gray-800 text-sm mb-2">🟡 Amarillo = Personalizable desde ⚙️</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Toca el ícono ⚙️ de cada familia para definir cuándo una alerta pasa a amarillo (atención). El <strong>rojo se iguala automáticamente al amarillo</strong>: todo lo que supere el amarillo se marca como crítico. Para <strong>EBITDA</strong> es invertido: si el EBITDA real cae por debajo del amarillo, es crítico (menor utilidad = peor).
                        </p>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <h4 className="font-semibold text-gray-800 text-sm mb-2">📊 ¿Qué pasa al ejecutar un análisis?</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          El sistema compara ventas, compras de insumos, nómina y gastos operativos del período actual. Si un costo supera su umbral verde, se genera una alerta con el desglose de categorías e ítems inflados. También detecta <strong>subidas y bajadas de precios</strong> de insumos comparando compra contra compra, y <strong>tendencias de proveedores</strong> vs el mes anterior.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Analysis results */}
                <AnimatePresence>
                  {analysisResults && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                      <Card className={`border-2 ${analysisResults.alertsCreated > 0 ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            {analysisResults.alertsCreated > 0 ? (
                              <AlertTriangle className="w-5 h-5 text-blue-600" />
                            ) : (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            )}
                            <p className={`font-semibold text-sm ${analysisResults.alertsCreated > 0 ? 'text-blue-900' : 'text-emerald-900'}`}>
                              {analysisResults.alertsCreated > 0
                                ? `Se generaron ${analysisResults.alertsCreated} ${analysisResults.alertsCreated === 1 ? 'alerta' : 'alertas'}. Selecciona cada familia para ver el detalle completo.`
                                : '¡Todo en orden! No se detectaron problemas.'}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Restaurant picker for config */}
      <SelectRestaurantDialog
        open={restaurantPickerOpen}
        onOpenChange={setRestaurantPickerOpen}
        restaurants={restaurants}
        onSelect={handleRestaurantPickedForConfig}
        title="Selecciona un restaurante"
        description="Elige el restaurante que deseas configurar"
      />

      {/* Config Modal */}
      <AlertConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        familyId={configFamilyId}
        thresholds={getMergedThresholds()}
        thresholdConfig={configFamilyId ? (COST_CENTER_FAMILIES[configFamilyId]?.thresholdConfig || []) : []}
        onSave={handleConfigSave}
        restaurantName={configRestaurantName}
        restaurant={targetRestaurantObj}
      />
    </div>
  );
}