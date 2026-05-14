import React from 'react';
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

export default function MetricCard({ 
  title, 
  value, 
  previousValue,
  format = "currency",
  currency = "USD",
  icon: Icon,
  iconColor = "text-blue-600",
  iconBg = "bg-blue-50",
  subtitle,
  isProjection = false
}) {
  const formatValue = (val) => {
    if (val === null || val === undefined) return "—";
    if (format === "currency") {
      return new Intl.NumberFormat('es-ES', { 
        style: 'currency', 
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(val);
    }
    if (format === "percentage") {
      return `${val.toFixed(1)}%`;
    }
    if (format === "number") {
      return new Intl.NumberFormat('es-ES').format(val);
    }
    return val;
  };

  const calculateChange = () => {
    if (!previousValue || previousValue === 0) return null;
    return ((value - previousValue) / previousValue) * 100;
  };

  const change = calculateChange();

  const getTrendIcon = () => {
    if (change === null) return null;
    if (change > 0) return <TrendingUp className="w-4 h-4" />;
    if (change < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (change === null) return "text-gray-500";
    if (change > 0) return "text-emerald-600";
    if (change < 0) return "text-red-500";
    return "text-gray-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`p-5 bg-white border-0 shadow-sm hover:shadow-md transition-shadow duration-300 ${isProjection ? 'border-l-4 border-l-amber-400' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                {title}
              </p>
              {isProjection && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Proyección
                </span>
              )}
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2">
              {formatValue(value)}
            </h3>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
            {change !== null && (
              <div className={`flex items-center gap-1 mt-2 ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="text-sm font-medium">
                  {change > 0 ? '+' : ''}{change.toFixed(1)}% vs mes anterior
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={`p-3 rounded-xl ${iconBg}`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}