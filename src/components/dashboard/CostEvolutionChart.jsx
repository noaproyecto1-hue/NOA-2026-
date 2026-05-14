import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { BarChart3 } from 'lucide-react';

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (active && payload && payload.length) {
    const formatValue = (val) => {
      return new Intl.NumberFormat('es-ES', { 
        style: 'currency', 
        currency: currency || 'USD',
        minimumFractionDigits: 0 
      }).format(val);
    };

    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
        <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <div key={index}>
            <p className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatValue(entry.value)}
            </p>
            {entry.payload.percent && (
              <p className="text-xs text-gray-500">
                {entry.payload.percent.toFixed(1)}% de ventas
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function CostEvolutionChart({ 
  data = [],
  currency = "USD"
}) {
  const colors = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'];

  const formatYAxis = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value;
  };

  return (
    <Card className="bg-white border-0 shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
          <BarChart3 className="w-4 h-4 text-orange-500" />
          Evolución de Costos de Venta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={formatYAxis}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Bar 
                dataKey="value" 
                name="Costo"
                radius={[4, 4, 0, 0]}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}