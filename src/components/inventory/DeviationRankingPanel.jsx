import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '@/components/utils/currencyHelper';
import { ArrowUp } from 'lucide-react';

export default function DeviationRankingPanel({ samples = [], supplyItems = [], currency = 'USD' }) {
  const ranking = useMemo(() => {
    const ingredientMap = {};

    samples.forEach(sample => {
      (sample.ingredients || []).forEach(ing => {
        const key = ing.supply_name;
        if (!ingredientMap[key]) {
          ingredientMap[key] = {
            name: key,
            unit: ing.unit || '',
            deviations: [],
            totalExtraQty: 0,
            sampleCount: 0
          };
        }
        const dev = ing.deviation_percent || 0;
        ingredientMap[key].deviations.push(dev);
        ingredientMap[key].sampleCount++;
        
        const extraQty = (ing.actual_quantity || 0) - (ing.expected_quantity || 0);
        if (extraQty > 0) {
          ingredientMap[key].totalExtraQty += extraQty;
        }
      });
    });

    return Object.values(ingredientMap)
      .map(ing => {
        const avgDev = ing.deviations.reduce((s, d) => s + d, 0) / ing.deviations.length;
        const supply = supplyItems.find(s => s.name === ing.name);
        const unitCost = supply?.average_unit_cost || 0;
        const extraCost = ing.totalExtraQty * unitCost;

        return {
          ...ing,
          avgDeviation: Math.round(avgDev * 10) / 10,
          extraCost,
          unitCost
        };
      })
      .filter(ing => ing.avgDeviation > 5) // solo los que están por encima de 5%
      .sort((a, b) => b.avgDeviation - a.avgDeviation)
      .slice(0, 10);
  }, [samples, supplyItems]);

  if (ranking.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-100">
        <CardContent className="p-6 text-center">
          <p className="text-gray-500 text-sm">No hay ingredientes con desviación significativa (&gt;5%) en este período</p>
        </CardContent>
      </Card>
    );
  }

  const maxDev = ranking[0]?.avgDeviation || 1;

  return (
    <Card className="bg-white border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">🏆 Top 10 — Mayor Desviación</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ingredientes con más sobre-porcionamiento promedio</p>
          </div>
          <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">{ranking.length} ingredientes</Badge>
        </div>

        <div className="space-y-2">
          {ranking.map((item, idx) => {
            const barWidth = Math.max(5, (item.avgDeviation / maxDev) * 100);
            const isTop3 = idx < 3;
            const isCritical = item.avgDeviation > 15;
            return (
              <div key={item.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isCritical ? 'bg-red-50/60' : isTop3 ? 'bg-amber-50/60' : 'hover:bg-gray-50'
              }`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 ${
                  idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-amber-500' : 'bg-gray-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold text-gray-800 truncate ${isTop3 ? 'font-bold' : ''}`}>{item.name}</span>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      {item.extraCost > 0 && (
                        <span className="text-xs text-gray-500">{formatCurrency(item.extraCost, currency)}</span>
                      )}
                      <span className={`text-sm font-black tabular-nums flex items-center ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                        <ArrowUp className="w-3 h-3 mr-0.5" />
                        {item.avgDeviation.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-400' : idx < 3 ? 'bg-amber-400' : 'bg-gray-300'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{item.sampleCount} muestreo{item.sampleCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}