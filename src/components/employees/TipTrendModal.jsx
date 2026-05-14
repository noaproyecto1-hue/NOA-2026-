import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, parseISO, startOfDay, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TipTrendModal({ open, onOpenChange, filteredSales, dateRange, currency }) {
  const chartData = useMemo(() => {
    if (!filteredSales.length) return [];

    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const dailyMap = {};

    days.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      dailyMap[key] = { date: key, tips: 0, sales: 0, pct: 0 };
    });

    filteredSales.forEach(sale => {
      const key = format(new Date(sale.date_time || sale.date), 'yyyy-MM-dd');
      if (dailyMap[key]) {
        dailyMap[key].tips += sale.tip_amount || 0;
        dailyMap[key].sales += sale.total_amount || 0;
      }
    });

    return Object.values(dailyMap).map(d => ({
      ...d,
      pct: d.sales > 0 ? parseFloat(((d.tips / d.sales) * 100).toFixed(2)) : 0,
      label: format(new Date(d.date), 'dd MMM', { locale: es })
    }));
  }, [filteredSales, dateRange]);

  const avgPct = useMemo(() => {
    const valid = chartData.filter(d => d.sales > 0);
    if (!valid.length) return 0;
    return (valid.reduce((s, d) => s + d.pct, 0) / valid.length).toFixed(1);
  }, [chartData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Tendencia: % Propina sobre Venta
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-blue-50 rounded-xl text-center">
          <p className="text-sm text-blue-600">Promedio del período</p>
          <p className="text-3xl font-black text-blue-700">{avgPct}%</p>
          <p className="text-xs text-blue-500 mt-1">
            Este porcentaje indica cuánto representan las propinas respecto al total de ventas netas
          </p>
        </div>

        <div className="h-72">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="tipGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip
                  formatter={(value) => [`${value}%`, '% Propina/Venta']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="pct" stroke="#3b82f6" strokeWidth={2.5} fill="url(#tipGrad)" dot={false} activeDot={{ r: 5, fill: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No hay datos para graficar
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}