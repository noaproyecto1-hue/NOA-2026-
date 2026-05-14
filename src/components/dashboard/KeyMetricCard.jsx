import React from 'react';
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, Wallet, Sparkles } from 'lucide-react';

const iconMap = {
  'Ventas Netas': DollarSign,
  'Gastos Operativos': Sparkles,
  'Costo de Ventas': TrendingUp,
  'Flujo Caja Proyectado': Wallet,
};

const gradientMap = {
  'bg-white': 'from-slate-50 to-white',
  'bg-emerald-600': 'from-emerald-500 to-green-600',
  'bg-amber-500': 'from-amber-500 to-orange-500',
  'bg-cyan-600': 'from-cyan-500 to-blue-600',
};

export default function KeyMetricCard({ 
  title, 
  value, 
  color = "bg-purple-700",
  textColor = "text-white",
  currency = "USD"
}) {
  const formatValue = (val) => {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const Icon = iconMap[title] || DollarSign;
  const gradient = gradientMap[color] || 'from-purple-600 to-indigo-600';
  const isWhite = color === 'bg-white';

  return (
    <Card className={`bg-gradient-to-br ${gradient} ${textColor} p-5 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl relative overflow-hidden group`}>
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isWhite ? 'bg-gray-100' : 'bg-white/20'}`}>
            <Icon className={`w-5 h-5 ${isWhite ? 'text-gray-700' : 'text-white'}`} />
          </div>
        </div>
        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isWhite ? 'text-gray-500' : 'text-white/80'}`}>{title}</p>
        <p className={`text-2xl font-bold ${isWhite ? 'text-gray-900' : 'text-white'}`}>{formatValue(value)}</p>
      </div>
    </Card>
  );
}