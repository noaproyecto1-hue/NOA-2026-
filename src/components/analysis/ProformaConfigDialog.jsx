import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Save, Loader2, Target, DollarSign, Percent, PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '@/components/utils/currencyHelper';

export default function ProformaConfigDialog({ 
  open, 
  onOpenChange, 
  restaurant, 
  currency = 'CLP' 
}) {
  const queryClient = useQueryClient();
  const [proforma, setProforma] = useState({
    monthly_income: 0,
    direct_cost_percent: 40,
    cost_centers_budget: [],
    target_ebitda_percent: 9
  });

  // Cargar proforma existente cuando cambia el restaurante
  useEffect(() => {
    if (restaurant?.proforma) {
      setProforma({
        monthly_income: restaurant.proforma.monthly_income || 0,
        direct_cost_percent: restaurant.proforma.direct_cost_percent || 40,
        cost_centers_budget: restaurant.proforma.cost_centers_budget || [],
        target_ebitda_percent: restaurant.proforma.target_ebitda_percent || 9
      });
    } else {
      // Inicializar con centros de costo del restaurante
      const costCenters = restaurant?.config?.cost_centers || [];
      const defaultBudget = costCenters.map(cc => ({
        name: cc.name,
        amount: 0,
        percent: 0
      }));
      
      // Agregar centros de costo comunes si no existen
      const commonCenters = ['PAYROLL', 'GASTOS FIJOS', 'MARKETING', 'ADMINISTRACIÓN', 'HIGIENE', 'COMUNICACIÓN', 'LOGÍSTICA', 'INVERSIONES'];
      commonCenters.forEach(name => {
        if (!defaultBudget.find(b => b.name.toUpperCase() === name)) {
          defaultBudget.push({ name, amount: 0, percent: 0 });
        }
      });

      setProforma({
        monthly_income: restaurant?.targets?.monthly_sales || 0,
        direct_cost_percent: 40,
        cost_centers_budget: defaultBudget,
        target_ebitda_percent: 9
      });
    }
  }, [restaurant]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Restaurant.update(restaurant.id, { proforma: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      onOpenChange(false);
    }
  });

  const handleCenterChange = (index, field, value) => {
    const updated = [...proforma.cost_centers_budget];
    updated[index] = { ...updated[index], [field]: value };
    
    // Si cambia el monto, recalcular el porcentaje
    if (field === 'amount' && proforma.monthly_income > 0) {
      updated[index].percent = (value / proforma.monthly_income) * 100;
    }
    // Si cambia el porcentaje, recalcular el monto
    if (field === 'percent') {
      updated[index].amount = (value / 100) * proforma.monthly_income;
    }
    
    setProforma({ ...proforma, cost_centers_budget: updated });
  };

  const addCostCenter = () => {
    setProforma({
      ...proforma,
      cost_centers_budget: [...proforma.cost_centers_budget, { name: '', amount: 0, percent: 0 }]
    });
  };

  const removeCostCenter = (index) => {
    const updated = proforma.cost_centers_budget.filter((_, i) => i !== index);
    setProforma({ ...proforma, cost_centers_budget: updated });
  };

  // Calcular totales
  const totalCostCentersAmount = proforma.cost_centers_budget.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalCostCentersPercent = proforma.cost_centers_budget.reduce((sum, c) => sum + (c.percent || 0), 0);
  const directCostAmount = (proforma.direct_cost_percent / 100) * proforma.monthly_income;
  const totalOperatingCosts = directCostAmount + totalCostCentersAmount;
  const totalOperatingPercent = proforma.direct_cost_percent + totalCostCentersPercent;
  const ebitdaAmount = proforma.monthly_income - totalOperatingCosts;
  const ebitdaPercent = proforma.monthly_income > 0 ? (ebitdaAmount / proforma.monthly_income) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            Configurar Proforma Financiera
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Ingresos Objetivo */}
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <Label className="text-emerald-800 font-semibold flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4" />
              Ingresos Netos Mensuales (Ideal)
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{getCurrencySymbol(currency)}</span>
              <Input
                type="number"
                value={proforma.monthly_income || ''}
                onChange={(e) => setProforma({ ...proforma, monthly_income: parseFloat(e.target.value) || 0 })}
                className="text-lg font-mono"
                placeholder="25000000"
              />
            </div>
          </Card>

          {/* Food Cost */}
          <Card className="p-4 bg-amber-50 border-amber-200">
            <Label className="text-amber-800 font-semibold flex items-center gap-2 mb-3">
              <Percent className="w-4 h-4" />
              Food Cost (% sobre ventas)
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500 mb-1">Porcentaje Ideal</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    value={proforma.direct_cost_percent || ''}
                    onChange={(e) => setProforma({ ...proforma, direct_cost_percent: parseFloat(e.target.value) || 0 })}
                    className="font-mono"
                  />
                  <span className="text-gray-500">%</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1">Monto Calculado</Label>
                <p className="text-lg font-mono text-amber-700 py-2">
                  {formatCurrency(directCostAmount, currency)}
                </p>
              </div>
            </div>
          </Card>

          {/* Centros de Costo */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Label className="font-semibold">Presupuesto por Centro de Costo</Label>
              <Button variant="outline" size="sm" onClick={addCostCenter} className="gap-1">
                <PlusCircle className="w-4 h-4" /> Agregar
              </Button>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {proforma.cost_centers_budget.map((center, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded-lg">
                  <div className="col-span-4">
                    <Input
                      value={center.name}
                      onChange={(e) => handleCenterChange(idx, 'name', e.target.value)}
                      placeholder="Nombre"
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">{getCurrencySymbol(currency)}</span>
                      <Input
                        type="number"
                        value={center.amount || ''}
                        onChange={(e) => handleCenterChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                        placeholder="Monto"
                        className="text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.1"
                        value={center.percent ? center.percent.toFixed(1) : ''}
                        onChange={(e) => handleCenterChange(idx, 'percent', parseFloat(e.target.value) || 0)}
                        placeholder="%"
                        className="text-sm font-mono"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeCostCenter(idx)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Resumen / EBITDA */}
          <Card className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
            <Label className="text-purple-800 font-semibold mb-3 block">Resumen Proforma</Label>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Ingresos Netos</span>
                <span className="font-mono font-semibold text-emerald-600">
                  {formatCurrency(proforma.monthly_income, currency)} (100%)
                </span>
              </div>
              <div className="flex justify-between">
                <span>(-) Food Cost</span>
                <span className="font-mono text-amber-600">
                  {formatCurrency(directCostAmount, currency)} ({proforma.direct_cost_percent}%)
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Margen Operacional</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(proforma.monthly_income - directCostAmount, currency)} ({(100 - proforma.direct_cost_percent).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span>(-) Total Centros de Costo</span>
                <span className="font-mono text-blue-600">
                  {formatCurrency(totalCostCentersAmount, currency)} ({totalCostCentersPercent.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Total Costos Operación</span>
                <span className="font-mono">
                  {formatCurrency(totalOperatingCosts, currency)} ({totalOperatingPercent.toFixed(1)}%)
                </span>
              </div>
              <div className={`flex justify-between border-t-2 pt-2 text-lg ${ebitdaAmount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                <span className="font-bold">EBITDA</span>
                <span className="font-mono font-bold">
                  {formatCurrency(ebitdaAmount, currency)} ({ebitdaPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => updateMutation.mutate(proforma)}
            disabled={updateMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar Proforma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}