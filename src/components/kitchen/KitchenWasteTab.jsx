import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, AlertTriangle, UserCircle } from "lucide-react";
import { motion } from 'framer-motion';
import { formatCurrency } from '@/components/utils/currencyHelper';
import WasteFormKitchen from '@/components/inventory/WasteFormKitchen';
import { getTodayInUserTz } from '@/components/utils/timezoneHelper';

const REASON_LABELS = {
  vencimiento: { label: 'Vencimiento', emoji: '⏰' },
  daño: { label: 'Daño físico', emoji: '💔' },
  contaminacion: { label: 'Contaminación', emoji: '☣️' },
  preparacion: { label: 'Error preparación', emoji: '👨‍🍳' },
  otro: { label: 'Otro', emoji: '📋' }
};

export default function KitchenWasteTab({
  supplyItems = [],
  selectedRestaurant = 'all',
  restaurant,
  restaurants = [],
  currency = 'USD',
  user
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const queryClient = useQueryClient();

  const isStaff = user?.app_role === 'staff';
  const employees = restaurant?.config?.employees?.filter(e => e.is_active !== false) || [];

  // Today's waste records for this restaurant
  const restId = selectedRestaurant !== 'all' ? selectedRestaurant : restaurant?.id;
  const todayStr = getTodayInUserTz(user);

  const { data: todayRecords = [] } = useQuery({
    queryKey: ['todayWaste', restId, todayStr],
    queryFn: async () => {
      if (!restId) return [];
      const records = await base44.entities.RegistroMerma.filter({ restaurant_id: restId }, '-date', 50);
      return records.filter(r => r.date === todayStr);
    },
    enabled: !!restId
  });

  const todayValue = todayRecords.reduce((sum, w) => sum + (w.estimated_value || 0), 0);

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
      queryClient.invalidateQueries({ queryKey: ['todayWaste'] });
      queryClient.invalidateQueries({ queryKey: ['wasteRecords'] });
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      queryClient.invalidateQueries({ queryKey: ['mySupplyItems'] });
      setShowForm(false);
    }
  });

  const restSupplyItems = useMemo(() => {
    if (!restId) return supplyItems;
    return supplyItems.filter(s => s.restaurant_id === restId);
  }, [supplyItems, restId]);

  const handleOpenForm = () => {
    // Staff must select employee first
    if (isStaff && employees.length > 0 && !selectedEmployee) {
      return; // Button should be disabled
    }
    setShowForm(true);
  };

  const registeredByName = useMemo(() => {
    if (isStaff && selectedEmployee) {
      const emp = employees.find(e => e.id === selectedEmployee);
      return emp?.name || user?.display_name || user?.full_name || '';
    }
    return user?.display_name || user?.full_name || user?.email || '';
  }, [isStaff, selectedEmployee, employees, user]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-orange-500" />
            Registro de Merma
          </h2>
          <p className="text-sm text-gray-500 mt-1">Registra las pérdidas del día desde cocina</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Employee selector for staff */}
          {isStaff && employees.length > 0 && (
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[200px] h-11 rounded-xl bg-white shadow-sm">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-gray-400" />
                  <SelectValue placeholder="¿Quién eres?" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} {emp.role ? `(${emp.role})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={handleOpenForm}
            disabled={isStaff && employees.length > 0 && !selectedEmployee}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl h-11 shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" /> Registrar Merma
          </Button>
        </div>
      </div>

      {/* Staff reminder */}
      {isStaff && employees.length > 0 && !selectedEmployee && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">Selecciona tu nombre en el menú desplegable para poder registrar merma.</p>
          </CardContent>
        </Card>
      )}

      {/* Today's summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-100">
          <CardContent className="p-5 text-center">
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Merma Hoy</p>
            <p className="text-2xl font-black text-red-700 mt-1">{formatCurrency(todayValue, currency)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
          <CardContent className="p-5 text-center">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Registros Hoy</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{todayRecords.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's records */}
      {todayRecords.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Registros de hoy</h3>
          {todayRecords.map((record, idx) => {
            const reasonInfo = REASON_LABELS[record.reason] || REASON_LABELS.otro;
            return (
              <motion.div key={record.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{reasonInfo.emoji}</div>
                    <div>
                      <p className="font-bold text-gray-900">{record.supply_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">{record.quantity} {record.unit}</span>
                        {record.registered_by && (
                          <span className="text-xs text-gray-400">👤 {record.registered_by}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="font-bold text-red-600">{formatCurrency(record.estimated_value || 0, currency)}</p>
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
            <p className="text-gray-500 font-medium">Sin mermas registradas hoy</p>
            <p className="text-sm text-gray-400 mt-1">Registra las pérdidas del día</p>
          </CardContent>
        </Card>
      )}

      {/* WasteFormKitchen dialog */}
      <WasteFormKitchen
        open={showForm}
        onOpenChange={setShowForm}
        supplyItems={restSupplyItems}
        currency={currency}
        selectedRestaurant={restId || ''}
        restaurants={restaurants}
        user={user}
        onSubmit={(data) => {
          createMutation.mutate({
            ...data,
            registered_by: registeredByName
          });
        }}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}