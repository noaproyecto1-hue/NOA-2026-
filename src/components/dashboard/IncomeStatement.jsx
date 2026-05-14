import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Briefcase, Wallet } from "lucide-react";
import { motion } from "framer-motion";

export default function IncomeStatement({ 
  totalSales = 0,
  supplyCost = 0,
  opex = 0,
  currency = "USD"
}) {
  const formatCurrency = (value) => {
    const absValue = Math.abs(value);
    let formatted;
    
    if (absValue >= 1000000) {
      formatted = (absValue / 1000000).toFixed(1) + 'M';
    } else if (absValue >= 1000) {
      formatted = (absValue / 1000).toFixed(1) + 'K';
    } else {
      formatted = absValue.toLocaleString('es-ES');
    }
    
    const symbol = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : '$';
    return (value < 0 ? '-' : '') + symbol + formatted;
  };

  const formatPercent = (value, total) => {
    if (total === 0) return "0.0%";
    const percent = (value / total) * 100;
    return percent.toFixed(1) + "%";
  };

  const grossProfit = totalSales - supplyCost;
  const netProfit = grossProfit - opex;

  const items = [
    { 
      label: "Ventas Netas", 
      value: totalSales, 
      percent: "100%", 
      icon: DollarSign,
      bgGradient: "from-emerald-50 to-green-50",
      iconBg: "bg-emerald-500",
      valueColor: "text-emerald-700",
      isPositive: true
    },
    { 
      label: "Costo de Ventas", 
      value: -supplyCost, 
      percent: formatPercent(supplyCost, totalSales), 
      icon: ShoppingCart,
      bgGradient: "from-red-50 to-rose-50",
      iconBg: "bg-red-500",
      valueColor: "text-red-600",
      isPositive: false
    },
    { 
      label: "Utilidad Bruta", 
      value: grossProfit, 
      percent: formatPercent(grossProfit, totalSales), 
      icon: TrendingUp,
      bgGradient: grossProfit >= 0 ? "from-blue-50 to-indigo-50" : "from-red-50 to-rose-50",
      iconBg: grossProfit >= 0 ? "bg-blue-500" : "bg-red-500",
      valueColor: grossProfit >= 0 ? "text-blue-700" : "text-red-600",
      highlight: true,
      isPositive: grossProfit >= 0
    },
    { 
      label: "Gastos Operativos", 
      value: -opex, 
      percent: formatPercent(opex, totalSales), 
      icon: Briefcase,
      bgGradient: "from-amber-50 to-orange-50",
      iconBg: "bg-amber-500",
      valueColor: "text-amber-700",
      isPositive: false
    },
    { 
      label: "Utilidad Neta", 
      value: netProfit, 
      percent: formatPercent(netProfit, totalSales), 
      icon: Wallet,
      bgGradient: netProfit >= 0 ? "from-emerald-100 to-green-100" : "from-red-100 to-rose-100",
      iconBg: netProfit >= 0 ? "bg-gradient-to-br from-emerald-500 to-green-600" : "bg-gradient-to-br from-red-500 to-rose-600",
      valueColor: netProfit >= 0 ? "text-emerald-700" : "text-red-600",
      highlight: true,
      isPositive: netProfit >= 0,
      isFinal: true
    },
  ];

  return (
    <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl h-full overflow-hidden rounded-2xl">
      <CardHeader className="pb-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 rounded-t-2xl">
        <CardTitle className="text-lg font-bold flex items-center gap-3 text-white">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          Estado de Resultados
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`
                relative p-4 rounded-xl bg-gradient-to-r ${item.bgGradient}
                ${item.isFinal ? 'ring-2 ring-offset-2 shadow-lg' : ''}
                ${item.isFinal && item.isPositive ? 'ring-emerald-300' : ''}
                ${item.isFinal && !item.isPositive ? 'ring-red-300' : ''}
                transition-all duration-300 hover:shadow-md
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${item.iconBg} rounded-xl flex items-center justify-center shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={`font-semibold text-gray-800 ${item.isFinal ? 'text-lg' : 'text-base'}`}>
                      {item.label}
                    </p>
                    {item.highlight && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.label === "Utilidad Bruta" ? "Margen bruto" : "Resultado final"}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={`font-bold ${item.valueColor} ${item.isFinal ? 'text-2xl' : 'text-xl'} tracking-tight`}>
                    {formatCurrency(item.value)}
                  </p>
                  <p className={`text-sm font-medium ${item.isPositive ? 'text-gray-500' : 'text-gray-500'}`}>
                    {item.percent}
                  </p>
                </div>
              </div>
              
              {item.isFinal && (
                <div className="absolute top-2 right-2">
                  {item.isPositive ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}