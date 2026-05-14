import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Users, 
  Crown, 
  TrendingUp,
  ShoppingBag,
  Search,
  Star,
  Gift,
  Calendar,
  DollarSign,
  Eye,
  Heart,
  Edit,
  Mail,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import PageHeader from '@/components/ui/PageHeader';
import { startOfYear, endOfYear, format, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import RestaurantSelector from '@/components/dashboard/RestaurantSelector';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import { getSelectedCurrency, formatCurrency } from '@/components/utils/currencyHelper';
import RestaurantPickerOnEntry from '@/components/dialogs/RestaurantPickerOnEntry';
import { fetchAllRecords, fetchAllForRestaurants } from '@/components/utils/fetchAllRecords';

export default function Clientes() {
  const queryClient = useQueryClient();
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [dateRange, setDateRange] = useState({
    from: startOfYear(new Date()),
    to: endOfYear(new Date())
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [editEmail, setEditEmail] = useState("");

  // Fetch user
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Filtrar restaurantes por usuario - respeta restaurant_ids
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

  // IDs de restaurantes accesibles
  const accessibleRestaurantIds = useMemo(() => {
    return accessibleRestaurants.map(r => r.id);
  }, [accessibleRestaurants]);

  // Fetch customers (emails) - solo de restaurantes accesibles
  const { data: customers = [] } = useQuery({
    queryKey: ['customers', selectedRestaurant, accessibleRestaurantIds],
    queryFn: async () => {
      if (selectedRestaurant !== "all") {
        return base44.entities.Customer.filter({ restaurant_id: selectedRestaurant });
      }
      if (accessibleRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        accessibleRestaurantIds.map(id => base44.entities.Customer.filter({ restaurant_id: id }))
      );
      return results.flat();
    },
    enabled: accessibleRestaurantIds.length > 0,
    staleTime: 5 * 60 * 1000
  });

  // Create customer email mapping
  const customerEmailMap = useMemo(() => {
    const map = {};
    customers.forEach(c => {
      if (c.name) map[c.name.toLowerCase().trim()] = c;
    });
    return map;
  }, [customers]);

  // Mutations for customers
  const createCustomerMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] })
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] })
  });

  // Fetch sales - TODAS las ventas de restaurantes accesibles (sin límite artificial)
  const { data: sales = [] } = useQuery({
    queryKey: ['sales-clientes', selectedRestaurant, accessibleRestaurantIds],
    queryFn: async () => {
      if (selectedRestaurant !== "all") {
        return fetchAllRecords('Sale', { restaurant_id: selectedRestaurant }, '-date_time');
      }
      if (accessibleRestaurantIds.length === 0) return [];
      return fetchAllForRestaurants('Sale', accessibleRestaurantIds, {}, '-date_time');
    },
    enabled: accessibleRestaurantIds.length > 0,
    staleTime: 2 * 60 * 1000
  });

  // Filter sales by date range
  const filteredSales = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    return sales.filter(s => {
      if (s.is_cancelled) return false;
      const saleDate = new Date(s.date_time || s.date);
      return isWithinInterval(saleDate, { start: dateRange.from, end: dateRange.to });
    });
  }, [sales, dateRange]);

  // Calculate client data
  const clientsData = useMemo(() => {
    const byClient = {};
    let totalSales = 0;
    let totalTransactions = 0;

    filteredSales.forEach(sale => {
      const clientName = sale.customer_name?.trim();
      if (!clientName || clientName === '') return; // Solo ventas con cliente identificado

      totalSales += sale.total_amount || 0;
      totalTransactions++;

      if (!byClient[clientName]) {
        byClient[clientName] = {
          name: clientName,
          totalSpent: 0,
          visits: 0,
          avgTicket: 0,
          lastVisit: null,
          firstVisit: null,
          favoriteProducts: {},
          salesHistory: []
        };
      }

      const client = byClient[clientName];
      client.totalSpent += sale.total_amount || 0;
      client.visits++;
      
      const saleDate = new Date(sale.date_time || sale.date);
      if (!client.lastVisit || saleDate > client.lastVisit) {
        client.lastVisit = saleDate;
      }
      if (!client.firstVisit || saleDate < client.firstVisit) {
        client.firstVisit = saleDate;
      }

      // Track favorite products
      (sale.products || []).forEach(product => {
        if (!client.favoriteProducts[product.product_name]) {
          client.favoriteProducts[product.product_name] = 0;
        }
        client.favoriteProducts[product.product_name] += product.quantity || 1;
      });

      client.salesHistory.push(sale);
    });

    // Calculate averages and sort products
    const clientList = Object.values(byClient).map(client => ({
      ...client,
      avgTicket: client.visits > 0 ? client.totalSpent / client.visits : 0,
      favoriteProducts: Object.entries(client.favoriteProducts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, quantity: qty }))
    }));

    // Classify clients
    const sortedBySpent = [...clientList].sort((a, b) => b.totalSpent - a.totalSpent);
    const top20Percent = Math.ceil(sortedBySpent.length * 0.2);
    
    sortedBySpent.forEach((client, idx) => {
      if (idx < top20Percent) {
        client.tier = 'vip';
      } else if (idx < top20Percent * 2) {
        client.tier = 'frecuente';
      } else {
        client.tier = 'regular';
      }
    });

    return {
      clients: sortedBySpent.filter(c => 
        !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
      totalClients: Object.keys(byClient).length,
      totalSales,
      totalTransactions,
      vipClients: sortedBySpent.filter(c => c.tier === 'vip').length,
      avgTicket: totalTransactions > 0 ? totalSales / totalTransactions : 0
    };
  }, [filteredSales, searchTerm]);

  const ITEMS_PER_PAGE = 50;
  const totalPages = Math.ceil(clientsData.clients.length / ITEMS_PER_PAGE);
  const paginatedClients = clientsData.clients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const selectedCurrency = getSelectedCurrency(selectedRestaurant, accessibleRestaurants);

  const tierConfig = {
    vip: { label: 'VIP', color: 'bg-amber-100 text-amber-700', icon: Crown },
    frecuente: { label: 'Frecuente', color: 'bg-blue-100 text-blue-700', icon: Star },
    regular: { label: 'Regular', color: 'bg-gray-100 text-gray-700', icon: Users }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      {/* Hero Header */}
      <PageHeader
        title="Clientes"
        subtitle="Análisis y fidelización de clientes"
        icon={Heart}
        imageKey="clients"
        gradient="from-cyan-900/90 via-teal-900/80 to-slate-900/70"
      >
        <RestaurantSelector 
          restaurants={accessibleRestaurants}
          selectedId={selectedRestaurant}
          onChange={setSelectedRestaurant}
          className="bg-white/95 backdrop-blur-sm border-white/50 shadow-xl"
        />
        <DateRangePicker 
          dateRange={dateRange}
          onChange={setDateRange}
          className="bg-white/95 backdrop-blur-sm border-white/50 shadow-xl"
        />
      </PageHeader>

      {/* Restaurant Picker al entrar */}
      <RestaurantPickerOnEntry
        restaurants={accessibleRestaurants}
        selectedRestaurant={selectedRestaurant}
        onSelect={setSelectedRestaurant}
        pageName="Clientes"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Métricas Modernizadas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-gradient-to-br from-cyan-500 to-teal-600 border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-cyan-100 text-sm font-medium">Total Clientes</p>
                    <p className="text-2xl font-bold text-white mt-1">{clientsData.totalClients}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-sm font-medium">Clientes VIP</p>
                    <p className="text-2xl font-bold text-white mt-1">{clientsData.vipClients}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-gradient-to-br from-purple-500 to-violet-600 border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Ticket Promedio</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {formatCurrency(clientsData.avgTicket, selectedCurrency)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Tabla de Clientes */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600" />
                Ranking de Clientes
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-gray-50"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead className="text-right">Total Gastado</TableHead>
                  <TableHead className="text-right">Visitas</TableHead>
                  <TableHead className="text-right">Ticket Promedio</TableHead>
                  <TableHead className="text-right">Última Visita</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClients.map((client, idx) => {
                  const TierIcon = tierConfig[client.tier]?.icon || Users;
                  const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx;
                  return (
                    <TableRow key={client.name} className="hover:bg-gray-50">
                      <TableCell className="font-bold text-gray-400">
                        {globalIdx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {client.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium block">{client.name}</span>
                            {customerEmailMap[client.name.toLowerCase().trim()]?.email && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {customerEmailMap[client.name.toLowerCase().trim()].email}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${tierConfig[client.tier]?.color} flex items-center gap-1 w-fit`}>
                          <TierIcon className="w-3 h-3" />
                          {tierConfig[client.tier]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {formatCurrency(client.totalSpent, selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right">{client.visits}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(client.avgTicket, selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right text-gray-500 text-sm">
                        {client.lastVisit ? format(client.lastVisit, 'dd/MM/yy', { locale: es }) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedClient(client)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              const existing = customerEmailMap[client.name.toLowerCase().trim()];
                              setEditingClient(client);
                              setEditEmail(existing?.email || "");
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paginatedClients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      {filteredSales.length === 0 
                        ? "No hay ventas en el período seleccionado"
                        : "No hay ventas con nombre de cliente registrado"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <p className="text-sm text-gray-500">
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, clientsData.clients.length)} de {clientsData.clients.length} clientes
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm font-medium text-gray-700 px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Editar Email del Cliente */}
      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-600" />
              Editar Correo de {editingClient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="cliente@email.com"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClient(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const existing = customerEmailMap[editingClient.name.toLowerCase().trim()];
                const restaurantId = selectedRestaurant !== 'all' 
                  ? selectedRestaurant 
                  : accessibleRestaurants[0]?.id;
                
                if (existing) {
                  await updateCustomerMutation.mutateAsync({ 
                    id: existing.id, 
                    data: { email: editEmail } 
                  });
                } else {
                  await createCustomerMutation.mutateAsync({
                    restaurant_id: restaurantId,
                    name: editingClient.name,
                    email: editEmail
                  });
                }
                setEditingClient(null);
              }}
              disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {(createCustomerMutation.isPending || updateCustomerMutation.isPending) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalle del Cliente */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-cyan-600">
                  {selectedClient?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xl">{selectedClient?.name}</p>
                <Badge className={tierConfig[selectedClient?.tier]?.color}>
                  {tierConfig[selectedClient?.tier]?.label}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-6 mt-4">
              {/* Stats del cliente */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(selectedClient.totalSpent, selectedCurrency)}
                  </p>
                  <p className="text-sm text-emerald-700">Total Gastado</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedClient.visits}</p>
                  <p className="text-sm text-blue-700">Visitas</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(selectedClient.avgTicket, selectedCurrency)}
                  </p>
                  <p className="text-sm text-purple-700">Ticket Promedio</p>
                </div>
              </div>

              {/* Fechas */}
              <div className="flex gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Primera visita: {selectedClient.firstVisit ? format(selectedClient.firstVisit, 'dd/MM/yyyy') : '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Última visita: {selectedClient.lastVisit ? format(selectedClient.lastVisit, 'dd/MM/yyyy') : '-'}</span>
                </div>
              </div>

              {/* Productos favoritos */}
              {selectedClient.favoriteProducts?.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    Productos Favoritos
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedClient.favoriteProducts.map((prod, idx) => (
                      <Badge key={idx} variant="outline" className="bg-amber-50 border-amber-200">
                        {prod.name} ({prod.quantity}x)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugerencias */}
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 rounded-xl border border-cyan-100">
                <h4 className="font-medium text-cyan-800 mb-2 flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  Sugerencias de Fidelización
                </h4>
                <ul className="text-sm text-cyan-700 space-y-1">
                  {selectedClient.tier === 'vip' && (
                    <>
                      <li>• Ofrecer descuento exclusivo del 10-15%</li>
                      <li>• Invitar a eventos especiales o degustaciones</li>
                      <li>• Postre o bebida de cortesía en su próxima visita</li>
                    </>
                  )}
                  {selectedClient.tier === 'frecuente' && (
                    <>
                      <li>• Ofrecer programa de puntos o rewards</li>
                      <li>• Descuento del 5% en su próxima compra</li>
                      <li>• Notificar sobre nuevos productos de su categoría favorita</li>
                    </>
                  )}
                  {selectedClient.tier === 'regular' && (
                    <>
                      <li>• Invitar a probar nuevos productos del menú</li>
                      <li>• Ofrecer promoción 2x1 en su próxima visita</li>
                      <li>• Agregar a lista de newsletter con ofertas</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Historial reciente */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-gray-600" />
                  Últimas Compras
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedClient.salesHistory?.slice(0, 10).map((sale, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <div>
                        <p className="font-medium">
                          {format(new Date(sale.date_time || sale.date), 'dd/MM/yyyy HH:mm')}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {(sale.products || []).map(p => p.product_name).slice(0, 3).join(', ')}
                          {(sale.products || []).length > 3 && '...'}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(sale.total_amount, selectedCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}