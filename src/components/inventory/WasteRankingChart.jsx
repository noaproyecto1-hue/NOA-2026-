import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '@/components/utils/currencyHelper';

export default function WasteRankingChart({ wasteRecords = [], currency = 'USD', filterMonth = 'current', selectedRestaurant = 'all' }) {
  const now = new Date();
  let from = '2020-01-01', to = now.toISOString().slice(0, 10);
  if (filterMonth === 'current') {
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  } else if (filterMonth === 'last') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  }

  const filtered = wasteRecords.filter(w => {
    if (selectedRestaurant !== 'all' && w.restaurant_id !== selectedRestaurant) return false;
    if (w.date < from || w.date > to) return false;
    if (w.notes?.includes('Pérdida externa')) return false;
    return true;
  });

  const byItem = {};
  filtered.forEach(w => {
    const name = w.supply_name || 'Sin nombre';
    if (!byItem[name]) byItem[name] = { name, value: 0, qty: 0, count: 0, unit: w.unit || '' };
    byItem[name].value += w.estimated_value || 0;
    byItem[name].qty += w.quantity || 0;
    byItem[name].count++;
    if (!byItem[name].unit && w.unit) byItem[name].unit = w.unit;
  });

  const ranking = Object.values(byItem)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (ranking.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-100">
        <CardContent className="p-6 text-center">
          <p className="text-gray-500 text-sm">No hay datos de merma para el ranking en este período</p>
        </CardContent>
      </Card>
    );
  }

  const maxValue = ranking[0]?.value || 1;

  return (
    <Card className="bg-white border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">🏆 Top 10 — Mayor Merma</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ranking por valor monetario de merma registrada</p>
          </div>
          <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">{ranking.length} insumos</Badge>
        </div>

        <div className="space-y-2">
          {ranking.map((item, idx) => {
            const barWidth = Math.max(5, (item.value / maxValue) * 100);
            const isTop3 = idx < 3;
            return (
              <div key={item.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isTop3 ? 'bg-red-50/60' : 'hover:bg-gray-50'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 ${
                  idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-amber-500' : 'bg-gray-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold text-gray-800 truncate ${isTop3 ? 'font-bold' : ''}`}>{item.name}</span>
                    <span className={`text-sm font-black tabular-nums ml-2 shrink-0 ${isTop3 ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatCurrency(item.value, currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${idx === 0 ? 'bg-red-400' : idx === 1 ? 'bg-orange-400' : idx === 2 ? 'bg-amber-400' : 'bg-gray-300'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{item.qty} {item.unit || 'uds'} · {item.count}x</span>
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