import React from 'react';
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function ComparisonCard({ 
  title,
  currentValue,
  previousValue,
  previousLabel = "Mes anterior",
  format = "currency",
  currency = "USD"
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
    return val;
  };

  const change = previousValue && previousValue !== 0 
    ? ((currentValue - previousValue) / previousValue) * 100 
    : null;

  const getTrendIcon = () => {
    if (change === null) return null;
    if (change > 0) return <TrendingUp className="w-4 h-4" />;
    if (change < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (change === null) return "text-gray-500";
    if (change > 0) return "text-emerald-600 bg-emerald-50";
    if (change < 0) return "text-red-500 bg-red-50";
    return "text-gray-500 bg-gray-50";
  };

  return (
    <Card className="bg-white border-0 shadow-sm p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">{formatValue(currentValue)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {previousLabel}: {formatValue(previousValue)}
          </p>
        </div>
        {change !== null && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </Card>
  );
}