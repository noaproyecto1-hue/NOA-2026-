import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, Search, Calendar, Package, FileText, Upload, Check } from "lucide-react";
import { motion } from 'framer-motion';
import { formatCurrency } from '@/components/utils/currencyHelper';
import WasteImportDialog from '@/components/inventory/WasteImportDialog';
import SupplySearchSelect from '@/components/inventory/SupplySearchSelect';
import WasteRankingChart from '@/components/inventory/WasteRankingChart';
import { getTodayInUserTz } from '@/components/utils/timezoneHelper';

const REASON_LABELS = {
  vencimiento: { label: 'Vencimiento', emoji: '⏰', color: 'bg-amber-100 text-amber-700' },
  daño: { label: 'Daño físico', emoji: '💔', color: 'bg-red-100 text-red-700' },
  contaminacion: { label: 'Contaminación', emoji: '☣️', color: 'bg-purple-100 text-purple-700' },
  preparacion: { label: 'Error preparación', emoji: '👨‍🍳', color: 'bg-blue-100 text-blue-700' },
  otro: { label: 'Otro', emoji: '📋', color: 'bg-gray-100 text-gray-700' }
};

export default function WastePanel({
  supplyItems = [],
  selectedRestaurant = 'all',
  accessibleRestaurantIds = [],
  currency = 'USD',
  restaurants = []
}) {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('current');
  const [form, setForm] = useState({
    restaurant_id: selectedRestaurant !== 'all' ? selectedRestaurant : '',
    date: '',
    supply_name: '',
    supply_id: '',
    quantity: '',
    unit: 'kg',
    reason: 'otro',
    notes: '',
    estimated_value: 0
  });
  const queryClient = useQueryClient();

  // Use .filter({ restaurant_id }) instead of .list() to reduce payload
  const { data: wasteRecords = [] } = useQuery({
    queryKey: ['wasteRecords', accessibleRestaurantIds],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        accessibleRestaurantIds.map(id => base44.entities.RegistroMerma.filter({ restaurant_id: id }, '-date', 200))
      );
      return results.flat();
    },
    enabled: accessibleRestaurantIds.length > 0
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const record = await base44.entities.RegistroMerma.create(data);
      // Descontar stock del insumo
      if (data.supply_id) {
        const supply = supplyItems.find(s => s.id === data.supply_id);
        if (supply) {
          const newStock = Math.max(0, (supply.current_stock || 0) - (data.quantity || 0));
          await base44.entities.SupplyItem.update(supply.id, { current_stock: newStock });
          await base44.entities.StockMovement.create({
            restaurant_id: data.restaurant_id,
            product_name: data.supply_name,
            product_id: supply.id,
            item_type: 'supply',
            movement_type: 'loss',
            quantity: -(data.quantity || 0),
            previous_stock: supply.current_stock || 0,
            new_stock: newStock,
            transaction_date: new Date().toISOString(),
            notes: `Merma: ${REASON_LABELS[data.reason]?.label || data.reason} - ${data.notes || ''}`
          });
        }
      }
      return record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wasteRecords'] });
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RegistroMerma.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wasteRecords'] })
  });

  const resetForm = () => {
    setForm({
      restaurant_id: selectedRestaurant !== 'all' ? selectedRestaurant : '',
      date: '',
      supply_name: '', supply_id: '', quantity: '', unit: 'kg',
      reason: 'otro', notes: '', estimated_value: 0
    });
  };

  const handleSelectSupply = (supplyId) => {
    const supply = restSupplyItems.find(s => s.id === supplyId);
    if (supply) {
      setForm(f => ({
        ...f,
        supply_name: supply.name,
        supply_id: supply.id,
        unit: supply.unit_of_measure || 'kg',
        restaurant_id: supply.restaurant_id,
        estimated_value: supply.average_unit_cost || 0
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const qty = parseFloat(form.quantity) || 0;
    createMutation.mutate({
      ...form,
      quantity: qty,
      estimated_value: qty * (form.estimated_value || 0),
      registered_by: currentUser?.display_name || currentUser?.full_name || currentUser?.email || ''
    });
  };

  const restSupplyItems = useMemo(() =>
    supplyItems.filter(s => selectedRestaurant === 'all' || s.restaurant_id === selectedRestaurant),
    [supplyItems, selectedRestaurant]
  );

  // Filtrar registros
  const filteredRecords = useMemo(() => {
    const now = new Date();
    let from = '2020-01-01', to = now.toISOString().slice(0, 10);
    if (filterMonth === 'current') {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    } else if (filterMonth === 'last') {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    }

    return wasteRecords.filter(w => {
      if (selectedRestaurant !== 'all' && w.restaurant_id !== selectedRestaurant) return false;
      if (w.date < from || w.date > to) return false;
      if (searchTerm && !w.supply_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      // Excluir pérdidas externas (se muestran en el panel de Pérdidas)
      if (w.notes?.includes('Pérdida externa')) return false;
      return true;
    });
  }, [wasteRecords, selectedRestaurant, filterMonth, searchTerm]);

  const totalWasteValue = filteredRecords.reduce((sum, w) => sum + (w.estimated_value || 0), 0);
  const totalWasteQty = filteredRecords.reduce((sum, w) => sum + (w.quantity || 0), 0);

  // Agrupar por motivo
  const byReason = useMemo(() => {
    const map = {};
    filteredRecords.forEach(w => {
      const r = w.reason || 'otro';
      if (!map[r]) map[r] = { count: 0, value: 0, qty: 0 };
      map[r].count++;
      map[r].value += w.estimated_value || 0;
      map[r].qty += w.quantity || 0;
    });
    return map;
  }, [filteredRecords]);

  return (
    <div className="space-y-4">
      {/* Filtros y botón agregar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar insumo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10 rounded-xl" />
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[160px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Este mes</SelectItem>
            <SelectItem value="last">Mes anterior</SelectItem>
            <SelectItem value="all">Todo</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowImportDialog(true)} className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl h-10 shadow-lg">
          <Upload className="w-4 h-4 mr-2" /> Importar Documento
        </Button>
        <Button 
          onClick={() => setShowRanking(!showRanking)} 
          variant={showRanking ? "default" : "outline"}
          className={`rounded-xl h-10 ${showRanking ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg' : 'border-orange-200 text-orange-600 hover:bg-orange-50'}`}
        >
          🏆 Ranking
        </Button>
        {/* Registrar Merma se hace desde Cocina → Merma */}
      </div>

      {/* Ranking Top 10 */}
      {showRanking && (
        <WasteRankingChart
          wasteRecords={wasteRecords}
          currency={currency}
          filterMonth={filterMonth}
          selectedRestaurant={selectedRestaurant}
        />
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Valor Merma</p>
            <p className="text-xl font-black text-red-700 mt-1">{formatCurrency(totalWasteValue, currency)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Registros</p>
            <p className="text-xl font-black text-amber-700 mt-1">{filteredRecords.length}</p>
          </CardContent>
        </Card>
        {Object.entries(byReason).slice(0, 2).map(([reason, data]) => (
          <Card key={reason} className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-100">
            <CardContent className="p-4 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {REASON_LABELS[reason]?.emoji} {REASON_LABELS[reason]?.label || reason}
              </p>
              <p className="text-xl font-black text-gray-700 mt-1">{data.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista de registros */}
      {filteredRecords.length > 0 ? (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredRecords.map((record, idx) => {
            const reasonInfo = REASON_LABELS[record.reason] || REASON_LABELS.otro;
            return (
              <motion.div key={record.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{reasonInfo.emoji}</div>
                    <div>
                      <p className="font-bold text-gray-900">{record.supply_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">📅 {record.date ? record.date.split('-').reverse().join('-') : '—'}</span>
                        <Badge className={`${reasonInfo.color} border-0 text-[10px]`}>{reasonInfo.label}</Badge>
                        {record.registered_by && (
                          <span className="text-xs text-gray-400">👤 {record.registered_by}</span>
                        )}
                      </div>
                      {record.notes && <p className="text-xs text-gray-400 mt-0.5">{record.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-red-600">{formatCurrency(record.estimated_value || 0, currency)}</p>
                      <p className="text-xs text-gray-500">{record.quantity} {record.unit}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => { if (confirm('¿Eliminar este registro?')) deleteMutation.mutate(record.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-orange-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay registros de merma</p>
            <p className="text-sm text-gray-400 mt-1">Registra mermas diarias para llevar control</p>
          </CardContent>
        </Card>
      )}

      {/* Registrar Merma se hace desde Cocina → Merma */}

      {/* Dialog: Importar Merma desde documento */}
      <WasteImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        supplyItems={supplyItems}
        restaurants={restaurants}
        selectedRestaurant={selectedRestaurant}
        currency={currency}
      />
    </div>
  );
}