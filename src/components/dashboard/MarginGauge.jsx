import React from 'react';
import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function MarginGauge({ 
  title,
  value,
  color = "#7c3aed",
  bgColor = "#e9d5ff",
  invertColor = false, // Para métricas donde menor es mejor (ej: % costo)
  tooltip = "", // Explicación de la métrica
  thresholds = null // Umbrales personalizados del restaurante {excellent, good, warning}
}) {
  // Permitir valores negativos en el display pero limitar la gráfica
  const displayValue = value || 0;
  const chartPercentage = Math.min(Math.max(Math.abs(displayValue), 0), 100);
  const isNegative = displayValue < 0;
  
  const data = [
    { value: chartPercentage },
    { value: 100 - chartPercentage }
  ];

  // Determinar el estado según el tipo de métrica y umbrales configurados
  const getStatus = () => {
    if (invertColor) {
      // Para costos: menor es mejor
      const excellent = thresholds?.excellent || 25;
      const good = thresholds?.good || 30;
      const warning = thresholds?.warning || 35;
      
      if (chartPercentage <= excellent) return 'Excelente';
      if (chartPercentage <= good) return 'Bueno';
      if (chartPercentage <= warning) return 'Aceptable';
      return 'Alto';
    } else {
      // Para márgenes: mayor es mejor, negativo es malo
      if (isNegative) return 'Pérdida';
      
      const excellent = thresholds?.excellent || 20;
      const good = thresholds?.good || 15;
      const warning = thresholds?.warning || 10;
      
      if (chartPercentage >= excellent) return 'Excelente';
      if (chartPercentage >= good) return 'Bueno';
      if (chartPercentage >= warning) return 'Aceptable';
      return 'Bajo';
    }
  };

  // Color del texto según el valor
  const displayColor = isNegative ? "#ef4444" : color;

  return (
    <Card className="bg-gradient-to-br from-white to-gray-50/50 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 p-6 h-full rounded-2xl overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex flex-col items-center text-center gap-4 relative">
        <div className="w-32 h-32 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                startAngle={90}
                endAngle={-270}
                innerRadius={45}
                outerRadius={60}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill={displayColor} />
                <Cell fill={bgColor} opacity={0.3} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-2xl font-bold" style={{ color: displayColor }}>
                {isNegative ? '-' : ''}{chartPercentage.toFixed(1)}
              </span>
              <span className="text-lg font-bold text-gray-400">%</span>
            </div>
          </div>
          {/* Animated ring */}
          <div 
            className="absolute inset-0 rounded-full border-2 opacity-20 group-hover:scale-110 transition-transform duration-500"
            style={{ borderColor: displayColor }}
          />
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm bg-gray-900 text-white border-0 shadow-xl">
                    <p>{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-sm ${
            isNegative 
              ? 'bg-red-100 text-red-700' 
              : invertColor 
                ? chartPercentage <= (thresholds?.excellent || 25) ? 'bg-emerald-100 text-emerald-700' : chartPercentage <= (thresholds?.good || 30) ? 'bg-blue-100 text-blue-700' : chartPercentage <= (thresholds?.warning || 35) ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                : chartPercentage >= (thresholds?.excellent || 20) ? 'bg-emerald-100 text-emerald-700' : chartPercentage >= (thresholds?.good || 15) ? 'bg-blue-100 text-blue-700' : chartPercentage >= (thresholds?.warning || 10) ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>
            {getStatus()}
          </div>
        </div>
      </div>
    </Card>
  );
}