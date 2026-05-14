import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ThumbsUp, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function NPSGauge({ 
  score, 
  previousScore,
  totalResponses = 0 
}) {
  const getScoreColor = (s) => {
    if (s >= 50) return "text-emerald-500";
    if (s >= 0) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreLabel = (s) => {
    if (s >= 50) return "Excelente";
    if (s >= 30) return "Bueno";
    if (s >= 0) return "Aceptable";
    return "Necesita mejora";
  };

  const getScoreBg = (s) => {
    if (s >= 50) return "bg-emerald-50";
    if (s >= 0) return "bg-amber-50";
    return "bg-red-50";
  };

  const change = previousScore !== undefined && previousScore !== null 
    ? score - previousScore 
    : null;

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <ThumbsUp className="w-5 h-5 text-blue-500" />
          NPS Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center py-4">
          <div className={`w-32 h-32 rounded-full ${getScoreBg(score)} flex items-center justify-center mb-4`}>
            <div className="text-center">
              <span className={`text-4xl font-bold ${getScoreColor(score)}`}>
                {score !== null && score !== undefined ? score.toFixed(0) : '—'}
              </span>
            </div>
          </div>
          
          <span className={`text-sm font-medium ${getScoreColor(score)} mb-2`}>
            {score !== null ? getScoreLabel(score) : 'Sin datos'}
          </span>

          {change !== null && (
            <div className={`flex items-center gap-1 ${
              change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-500' : 'text-gray-500'
            }`}>
              {change > 0 ? <TrendingUp className="w-4 h-4" /> : 
               change < 0 ? <TrendingDown className="w-4 h-4" /> : 
               <Minus className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {change > 0 ? '+' : ''}{change.toFixed(0)} pts vs mes anterior
              </span>
            </div>
          )}

          <p className="text-sm text-gray-400 mt-3">
            {totalResponses} respuestas
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex justify-between text-xs text-gray-500">
            <div className="text-center flex-1">
              <div className="w-full h-2 bg-red-200 rounded-l-full" />
              <span className="mt-1 block">Detractores</span>
              <span className="text-gray-400">(0-6)</span>
            </div>
            <div className="text-center flex-1">
              <div className="w-full h-2 bg-amber-200" />
              <span className="mt-1 block">Pasivos</span>
              <span className="text-gray-400">(7-8)</span>
            </div>
            <div className="text-center flex-1">
              <div className="w-full h-2 bg-emerald-200 rounded-r-full" />
              <span className="mt-1 block">Promotores</span>
              <span className="text-gray-400">(9-10)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}