import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Users, 
  Coins, 
  TrendingUp,
  UserCircle,
  Star,
  BarChart3,
  Info,
  ListFilter
} from "lucide-react";
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import SamplingStarsPanel from '@/components/employees/SamplingStarsPanel';
import TipTrendModal from '@/components/employees/TipTrendModal';

import WaiterPerformanceTab from '@/components/employees/WaiterPerformanceTab';
import EmployeeDirectoryTab from '@/components/employees/EmployeeDirectoryTab';
import EquipoTrabajo from '@/components/employees/EquipoTrabajo';
import EmployeeDetailModal from '@/components/employees/EmployeeDetailModal';
import PageHeader from '@/components/ui/PageHeader';
import { startOfYear, endOfDay, isWithinInterval } from 'date-fns';
import RestaurantSelector from '@/components/dashboard/RestaurantSelector';
import { getSelectedCurrency, formatCurrency } from '@/components/utils/currencyHelper';
import RestaurantPickerOnEntry from '@/components/dialogs/RestaurantPickerOnEntry';

export default function Empleados() {
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [tipDateRange, setTipDateRange] = useState({
    from: startOfYear(new Date()),
    to: endOfDay(new Date())
  });
  const [distributionMethod, setDistributionMethod] = useState("equal");
  const [tipTrendOpen, setTipTrendOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: restaurants = [] } = useQuery({
    queryKey: ['myRestaurants', user?.email, user?.restaurant_ids],
    queryFn: async () => {
      if (user?.restaurant_ids?.length > 0) {
        const allActive = await base44.entities.Restaurant.filter({ is_active: true });
        return allActive.filter(r => user.restaurant_ids.includes(r.id));
      }
      return base44.entities.Restaurant.filter({ is_active: true, created_by: user?.email });
    },
    enabled: !!user?.email
  });

  const accessibleRestaurants = restaurants;

  const accessibleRestaurantIds = useMemo(() => accessibleRestaurants.map(r => r.id), [accessibleRestaurants]);

  // Sales: solo para pestaña de propinas — filtrado por date range desde API
  const { data: sales = [] } = useQuery({
    queryKey: ['tipSales', selectedRestaurant, accessibleRestaurantIds, tipDateRange.from?.toISOString(), tipDateRange.to?.toISOString()],
    queryFn: async () => {
      const dateFilter = {
        '$gte': tipDateRange.from ? tipDateRange.from.toISOString() : undefined,
        '$lte': tipDateRange.to ? tipDateRange.to.toISOString() : undefined
      };
      if (selectedRestaurant !== "all") {
        return base44.entities.Sale.filter({ restaurant_id: selectedRestaurant, is_cancelled: false, date_time: dateFilter }, '-date_time', 5000);
      }
      if (accessibleRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        accessibleRestaurantIds.map(id => base44.entities.Sale.filter({ restaurant_id: id, is_cancelled: false, date_time: dateFilter }, '-date_time', 5000))
      );
      return results.flat();
    },
    enabled: accessibleRestaurantIds.length > 0 && !!tipDateRange.from && !!tipDateRange.to,
    staleTime: 2 * 60 * 1000
  });

  const employees = useMemo(() => {
    if (selectedRestaurant === "all") {
      const allEmployees = [];
      accessibleRestaurants.forEach(r => {
        (r.config?.employees || []).forEach(emp => {
          if (emp.is_active !== false) {
            allEmployees.push({ ...emp, restaurant_id: r.id, restaurant_name: r.name });
          }
        });
      });
      return allEmployees;
    } else {
      const restaurant = accessibleRestaurants.find(r => r.id === selectedRestaurant);
      return (restaurant?.config?.employees || [])
        .filter(emp => emp.is_active !== false)
        .map(emp => ({ ...emp, restaurant_id: selectedRestaurant, restaurant_name: restaurant?.name }));
    }
  }, [selectedRestaurant, accessibleRestaurants]);

  // Sales already filtered by date range and is_cancelled from API
  const tipFilteredSales = useMemo(() => sales, [sales]);

  const tipsData = useMemo(() => {
    // Agrupar propinas reales por empleado (desde ventas)
    const byWaiter = {};
    let totalTips = 0;
    let totalSales = 0;

    tipFilteredSales.forEach(sale => {
      const tip = sale.tip_amount || 0;
      const rawWaiter = sale.waiter_name?.trim() || '';
      totalTips += tip;
      totalSales += sale.total_amount || 0;

      if (!rawWaiter) return; // Ignorar ventas sin garzón asignado

      // Normalizar nombre (case-insensitive matching)
      const waiterKey = rawWaiter.toLowerCase();
      if (!byWaiter[waiterKey]) {
        byWaiter[waiterKey] = { name: rawWaiter, totalTips: 0, transactions: 0 };
      }
      byWaiter[waiterKey].totalTips += tip;
      byWaiter[waiterKey].transactions++;
    });

    const waiterList = Object.values(byWaiter);
    const assignedTransactions = waiterList.reduce((s, w) => s + w.transactions, 0);

    // Construir tabla unificada: cada empleado con propinas reales + propina asignada
    // TODAS las propinas se distribuyen (incluidas las de ventas sin garzón)
    const unifiedTable = employees.map(emp => {
      const empKey = emp.name?.toLowerCase().trim();
      // Match flexible: exacto, contenido parcial, o primer nombre
      const waiterData = waiterList.find(w => {
        const wKey = w.name.toLowerCase().trim();
        if (wKey === empKey) return true;
        if (wKey.includes(empKey) || empKey.includes(wKey)) return true;
        const empFirst = empKey.split(' ')[0];
        const wFirst = wKey.split(' ')[0];
        if (empFirst.length >= 3 && wFirst.length >= 3 && empFirst === wFirst) return true;
        return false;
      });

      const realTips = waiterData?.totalTips || 0;
      const transactions = waiterData?.transactions || 0;

      let assignedTip = 0;
      if (distributionMethod === "equal" && employees.length > 0) {
        assignedTip = totalTips / employees.length;
      } else if (distributionMethod === "by_transactions" && assignedTransactions > 0) {
        assignedTip = (transactions / assignedTransactions) * totalTips;
      }

      return {
        name: emp.name,
        transactions,
        realTips,
        percentOfRealTips: totalTips > 0 ? (realTips / totalTips) * 100 : 0,
        assignedTip,
        percentOfAssigned: totalTips > 0 ? (assignedTip / totalTips) * 100 : 0
      };
    }).sort((a, b) => b.assignedTip - a.assignedTip);

    return {
      unifiedTable,
      totalTips: totalTips,
      totalSales,
      tipPercentage: totalSales > 0 ? (totalTips / totalSales) * 100 : 0,
    };
  }, [tipFilteredSales, employees, distributionMethod]);

  const selectedCurrency = getSelectedCurrency(selectedRestaurant, accessibleRestaurants);

  // Get classification mode from selected restaurant(s)
  const classificationMode = useMemo(() => {
    if (selectedRestaurant !== 'all') {
      const r = accessibleRestaurants.find(r => r.id === selectedRestaurant);
      return r?.config?.employee_classification_mode || 'roles';
    }
    // If "all", use mode from first restaurant that has one
    const first = accessibleRestaurants.find(r => r.config?.employee_classification_mode);
    return first?.config?.employee_classification_mode || 'roles';
  }, [selectedRestaurant, accessibleRestaurants]);

  const employeeAreas = useMemo(() => {
    if (selectedRestaurant !== 'all') {
      const r = accessibleRestaurants.find(r => r.id === selectedRestaurant);
      return r?.config?.employee_areas || [];
    }
    const allAreas = new Set();
    accessibleRestaurants.forEach(r => (r.config?.employee_areas || []).forEach(a => allAreas.add(a)));
    return [...allAreas];
  }, [selectedRestaurant, accessibleRestaurants]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      <PageHeader
        title="Empleados"
        subtitle="Gestiona tu Team / RRHH"
        icon={UserCircle}
        imageKey="employees"
        gradient="from-violet-900/90 via-purple-900/80 to-slate-900/70"
      >
        <RestaurantSelector 
          restaurants={accessibleRestaurants}
          selectedId={selectedRestaurant}
          onChange={setSelectedRestaurant}
          className="bg-white/95 backdrop-blur-sm border-white/50 shadow-xl"
        />
      </PageHeader>

      <RestaurantPickerOnEntry
        restaurants={accessibleRestaurants}
        selectedRestaurant={selectedRestaurant}
        onSelect={setSelectedRestaurant}
        pageName="Empleados"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Resumen RRHH — total, % sobre venta, alerta si supera 30% */}
        <RRHHSummary restaurantId={selectedRestaurant !== 'all' ? selectedRestaurant : (accessibleRestaurants[0]?.id)} />

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-gradient-to-br from-emerald-500 to-green-600 border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300 h-full">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">Total Propinas</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {formatCurrency(tipsData.totalTips, selectedCurrency)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Coins className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* % Propina sobre Venta - clickable */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card 
                    className="bg-gradient-to-br from-blue-500 to-indigo-600 border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300 cursor-pointer h-full"
                    onClick={() => setTipTrendOpen(true)}
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-5 relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-blue-100 text-sm font-medium">% Propina / Venta</p>
                            <Info className="w-3 h-3 text-blue-200" />
                          </div>
                          <p className="text-2xl font-bold text-white mt-1">
                            {tipsData.tipPercentage.toFixed(1)}%
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <p className="text-[10px] text-blue-200 mt-1">Toca para ver tendencia 📈</p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Porcentaje que representan las propinas sobre el total de ventas netas. Toca para ver la tendencia diaria.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-gradient-to-br from-purple-500 to-violet-600 border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300 h-full">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Empleados Activos</p>
                    <p className="text-2xl font-bold text-white mt-1">{employees.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <Tabs defaultValue="equipo" className="space-y-4">
          <TabsList className="bg-white/80 backdrop-blur-sm shadow-lg border-0 p-1.5 rounded-2xl flex-wrap">
            <TabsTrigger value="equipo" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Users className="w-4 h-4" /> <span className="hidden sm:inline">Equipo de trabajo</span>
            </TabsTrigger>
            <TabsTrigger value="directorio" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <ListFilter className="w-4 h-4" /> <span className="hidden sm:inline">Directorio</span>
            </TabsTrigger>
            <TabsTrigger value="propinas" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Coins className="w-4 h-4" /> Propinas
            </TabsTrigger>
            <TabsTrigger value="rendimiento" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <BarChart3 className="w-4 h-4" /> <span className="hidden sm:inline">Rendimiento</span>
            </TabsTrigger>
            <TabsTrigger value="muestreos" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Star className="w-4 h-4" /> <span className="hidden sm:inline">Muestreos</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Equipo de trabajo */}
          <TabsContent value="equipo">
            <EquipoTrabajo restaurantId={selectedRestaurant !== 'all' ? selectedRestaurant : (accessibleRestaurants[0]?.id)} />
          </TabsContent>

          {/* Tab Directorio */}
          <TabsContent value="directorio">
            <EmployeeDirectoryTab
              employees={employees} 
              onEmployeeClick={(emp) => setSelectedEmployee(emp)}
              classificationMode={classificationMode}
              employeeAreas={employeeAreas}
            />
          </TabsContent>

          {/* Tab Propinas - Tabla unificada */}
          <TabsContent value="propinas">
            <Card className="bg-white border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-bold">Propinas del Equipo</CardTitle>
                    <p className="text-xs text-gray-400 mt-0.5">Propinas reales y distribución asignada</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DateRangePicker 
                      dateRange={tipDateRange}
                      onChange={setTipDateRange}
                      className="bg-gray-50 rounded-xl text-sm"
                    />
                    <Select value={distributionMethod} onValueChange={setDistributionMethod}>
                      <SelectTrigger className="w-[200px] bg-gray-50 rounded-xl text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equal">Distribución equitativa</SelectItem>
                        <SelectItem value="by_transactions">Por transacciones</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-600 font-medium">Total a distribuir</p>
                      <p className="text-2xl font-black text-emerald-800">
                        {formatCurrency(tipsData.totalTips, selectedCurrency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-emerald-600 font-medium">Método</p>
                      <p className="font-semibold text-emerald-800 text-sm">
                        {distributionMethod === "equal" ? "Equitativo" : "Por transacciones"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className="text-xs font-semibold uppercase text-gray-500">Empleado</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase text-gray-500">Transacciones</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase text-gray-500">Propinas Reales</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase text-gray-500">% Real</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase text-gray-500">Propina Asignada</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase text-gray-500">% Asignado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tipsData.unifiedTable.map((emp, idx) => (
                        <TableRow key={idx} className="hover:bg-gray-50/50">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700">
                                {emp.name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <span className="font-medium text-sm">{emp.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{emp.transactions}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-blue-600">
                            {formatCurrency(emp.realTips, selectedCurrency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs">
                              {emp.percentOfRealTips.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-emerald-600">
                              {formatCurrency(emp.assignedTip, selectedCurrency)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs">
                              {emp.percentOfAssigned.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {tipsData.unifiedTable.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-400 py-8 text-sm">
                            {employees.length === 0 
                              ? "No hay empleados configurados" 
                              : "No hay propinas en este período"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Rendimiento — historial completo via backend */}
          <TabsContent value="rendimiento">
            <WaiterPerformanceTab restaurantIds={accessibleRestaurantIds} currency={selectedCurrency} />
          </TabsContent>

          {/* Tab Muestreos */}
          <TabsContent value="muestreos">
            <SamplingStarsPanel
              accessibleRestaurantIds={accessibleRestaurantIds}
              selectedRestaurant={selectedRestaurant}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <EmployeeDetailModal
        open={!!selectedEmployee}
        onOpenChange={(open) => { if (!open) setSelectedEmployee(null); }}
        employee={selectedEmployee}
        restaurantIds={accessibleRestaurantIds}
        currency={selectedCurrency}
        classificationMode={classificationMode}
        employeeAreas={employeeAreas}
        onSave={async (updatedEmp) => {
          const restaurant = accessibleRestaurants.find(r => r.id === updatedEmp.restaurant_id);
          if (!restaurant) return;
          const updatedEmployees = (restaurant.config?.employees || []).map(e => 
            e.id === updatedEmp.id ? { ...e, role: updatedEmp.role, area: updatedEmp.area, phone: updatedEmp.phone, salary: updatedEmp.salary, notes: updatedEmp.notes } : e
          );
          await base44.entities.Restaurant.update(restaurant.id, {
            config: { ...restaurant.config, employees: updatedEmployees }
          });
          setSelectedEmployee(null);
          window.location.reload();
        }}
      />

      <TipTrendModal
        open={tipTrendOpen}
        onOpenChange={setTipTrendOpen}
        filteredSales={tipFilteredSales}
        dateRange={tipDateRange}
        currency={selectedCurrency}
      />

    </div>
  );
}
// ───────── Resumen RRHH (Costos de personal) ─────────
function RRHHSummary({ restaurantId }) {
  const { data: opex = [] } = useQuery({
    queryKey: ['rrhh-opex', restaurantId],
    queryFn: async () => {
      const all = restaurantId ? await base44.entities.OpEx.filter({ restaurant_id: restaurantId }) : await base44.entities.OpEx.list();
      return all || [];
    },
    enabled: true, staleTime: 60 * 1000,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ['rrhh-sales', restaurantId],
    queryFn: async () => {
      const all = restaurantId ? await base44.entities.Sale.filter({ restaurant_id: restaurantId }) : await base44.entities.Sale.list();
      return (all || []).filter((s) => !s.is_cancelled);
    },
    enabled: true, staleTime: 2 * 60 * 1000,
  });

  const now = new Date();
  const inMonth = (d) => { const x = new Date(d); return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth(); };

  const totalRRHH = opex.filter((o) => o.type === 'payroll' || (o.cost_center_name || '').toUpperCase().includes('RRHH') || (o.cost_center_name || '').toUpperCase().includes('PAYROLL')).filter((o) => inMonth(o.date)).reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const ventaMes = sales.filter((s) => inMonth(s.date_time)).reduce((s, x) => s + (Number(x.total_amount) || 0), 0);
  const pctVenta = ventaMes > 0 ? totalRRHH / ventaMes * 100 : 0;
  const MAX = 30; // umbral máximo configurable
  const alerta = pctVenta > MAX;

  const clp = (n) => (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

  return (
    <div className={`mb-6 rounded-2xl border p-5 flex items-center justify-between flex-wrap gap-4 ${alerta ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div>
        <p className="text-xs text-gray-500">Total RRHH (mes actual)</p>
        <p className="text-2xl font-bold text-noa-navy" style={{ fontFamily: '"Bricolage Grotesque", system-ui' }}>{clp(totalRRHH)}</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-500">% sobre venta</p>
        <p className={`text-2xl font-bold ${alerta ? 'text-red-600' : 'text-emerald-600'}`}>{pctVenta.toFixed(1)}%</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-500">Máximo recomendado</p>
        <p className="text-2xl font-bold text-gray-700">{MAX}%</p>
      </div>
      {alerta && (
        <div className="flex items-center gap-2 text-red-700 bg-red-100 rounded-xl px-4 py-2">
          <span className="text-lg">⚠️</span>
          <span className="text-sm font-medium">Costo de personal supera el {MAX}% de la venta</span>
        </div>
      )}
    </div>
  );
}
