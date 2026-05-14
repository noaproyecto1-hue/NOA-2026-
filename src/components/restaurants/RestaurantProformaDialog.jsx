import React, { useState, useEffect } from 'react';
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
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2,
  DollarSign,
  Percent,
  Plus,
  Trash2,
  TrendingUp,
  Target,
  PiggyBank
} from "lucide-react";
import { formatCurrency } from '@/components/utils/currencyHelper';

const defaultProforma = {
  monthly_income: 0,
  direct_cost_percent: 30,
  cost_centers_budget: [],
  target_ebitda_percent: 15
};

export default function RestaurantProformaDialog({ 
  open, 
  onOpenChange, 
  restaurant,
  onSave,
  isSaving = false
}) {
  const [proforma, setProforma] = useState(defaultProforma);
  const [newCostCenter, setNewCostCenter] = useState({ name: '', amount: '', percent: '' });

  const currency = restaurant?.currency || 'USD';
  const costCenters = restaurant?.config?.cost_centers || [];

  useEffect(() => {
    if (open && restaurant?.proforma) {
      setProforma({
        ...defaultProforma,
        ...restaurant.proforma
      });
    } else if (open) {
      // Auto-generar centros de costo budget desde la config del restaurante
      const opexCenters = (restaurant?.config?.cost_centers || []).filter(c => c.type === 'opex');
      const defaultBudget = opexCenters.map(c => ({ name: c.name, amount: 0, percent: 0 }));
      setProforma({ ...defaultProforma, cost_centers_budget: defaultBudget });
    }
  }, [open, restaurant]);

  const handleSave = () => {
    // Guardar con el EBITDA % calculado automáticamente del resumen
    const proformaToSave = {
      ...proforma,
      target_ebitda_percent: parseFloat(netMargin.toFixed(1))
    };
    onSave(proformaToSave);
  };

  // Calcular totales
  const totalCostCentersBudget = (proforma.cost_centers_budget || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  const directCostAmount = (proforma.monthly_income * (proforma.direct_cost_percent || 0)) / 100;
  const grossProfit = proforma.monthly_income - directCostAmount;
  const netProfit = grossProfit - totalCostCentersBudget;
  const netMargin = proforma.monthly_income > 0 ? (netProfit / proforma.monthly_income) * 100 : 0;

  // Agregar centro de costo al presupuesto
  const handleAddCostCenter = () => {
    if (!newCostCenter.name || (!newCostCenter.amount && !newCostCenter.percent)) return;
    
    let amount = parseFloat(newCostCenter.amount) || 0;
    let percent = parseFloat(newCostCenter.percent) || 0;
    
    // Si se ingresó porcentaje, calcular monto
    if (percent > 0 && proforma.monthly_income > 0) {
      amount = (proforma.monthly_income * percent) / 100;
    }
    // Si se ingresó monto, calcular porcentaje
    if (amount > 0 && proforma.monthly_income > 0) {
      percent = (amount / proforma.monthly_income) * 100;
    }

    const newItem = {
      name: newCostCenter.name.toUpperCase(),
      amount,
      percent
    };

    setProforma(prev => ({
      ...prev,
      cost_centers_budget: [...(prev.cost_centers_budget || []), newItem]
    }));
    setNewCostCenter({ name: '', amount: '', percent: '' });
  };

  const handleRemoveCostCenter = (index) => {
    setProforma(prev => ({
      ...prev,
      cost_centers_budget: prev.cost_centers_budget.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateCostCenter = (index, field, value) => {
    setProforma(prev => {
      const updated = [...prev.cost_centers_budget];
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
      
      // Recalcular el otro valor
      if (field === 'amount' && prev.monthly_income > 0) {
        updated[index].percent = (updated[index].amount / prev.monthly_income) * 100;
      } else if (field === 'percent' && prev.monthly_income > 0) {
        updated[index].amount = (prev.monthly_income * updated[index].percent) / 100;
      }
      
      return { ...prev, cost_centers_budget: updated };
    });
  };

  // Recalcular montos cuando cambia el ingreso mensual
  const handleIncomeChange = (newIncome) => {
    const income = parseFloat(newIncome) || 0;
    setProforma(prev => ({
      ...prev,
      monthly_income: income,
      cost_centers_budget: (prev.cost_centers_budget || []).map(c => ({
        ...c,
        amount: income > 0 ? (income * (c.percent || 0)) / 100 : c.amount
      }))
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="block text-xl font-bold">Configurar Proforma</span>
                <span className="text-sm font-normal text-white/70">{restaurant?.name}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Ingreso Mensual Objetivo */}
          <Card className="p-5 bg-gradient-to-br from-emerald-50 to-green-50 border-0 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <Label className="text-gray-900 font-semibold">Ingresos Netos Mensuales</Label>
                <p className="text-xs text-gray-500">Ventas netas objetivo (sin IVA)</p>
              </div>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={proforma.monthly_income || ''}
                onChange={(e) => handleIncomeChange(e.target.value)}
                placeholder="0"
                className="bg-white border-emerald-200 h-14 text-2xl font-bold pl-12"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-lg">$</span>
            </div>
          </Card>

          {/* Food Cost */}
          <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-0 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                <Percent className="w-5 h-5 text-white" />
              </div>
              <div>
                <Label className="text-gray-900 font-semibold">Food Cost (Costo de Venta)</Label>
                <p className="text-xs text-gray-500">Porcentaje ideal sobre ventas netas</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Input
                  type="number"
                  value={proforma.direct_cost_percent || ''}
                  onChange={(e) => setProforma(prev => ({ ...prev, direct_cost_percent: parseFloat(e.target.value) || 0 }))}
                  placeholder="30"
                  min={0}
                  max={100}
                  className="bg-white border-amber-200 h-12 text-lg font-semibold pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-600 font-bold">%</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Monto</p>
                <p className="text-lg font-bold text-amber-600">
                  {formatCurrency(directCostAmount, currency)}
                </p>
              </div>
            </div>
          </Card>

          {/* Centros de Costo (OPEX) */}
          <Card className="p-5 bg-gradient-to-br from-purple-50 to-violet-50 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
                  <PiggyBank className="w-5 h-5 text-white" />
                </div>
                <div>
                  <Label className="text-gray-900 font-semibold">Presupuesto por Centro de Costo</Label>
                  <p className="text-xs text-gray-500">Gastos operativos mensuales</p>
                </div>
              </div>
              <Badge className="bg-purple-100 text-purple-700">
                {formatCurrency(totalCostCentersBudget, currency)}
              </Badge>
            </div>

            {/* Lista de centros de costo - Diseño mejorado */}
            <div className="space-y-2 mb-4 max-h-[240px] overflow-y-auto pr-1">
              {(proforma.cost_centers_budget || []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Sin centros de costo configurados
                </p>
              ) : (
                (proforma.cost_centers_budget || []).map((center, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-purple-100 hover:border-purple-200 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{center.name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <Input
                          type="number"
                          value={Math.round(center.amount) || ''}
                          onChange={(e) => handleUpdateCostCenter(index, 'amount', e.target.value)}
                          className="w-24 h-9 text-sm pl-5 text-right font-medium"
                          placeholder="0"
                        />
                      </div>
                      <div className="relative w-20">
                        <Input
                          type="number"
                          step="0.1"
                          value={center.percent || ''}
                          onChange={(e) => handleUpdateCostCenter(index, 'percent', e.target.value)}
                          className="w-full h-9 text-sm text-right pr-6 font-medium"
                          placeholder="0"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCostCenter(index)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 h-9 w-9 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Agregar nuevo - Diseño mejorado */}
            <div className="pt-3 border-t border-purple-200 space-y-2">
              <div className="flex gap-2">
                <select
                  value={newCostCenter.name}
                  onChange={(e) => setNewCostCenter(prev => ({ ...prev, name: e.target.value }))}
                  className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
                >
                  <option value="">Seleccionar centro de costo...</option>
                  {(() => {
                    const restaurantOpex = costCenters.filter(c => c.type === 'opex').map(c => c.name.toUpperCase());
                    const commonCenters = ['PAYROLL/RRHH', 'REAL STATE/RENTA', 'GASTOS FIJOS', 'MARKETING', 'ADMINISTRACIÓN', 'HIGIENE E INOCUIDAD', 'COMUNICACIÓN', 'LOGÍSTICA', 'INVERSIONES'];
                    const extraCenters = commonCenters.filter(name => !restaurantOpex.includes(name));
                    const alreadyAdded = (proforma.cost_centers_budget || []).map(c => c.name.toUpperCase());
                    
                    return (
                      <>
                        {costCenters.filter(c => c.type === 'opex').map((c) => (
                          <option key={c.name} value={c.name} disabled={alreadyAdded.includes(c.name.toUpperCase())}>
                            {c.name}{alreadyAdded.includes(c.name.toUpperCase()) ? ' ✓' : ''}
                          </option>
                        ))}
                        {extraCenters.length > 0 && (
                          <>
                            <option disabled>──────────</option>
                            {extraCenters.map(name => (
                              <option key={name} value={name} disabled={alreadyAdded.includes(name)}>
                                {name}{alreadyAdded.includes(name) ? ' ✓' : ''}
                              </option>
                            ))}
                          </>
                        )}
                      </>
                    );
                  })()}
                </select>
                <div className="relative w-20">
                 <Input
                   type="number"
                   step="0.1"
                   value={newCostCenter.percent}
                   onChange={(e) => setNewCostCenter(prev => ({ ...prev, percent: e.target.value }))}
                   placeholder="0"
                   className="w-full h-10 text-sm text-right pr-6"
                 />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                <Button onClick={handleAddCostCenter} className="h-10 px-4 bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Resumen / Preview */}
          <Card className="p-5 bg-gradient-to-br from-slate-800 to-gray-900 border-0 shadow-xl text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <Label className="text-white font-semibold">Resumen Proforma</Label>
                <p className="text-xs text-white/60">Vista previa del estado de resultados ideal</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-white/70">Ingresos Netos</span>
                <span className="font-bold text-emerald-400">{formatCurrency(proforma.monthly_income, currency)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-white/70">(-) Food Cost ({proforma.direct_cost_percent}%)</span>
                <span className="font-medium text-amber-400">-{formatCurrency(directCostAmount, currency)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-white/80 font-medium">= Margen Operacional</span>
                <span className="font-bold text-white">{formatCurrency(grossProfit, currency)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-white/70">(-) Costos de Operación</span>
                <span className="font-medium text-purple-400">-{formatCurrency(totalCostCentersBudget, currency)}</span>
              </div>
              <div className="flex justify-between items-center py-3 bg-white/10 rounded-lg px-3 -mx-3">
                <span className="text-white font-bold">= EBITDA Objetivo</span>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(netProfit, currency)}
                  </span>
                  <span className={`block text-sm ${netMargin >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {netMargin.toFixed(1)}% margen
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-gray-50/50">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Guardar Proforma</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}