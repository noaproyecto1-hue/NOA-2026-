import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Trophy, TrendingUp, Coins, Loader2, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { formatCurrency } from '@/components/utils/currencyHelper';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { startOfYear, endOfDay, format } from 'date-fns';

export default function WaiterPerformanceTab({ restaurantIds, currency }) {
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({
    from: startOfYear(new Date()),
    to: endOfDay(new Date())
  });
  const [expandedWaiter, setExpandedWaiter] = useState(null);

  const dateFrom = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null;
  const dateTo = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null;

  // Fetch sales directly from entity — filtered by restaurant and date range
  const { data: allSales, isLoading } = useQuery({
    queryKey: ['employeeSales', restaurantIds, dateFrom, dateTo],
    queryFn: async () => {
      const sales = [];
      for (const rid of restaurantIds) {
        const filter = { restaurant_id: rid, is_cancelled: false };
        if (dateFrom || dateTo) {
          filter.date_time = {};
          if (dateFrom) filter.date_time['$gte'] = dateFrom + 'T00:00:00';
          if (dateTo) filter.date_time['$lte'] = dateTo + 'T23:59:59';
        }
        const batch = await base44.entities.Sale.filter(filter, '-date_time', 2000);
        sales.push(...batch);
      }
      return sales;
    },
    enabled: restaurantIds?.length > 0,
    staleTime: 3 * 60 * 1000,
  });

  // Calculate performance in frontend — fast with pre-filtered data
  const { ranking, totalAllSales } = useMemo(() => {
    if (!allSales?.length) return { ranking: [], totalAllSales: 0 };

    const byWaiter = {};
    let totalAll = 0;

    for (const sale of allSales) {
      const waiter = sale.waiter_name?.trim();
      if (!waiter || waiter === 'Sin asignar') continue;

      const key = waiter.toLowerCase();
      const amt = sale.total_amount || 0;
      const tip = sale.tip_amount || 0;
      const guests = sale.num_guests || 0;
      totalAll += amt;

      if (!byWaiter[key]) {
        byWaiter[key] = { name: waiter, sales: 0, tips: 0, transactions: 0, guests: 0, months: {} };
      }
      const w = byWaiter[key];
      w.sales += amt;
      w.tips += tip;
      w.transactions += 1;
      w.guests += guests;

      const dt = sale.date_time || sale.created_date;
      if (dt) {
        const mk = dt.substring(0, 7);
        if (!w.months[mk]) w.months[mk] = { month: mk, sales: 0, tips: 0, transactions: 0, guests: 0 };
        const m = w.months[mk];
        m.sales += amt;
        m.tips += tip;
        m.transactions += 1;
        m.guests += guests;
      }
    }

    const list = Object.values(byWaiter).map(w => ({
      name: w.name,
      sales: w.sales,
      tips: w.tips,
      transactions: w.transactions,
      guests: w.guests,
      avgTicket: w.transactions > 0 ? Math.round(w.sales / w.transactions) : 0,
      tipPct: w.sales > 0 ? Math.round((w.tips / w.sales) * 1000) / 10 : 0,
      monthly: Object.values(w.months)
        .map(m => ({ ...m, avgTicket: m.transactions > 0 ? Math.round(m.sales / m.transactions) : 0 }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    })).sort((a, b) => b.sales - a.sales);

    return { ranking: list, totalAllSales: totalAll };
  }, [allSales]);

  const filtered = ranking.filter(w =>
    !search || w.name.toLowerCase().includes(search.toLowerCase())
  );

  const topSeller = ranking[0];
  const topTipper = [...ranking].sort((a, b) => b.tips - a.tips)[0];
  const topTicket = [...ranking].sort((a, b) => b.avgTicket - a.avgTicket)[0];

  const monthLabels = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic'
  };

  const formatMonth = (m) => {
    const [year, month] = m.split('-');
    return `${monthLabels[month] || month} ${year}`;
  };

  return (
    <div className="space-y-4">
      {/* Date Range Picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>Período histórico de rendimiento</span>
        </div>
        <DateRangePicker
          dateRange={dateRange}
          onChange={setDateRange}
          className="bg-white rounded-xl text-sm shadow-sm border"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-gray-500">Calculando rendimiento...</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Podium */}
          {ranking.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topSeller && (
                <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-amber-600">Más Ventas</span>
                    </div>
                    <p className="font-bold text-gray-900">{topSeller.name}</p>
                    <p className="text-lg font-black text-amber-600">{formatCurrency(topSeller.sales, currency)}</p>
                  </CardContent>
                </Card>
              )}
              {topTipper && (
                <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Coins className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-600">Más Propinas</span>
                    </div>
                    <p className="font-bold text-gray-900">{topTipper.name}</p>
                    <p className="text-lg font-black text-emerald-600">{formatCurrency(topTipper.tips, currency)}</p>
                  </CardContent>
                </Card>
              )}
              {topTicket && (
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-bold text-blue-600">Mejor Ticket Promedio</span>
                    </div>
                    <p className="font-bold text-gray-900">{topTicket.name}</p>
                    <p className="text-lg font-black text-blue-600">{formatCurrency(topTicket.avgTicket, currency)}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-lg">Rendimiento por Garzón / Mesero</CardTitle>
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 bg-gray-50"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Garzón</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Transacciones</TableHead>
                    <TableHead className="text-right">Ticket Prom.</TableHead>
                    <TableHead className="text-right">Propinas</TableHead>
                    <TableHead className="text-right">% Propina/Venta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((w, idx) => (
                    <React.Fragment key={w.name}>
                      <TableRow
                        className="hover:bg-gray-50/50 cursor-pointer"
                        onClick={() => setExpandedWaiter(expandedWaiter === w.name ? null : w.name)}
                      >
                        <TableCell>
                          {idx < 3 ? (
                            <span className="text-lg">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">{idx + 1}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {expandedWaiter === w.name ?
                              <ChevronDown className="w-4 h-4 text-gray-400" /> :
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            }
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                              {w.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{w.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(w.sales, currency)}</TableCell>
                        <TableCell className="text-right">{w.transactions}</TableCell>
                        <TableCell className="text-right">{formatCurrency(w.avgTicket, currency)}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">{formatCurrency(w.tips, currency)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className={`${w.tipPct >= 10 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'}`}>
                            {w.tipPct.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {/* Monthly breakdown */}
                      {expandedWaiter === w.name && w.monthly?.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-slate-50/80 p-0">
                            <div className="px-6 py-3">
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Desglose mensual — {w.name}</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-gray-500 border-b">
                                      <th className="text-left py-1.5 pr-4">Mes</th>
                                      <th className="text-right py-1.5 px-2">Ventas</th>
                                      <th className="text-right py-1.5 px-2">Txns</th>
                                      <th className="text-right py-1.5 px-2">Ticket Prom.</th>
                                      <th className="text-right py-1.5 px-2">Propinas</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {w.monthly.map(m => (
                                      <tr key={m.month} className="border-b border-gray-100 last:border-0">
                                        <td className="py-1.5 pr-4 font-medium text-gray-700">{formatMonth(m.month)}</td>
                                        <td className="text-right py-1.5 px-2">{formatCurrency(m.sales, currency)}</td>
                                        <td className="text-right py-1.5 px-2 text-gray-500">{m.transactions}</td>
                                        <td className="text-right py-1.5 px-2">{formatCurrency(m.avgTicket, currency)}</td>
                                        <td className="text-right py-1.5 px-2 text-emerald-600">{formatCurrency(m.tips, currency)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        No hay datos de garzones en el período seleccionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}