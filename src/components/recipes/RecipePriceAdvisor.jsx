import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, Lightbulb, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../utils/currencyHelper';

/**
 * Panel dinámico que muestra precio sugerido y feedback del margen en tiempo real.
 * Se actualiza cada vez que cambian ingredientes, sub-recetas o precio de venta.
 */
export default function RecipePriceAdvisor({ cost, salePrice, servings, currency, targetFoodCostPercent }) {
  const analysis = useMemo(() => {
    const price = parseFloat(salePrice) || 0;
    const portions = parseInt(servings) || 1;
    const costPerPortion = cost / portions;
    
    // Food cost objetivo del restaurante (default 30%)
    const targetFC = targetFoodCostPercent || 30;
    
    // Precio sugerido = costo / (target_food_cost / 100)
    const suggestedPrice = costPerPortion > 0 ? Math.ceil(costPerPortion / (targetFC / 100)) : 0;
    
    // Margen actual
    const currentMargin = price > 0 ? ((price - costPerPortion) / price) * 100 : 0;
    const currentFoodCost = price > 0 ? (costPerPortion / price) * 100 : 0;
    
    // Determinar estado
    let status = 'neutral'; // neutral, excellent, good, warning, danger
    let message = '';
    let icon = 'neutral';
    
    if (cost === 0) {
      status = 'neutral';
      message = 'Agrega ingredientes para ver el análisis de precio';
    } else if (price === 0) {
      status = 'info';
      message = `Precio sugerido: ${formatCurrency(suggestedPrice, currency)} para un food cost de ${targetFC}%`;
    } else if (currentFoodCost <= targetFC * 0.8) {
      // Food cost muy bajo = excelente margen
      status = 'excellent';
      message = `¡Excelente margen! Tu food cost es ${currentFoodCost.toFixed(1)}%, muy por debajo del objetivo de ${targetFC}%`;
    } else if (currentFoodCost <= targetFC) {
      // Dentro del objetivo
      status = 'good';
      message = `Buen precio. Tu food cost de ${currentFoodCost.toFixed(1)}% está dentro del objetivo de ${targetFC}%`;
    } else if (currentFoodCost <= targetFC * 1.15) {
      // Ligeramente por encima
      status = 'warning';
      message = `Food cost de ${currentFoodCost.toFixed(1)}% algo alto. Considera subir a ${formatCurrency(suggestedPrice, currency)}`;
    } else {
      // Muy por encima
      status = 'danger';
      message = `Food cost de ${currentFoodCost.toFixed(1)}% — muy alto. Precio mínimo recomendado: ${formatCurrency(suggestedPrice, currency)}`;
    }
    
    return { costPerPortion, suggestedPrice, currentMargin, currentFoodCost, status, message, targetFC };
  }, [cost, salePrice, servings, currency, targetFoodCostPercent]);

  if (cost === 0) return null;

  const statusStyles = {
    neutral: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', accent: 'text-gray-700' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'text-blue-800' },
    excellent: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'text-emerald-800' },
    good: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', accent: 'text-green-800' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'text-amber-800' },
    danger: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', accent: 'text-red-800' },
  };

  const style = statusStyles[analysis.status];
  const price = parseFloat(salePrice) || 0;

  const StatusIcon = () => {
    switch (analysis.status) {
      case 'excellent': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'good': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'danger': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'info': return <Lightbulb className="w-4 h-4 text-blue-600" />;
      default: return <Target className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-4 space-y-3 transition-all duration-300`}>
      {/* Header con mensaje principal */}
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5"><StatusIcon /></div>
        <p className={`text-sm font-medium ${style.accent} leading-snug`}>
          {analysis.message}
        </p>
      </div>

      {/* Métricas en fila */}
      <div className="grid grid-cols-3 gap-3">
        {/* Costo por porción */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Costo/porción</p>
          <p className={`text-base font-bold ${style.accent}`}>
            {formatCurrency(analysis.costPerPortion, currency)}
          </p>
        </div>

        {/* Precio sugerido */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            Precio sugerido
          </p>
          <p className={`text-base font-bold ${price > 0 && Math.abs(price - analysis.suggestedPrice) < price * 0.05 ? 'text-green-700' : 'text-blue-700'}`}>
            {formatCurrency(analysis.suggestedPrice, currency)}
          </p>
        </div>

        {/* Food Cost actual */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Food Cost</p>
          {price > 0 ? (
            <p className={`text-base font-bold ${
              analysis.currentFoodCost <= analysis.targetFC ? 'text-green-700' : 
              analysis.currentFoodCost <= analysis.targetFC * 1.15 ? 'text-amber-700' : 'text-red-700'
            }`}>
              {analysis.currentFoodCost.toFixed(1)}%
            </p>
          ) : (
            <p className="text-base font-bold text-gray-400">—</p>
          )}
        </div>
      </div>

      {/* Barra de margen visual */}
      {price > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>Margen: {analysis.currentMargin.toFixed(1)}%</span>
            <span>Objetivo FC: {analysis.targetFC}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                analysis.currentFoodCost <= analysis.targetFC ? 'bg-green-500' :
                analysis.currentFoodCost <= analysis.targetFC * 1.15 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, 100 - analysis.currentFoodCost))}%` }}
            />
          </div>
        </div>
      )}

      {/* Sugerencia de precio si hay diferencia significativa */}
      {price > 0 && analysis.suggestedPrice > price * 1.05 && (
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 text-xs font-medium text-blue-700 bg-blue-100/60 hover:bg-blue-100 rounded-lg py-1.5 transition-colors"
          onClick={() => {
            // Disparar evento personalizado para actualizar el precio
            const event = new CustomEvent('recipe-set-suggested-price', { detail: { price: analysis.suggestedPrice } });
            window.dispatchEvent(event);
          }}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Usar precio sugerido: {formatCurrency(analysis.suggestedPrice, currency)}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}