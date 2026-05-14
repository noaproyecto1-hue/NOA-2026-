import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Settings,
  CheckCircle2,
} from 'lucide-react';
import CompactAlertCard from '@/components/alerts/CompactAlertCard';

const severityOrder = { red: 0, critical: 0, yellow: 1, high: 1, medium: 1, green: 2, low: 2 };

export default function CostCenterAlertPanel({
  id,
  label,
  icon: Icon,
  color,
  alerts = [],
  onConfigClick,
  onResolve,
  onMarkRead,
  onTogglePin,
  showRestaurant,
  getRestaurantName,
  pinnedCount,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const redCount = alerts.filter(a => a.severity === 'red' || a.severity === 'critical').length;
  const yellowCount = alerts.filter(a => a.severity === 'yellow' || a.severity === 'medium' || a.severity === 'high').length;
  const greenCount = alerts.filter(a => a.severity === 'green' || a.severity === 'low').length;
  const sortedAlerts = [...alerts].sort((a, b) => (severityOrder[a.severity] ?? 1) - (severityOrder[b.severity] ?? 1));

  const SemaphoreDot = ({ count, colorClass }) => (
    <div className="flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded-full ${colorClass} ${count > 0 ? 'animate-pulse' : 'opacity-40'}`} />
      <span className={`text-xs font-bold ${count > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{count}</span>
    </div>
  );

  const colorMap = {
    orange: { border: 'border-l-amber-500', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
    violet: { border: 'border-l-violet-500', iconBg: 'bg-violet-50', iconText: 'text-violet-600' },
    cyan: { border: 'border-l-blue-500', iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
    teal: { border: 'border-l-teal-500', iconBg: 'bg-teal-50', iconText: 'text-teal-600' },
  };
  const cm = colorMap[color] || colorMap.cyan;

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full p-0">
        <div className={`flex items-center justify-between p-4 bg-white border-l-4 ${cm.border} transition-all hover:bg-gray-50`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${cm.iconBg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${cm.iconText}`} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-900 text-base tracking-tight">{label}</h3>
              <p className="text-gray-500 text-xs font-medium">
                {alerts.length === 0 ? 'Sin alertas' : `${alerts.length} alerta${alerts.length > 1 ? 's' : ''} pendiente${alerts.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 bg-gray-100 rounded-lg px-3 py-1.5">
              <SemaphoreDot count={redCount} colorClass="bg-red-500" />
              <SemaphoreDot count={yellowCount} colorClass="bg-amber-400" />
              <SemaphoreDot count={greenCount} colorClass="bg-emerald-500" />
            </div>

            {onConfigClick && (
              <div
                onClick={(e) => { e.stopPropagation(); onConfigClick(id); }}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4 text-gray-500" />
              </div>
            )}

            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
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
              {alerts.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 font-medium">Sin alertas en este centro</p>
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