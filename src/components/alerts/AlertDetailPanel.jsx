import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, X, AlertTriangle, TrendingDown, Lightbulb } from 'lucide-react';
import CompactAlertCard from '@/components/alerts/CompactAlertCard';

const FAMILY_DESCRIPTIONS = {
  food_cost: '🛒 Compara el costo total de insumos contra tus ventas netas. El umbral verde viene del % de costo directo de tu Proforma. Si supera ese %, se genera una alerta mostrando qué categorías de insumos están más infladas. También analiza compra contra compra para detectar subidas o bajadas de precios por insumo, y tendencias alcistas por proveedor. Personaliza el amarillo desde ⚙️ (el rojo se iguala al amarillo automáticamente).',
  costo_personal: '👥 Compara el gasto de nómina/RRHH contra tus ventas netas. El verde se toma del % de PAYROLL/RRHH en tu Proforma. Si el costo real supera ese umbral, la alerta incluye el desglose por categorías de personal (Gerencia, Cocineros, Garzones, etc.) para que identifiques dónde ajustar. Personaliza el amarillo desde ⚙️.',
  opex: '⚙️ Suma todos los gastos operativos (renta, servicios, marketing, administración, etc.) SIN incluir Payroll, y los compara contra ventas netas. El verde se calcula automáticamente como la suma de los % de todos los centros de costo OPEX de tu Proforma (excluyendo los que contengan "Payroll" o "RRHH"). Personaliza el amarillo desde ⚙️.',
  ebitda: '📈 Tu utilidad operativa. El verde es el EBITDA objetivo (%) que configuraste en la Proforma. Si el EBITDA real es ≥ al objetivo, estás en verde. Si baja del objetivo pero está por encima del amarillo, es atención. Si cae por debajo del amarillo, es crítico. Este semáforo es invertido: mayor es mejor. La alerta incluye desglose completo de todos los costos (insumos, personal, cada centro OPEX).',
};

export default function AlertDetailPanel({
  familyId,
  label,
  alerts = [],
  onClose,
  onResolve,
  onMarkRead,
  onTogglePin,
  showRestaurant,
  getRestaurantName,
  pinnedCount,
}) {
  const severityOrder = { red: 0, critical: 0, yellow: 1, high: 1, medium: 1, green: 2, low: 2 };
  const sorted = [...alerts].sort((a, b) => (severityOrder[a.severity] ?? 1) - (severityOrder[b.severity] ?? 1));

  // Group proforma alerts separately for emphasis
  const proformaAlerts = sorted.filter(a => a.type === 'proforma_deviation');
  const regularAlerts = sorted.filter(a => a.type !== 'proforma_deviation');

  // Extract category breakdown from metadata of food cost alerts
  const categoryBreakdown = alerts
    .filter(a => a.metadata?.category_breakdown)
    .flatMap(a => a.metadata.category_breakdown || []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-lg">{label}</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Description */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <p className="text-sm text-gray-600 leading-relaxed">
          {FAMILY_DESCRIPTIONS[familyId] || 'Monitoreo de este centro de costo.'}
        </p>
      </div>

      {alerts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
            <CardContent className="py-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
              </motion.div>
              <p className="font-bold text-emerald-800 text-lg">Sin alertas</p>
              <p className="text-sm text-emerald-600 mt-1">Todo dentro de los parámetros ideales</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Proforma deviation alerts first */}
          {proformaAlerts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <TrendingDown className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Desviación vs Proforma</span>
              </div>
              {proformaAlerts.map(alert => (
                <CompactAlertCard
                  key={alert.id}
                  alert={alert}
                  onResolve={onResolve}
                  onMarkRead={onMarkRead}
                  onTogglePin={onTogglePin}
                  showRestaurant={showRestaurant}
                  getRestaurantName={getRestaurantName}
                  showPinButton={true}
                  maxPinsReached={pinnedCount >= 3 && !alert.is_pinned}
                />
              ))}
            </div>
          )}

          {/* Category breakdown if present (food cost) */}
          {categoryBreakdown.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-800">Categorías con mayor desviación</span>
                </div>
                <div className="space-y-2">
                  {categoryBreakdown.slice(0, 5).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                      <span className="text-sm font-medium text-gray-800">{cat.category}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{cat.amount?.toLocaleString()}</span>
                        <Badge className={`${cat.percent > 5 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} text-xs`}>
                          {cat.percent?.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Regular alerts */}
          {regularAlerts.length > 0 && (
            <div className="space-y-2">
              {proformaAlerts.length > 0 && (
                <div className="flex items-center gap-2 px-1 mt-2">
                  <AlertTriangle className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Otras alertas</span>
                </div>
              )}
              {regularAlerts.map(alert => (
                <CompactAlertCard
                  key={alert.id}
                  alert={alert}
                  onResolve={onResolve}
                  onMarkRead={onMarkRead}
                  onTogglePin={onTogglePin}
                  showRestaurant={showRestaurant}
                  getRestaurantName={getRestaurantName}
                  showPinButton={true}
                  maxPinsReached={pinnedCount >= 3 && !alert.is_pinned}
                />
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}