import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import CompactAlertCard from '@/components/alerts/CompactAlertCard';

const severityOrder = { red: 0, critical: 0, yellow: 1, high: 1, medium: 1, green: 2, low: 2 };

export default function ProformaAlertPanel({
  alerts = [],
  onResolve,
  onMarkRead,
  onTogglePin,
  showRestaurant,
  getRestaurantName,
  pinnedCount,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const alertCount = alerts.length;
  const sortedAlerts = [...alerts].sort((a, b) => (severityOrder[a.severity] ?? 1) - (severityOrder[b.severity] ?? 1));

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full p-0">
        <div className="flex items-center justify-between p-4 bg-white border-l-4 border-l-indigo-500 transition-all hover:bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-900 text-base tracking-tight">📊 Proforma vs Real</h3>
              <p className="text-gray-500 text-xs font-medium">
                {alertCount === 0 ? 'Todo dentro del ideal' : `${alertCount} desvío${alertCount > 1 ? 's' : ''} detectado${alertCount > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {alertCount > 0 && (
              <Badge className="bg-red-100 text-red-700 font-bold">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {alertCount}
              </Badge>
            )}
            {alertCount === 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                OK
              </Badge>
            )}
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                : <ChevronRight className="w-4 h-4 text-gray-400" />
              }
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-2">
              {/* Explicación */}
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 mb-3">
                <p className="text-xs text-indigo-700">
                  Estas alertas se generan comparando los % reales contra los ideales de tu Proforma (Food Cost, centros de costo, EBITDA). Aparecen cuando no se cumple el objetivo configurado.
                </p>
              </div>

              {alerts.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 font-medium">Todos los indicadores dentro del ideal</p>
                </div>
              ) : (
                sortedAlerts.map(alert => (
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
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}