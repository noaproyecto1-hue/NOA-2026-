import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PieChart as PieIcon } from "lucide-react";

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#47587A', 
  '#47587A', '#06b6d4', '#84cc16', '#f97316', '#47587A'
];

const opexLabels = {
  rent: "Alquiler",
  utilities: "Servicios",
  payroll: "Nómina",
  insurance: "Seguros",
  maintenance: "Mantenimiento",
  marketing: "Marketing",
  licenses: "Licencias",
  technology: "Tecnología",
  other: "Otros"
};

const CustomTooltip = ({ active, payload, currency }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
        <p className="text-sm font-medium text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600 mt-1">
          {new Intl.NumberFormat('es-ES', { 
            style: 'currency', 
            currency: currency || 'USD',
            minimumFractionDigits: 0
          }).format(data.value)}
        </p>
        <p className="text-xs text-gray-400 mt-1">{data.percentage.toFixed(1)}% del total</p>
      </div>
    );
  }
  return null;
};

export default function ExpenseBreakdown({ 
  data = [], 
  title = "Desglose de Gastos",
  currency = "USD"
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  const chartData = data.map(item => ({
    ...item,
    name: opexLabels[item.type] || item.name || item.type,
    percentage: (item.value / total) * 100
  }));

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-amber-50/50 border-b border-orange-100/50">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-gray-900">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center shadow-lg">
            <PieIcon className="w-4 h-4 text-white" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[300px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    stroke="white"
                    strokeWidth={3}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip currency={currency} />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center Label */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <p className="text-xs text-gray-500 font-medium mb-1">Total OpEx</p>
            <p className="text-lg font-bold text-gray-900">
              {total >= 1000000 
                ? `${(total / 1000000).toFixed(1)}M`
                : total >= 1000 
                  ? `${Math.round(total / 1000)}K`
                  : Math.round(total).toLocaleString('es-ES')
              }
            </p>
          </div>
        </div>
        
        {/* Legend Custom */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {chartData.slice(0, 6).map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-gray-700 truncate flex-1">{entry.name}</span>
              <span className="font-semibold text-gray-900">{entry.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}