import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  TrendingDown, 
  DollarSign, 
  ThumbsDown,
  CheckCircle,
  ChevronRight,
  Bell,
  Package
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatDateInUserTz } from '@/components/utils/timezoneHelper';

const alertIcons = {
  cash_flow_negative: DollarSign,
  cost_increase: TrendingDown,
  sales_decline: TrendingDown,
  nps_drop: ThumbsDown,
  opex_spike: AlertTriangle,
  low_stock_product: Package,
  low_stock_supply: Package,
  custom: Bell
};

// Sistema semáforo: green=excelente, yellow=atención, red=crítico
const severityColors = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  // Legacy support
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-red-50 text-red-700 border-red-200"
};

const severityBadgeColors = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  // Legacy support
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800"
};

const severityLabels = {
  green: "Verde",
  yellow: "Amarillo",
  red: "Rojo",
  // Legacy support
  low: "Verde",
  medium: "Amarillo",
  high: "Amarillo",
  critical: "Rojo"
};

export default function AlertsPanel({ alerts = [], onResolve, onViewAll }) {
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const unreadAlerts = alerts.filter(a => !a.is_resolved).slice(0, 5);

  if (unreadAlerts.length === 0) {
    return (
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-400" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-gray-600 font-medium">Todo en orden</p>
            <p className="text-sm text-gray-400 mt-1">No hay alertas pendientes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-400" />
          Alertas
          <Badge variant="secondary" className="ml-2 bg-red-100 text-red-700">
            {unreadAlerts.length}
          </Badge>
        </CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll} className="text-gray-500">
            Ver todas
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <AnimatePresence>
          {unreadAlerts.map((alert, index) => {
            const Icon = alertIcons[alert.type] || AlertTriangle;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-xl border ${severityColors[alert.severity]}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${severityColors[alert.severity]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{alert.title}</h4>
                      <Badge className={`text-xs ${severityBadgeColors[alert.severity]}`}>
                        {severityLabels[alert.severity]}
                      </Badge>
                    </div>
                    <p className="text-sm opacity-80 line-clamp-2">{alert.message}</p>
                    {alert.suggested_action && (
                      <p className="text-xs mt-2 opacity-70">
                        💡 {alert.suggested_action}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs opacity-60">
                        {formatDateInUserTz(alert.created_date, "d MMM, HH:mm", currentUser)}
                      </span>
                      {onResolve && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs"
                          onClick={() => onResolve(alert.id)}
                        >
                          Marcar resuelta
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}