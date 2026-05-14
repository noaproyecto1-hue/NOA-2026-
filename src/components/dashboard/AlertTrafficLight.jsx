import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, DollarSign, ThumbsDown, Bell, TrendingUp, Package, ShoppingCart, CheckCircle2 } from "lucide-react";
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const alertIcons = {
  cash_flow_negative: DollarSign,
  cost_increase: TrendingDown,
  sales_decline: TrendingDown,
  nps_drop: ThumbsDown,
  opex_spike: AlertTriangle,
  supply_price_increase: TrendingUp,
  supply_price_decrease: TrendingDown,
  unusual_purchase_volume: ShoppingCart,
  supplier_price_trend: TrendingUp,
  low_stock_product: Package,
  low_stock_supply: Package,
  custom: Bell
};

const severityConfig = {
  // Sistema semáforo (nuevo)
  red: {
    light: 'bg-red-500',
    glow: 'shadow-red-500/50',
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
    label: 'Crítico'
  },
  yellow: {
    light: 'bg-amber-400',
    glow: 'shadow-amber-400/50',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Atención'
  },
  green: {
    light: 'bg-emerald-500',
    glow: 'shadow-emerald-500/50',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    label: 'OK'
  },
  // Sistema legacy (compatibilidad)
  critical: {
    light: 'bg-red-500',
    glow: 'shadow-red-500/50',
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
    label: 'Crítico'
  },
  high: {
    light: 'bg-orange-500',
    glow: 'shadow-orange-500/50',
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    label: 'Alta'
  },
  medium: {
    light: 'bg-amber-400',
    glow: 'shadow-amber-400/50',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Media'
  },
  low: {
    light: 'bg-blue-500',
    glow: 'shadow-blue-500/50',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    label: 'Baja'
  }
};

export default function AlertTrafficLight({ alert, onResolve }) {
  if (!alert) {
    return (
      <Card className="bg-gradient-to-br from-slate-50 via-white to-slate-50 border border-dashed border-slate-200 h-full hover:border-indigo-300 transition-all duration-300 group">
        <CardContent className="p-4 flex flex-col items-center justify-center h-full">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 mb-3 flex items-center justify-center group-hover:from-indigo-100 group-hover:to-purple-100 transition-all duration-300">
            <Bell className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
          </div>
          <p className="text-xs font-medium text-slate-400 text-center group-hover:text-indigo-400 transition-colors">Sin alerta asignada</p>
          <p className="text-[10px] text-slate-300 mt-1">Destaca una alerta</p>
        </CardContent>
      </Card>
    );
  }

  const Icon = alertIcons[alert.type] || AlertTriangle;
  const config = severityConfig[alert.severity] || severityConfig.medium;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-full"
    >
      <Card className={`${config.bg} ${config.border} border h-full hover:shadow-lg transition-all duration-300`}>
        <CardContent className="p-4 flex flex-col h-full min-h-[140px]">
          {/* Semáforo */}
          <div className="flex items-center gap-3 mb-3">
            <motion.div 
              className={`w-10 h-10 rounded-full ${config.light} ${config.glow} shadow-lg flex items-center justify-center`}
              animate={{ 
                boxShadow: [
                  `0 0 10px 2px ${config.light === 'bg-red-500' ? 'rgba(239,68,68,0.4)' : config.light === 'bg-orange-500' ? 'rgba(249,115,22,0.4)' : config.light === 'bg-amber-400' ? 'rgba(251,191,36,0.4)' : 'rgba(59,130,246,0.4)'}`,
                  `0 0 20px 4px ${config.light === 'bg-red-500' ? 'rgba(239,68,68,0.6)' : config.light === 'bg-orange-500' ? 'rgba(249,115,22,0.6)' : config.light === 'bg-amber-400' ? 'rgba(251,191,36,0.6)' : 'rgba(59,130,246,0.6)'}`,
                  `0 0 10px 2px ${config.light === 'bg-red-500' ? 'rgba(239,68,68,0.4)' : config.light === 'bg-orange-500' ? 'rgba(249,115,22,0.4)' : config.light === 'bg-amber-400' ? 'rgba(251,191,36,0.4)' : 'rgba(59,130,246,0.4)'}`
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Icon className="w-5 h-5 text-white" />
            </motion.div>
            <span className={`text-xs font-bold uppercase ${config.text}`}>{config.label}</span>
          </div>

          {/* Título */}
          <h4 className={`font-semibold text-sm ${config.text} line-clamp-2 flex-1`}>
            {alert.title}
          </h4>

          {/* Fecha */}
          <p className="text-xs text-gray-500 mt-2">
            {format(new Date(alert.created_date), "d MMM", { locale: es })}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}