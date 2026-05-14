import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from '@/components/utils/currencyHelper';
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, Pencil, Trash2, Save } from 'lucide-react';

export default function ProformaTable({ 
  proforma, 
  actualData, 
  currency = 'CLP',
  monthLabel = '',
  onUpdateItemBudgets,
  restaurant
}) {
  const [expandedSections, setExpandedSections] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [editPercent, setEditPercent] = useState('');
  const [errorMessage, setErrorMessage] = useState('');


  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Obtener item_budgets del proforma
  const itemBudgets = proforma?.item_budgets || [];

  // Función para obtener el presupuesto ideal de un ítem específico
  const getItemIdealPercent = (centerName, itemName) => {
    const found = itemBudgets.find(
      ib => ib.center_name?.toUpperCase() === centerName?.toUpperCase() && 
            ib.item_name?.toUpperCase() === itemName?.toUpperCase()
    );
    return found ? found.percent : null;
  };

  // Obtener el % máximo disponible para este centro de costo
  // isDirectCost diferencia entre FOOD COST principal (naranja, 40%) y FOOD COST en OPEX (azul, 5%)
  const getCenterMaxPercent = (centerName, isDirectCost = false) => {
    // Si es el FOOD COST principal (costo directo, naranja), usar direct_cost_percent
    if (isDirectCost && centerName?.toUpperCase() === 'FOOD COST') {
      return proforma?.direct_cost_percent || 0;
    }
    // Si no, buscar en cost_centers_budget (para OPEX, incluyendo FOOD COST azul)
    const centerBudget = (proforma?.cost_centers_budget || []).find(
      c => c.name?.toUpperCase() === centerName?.toUpperCase()
    );
    return centerBudget?.percent || 0;
  };

  // Obtener la suma actual de % asignados a ítems de un centro (excluyendo el ítem actual)
  const getAssignedPercentForCenter = (centerName, excludeItemName = null) => {
    return itemBudgets
      .filter(ib => 
        ib.center_name?.toUpperCase() === centerName?.toUpperCase() &&
        (excludeItemName ? ib.item_name?.toUpperCase() !== excludeItemName?.toUpperCase() : true)
      )
      .reduce((sum, ib) => sum + (ib.percent || 0), 0);
  };

  // Guardar cambio de porcentaje ideal de un ítem
  const handleSaveItemPercent = async () => {
    if (!editingItem || !onUpdateItemBudgets) return;
    
    const percent = parseFloat(editPercent) || 0;
    // Usar isDirectCost para determinar el límite correcto
    const centerMax = getCenterMaxPercent(editingItem.centerName, editingItem.isDirectCost);
    const currentAssigned = getAssignedPercentForCenter(editingItem.centerName, editingItem.itemName);
    const availablePercent = centerMax - currentAssigned;

    // Validar que no supere el máximo del centro de costo
    if (percent > availablePercent) {
      setErrorMessage(`El porcentaje máximo disponible es ${availablePercent.toFixed(1)}% (${centerMax}% total - ${currentAssigned.toFixed(1)}% ya asignado)`);
      return;
    }
    setErrorMessage('');

    const newBudgets = [...itemBudgets];
    const existingIndex = newBudgets.findIndex(
      ib => ib.center_name?.toUpperCase() === editingItem.centerName?.toUpperCase() && 
            ib.item_name?.toUpperCase() === editingItem.itemName?.toUpperCase()
    );

    if (existingIndex >= 0) {
      newBudgets[existingIndex] = { ...newBudgets[existingIndex], percent };
    } else {
      newBudgets.push({
        center_name: editingItem.centerName,
        item_name: editingItem.itemName,
        percent
      });
    }

    await onUpdateItemBudgets(newBudgets);
    setEditingItem(null);
    setEditPercent('');
  };



  // Eliminar presupuesto de ítem
  const handleDeleteItemBudget = async (centerName, itemName) => {
    if (!onUpdateItemBudgets) return;
    
    const newBudgets = itemBudgets.filter(
      ib => !(ib.center_name?.toUpperCase() === centerName?.toUpperCase() && 
              ib.item_name?.toUpperCase() === itemName?.toUpperCase())
    );
    
    await onUpdateItemBudgets(newBudgets);
  };

  if (!proforma || !proforma.monthly_income) {
    return (
      <Card className="p-8 text-center bg-gray-50">
        <p className="text-gray-500">No hay proforma configurada para este restaurante.</p>
        <p className="text-sm text-gray-400 mt-2">Usa el botón "Configurar Proforma" para definir el presupuesto ideal.</p>
      </Card>
    );
  }

  // Calcular valores de proforma
  const idealIncome = proforma.monthly_income;
  const idealDirectCostPercent = proforma.direct_cost_percent || 40;
  const idealDirectCost = (idealDirectCostPercent / 100) * idealIncome;
  const idealGrossMargin = idealIncome - idealDirectCost;
  const idealGrossMarginPercent = 100 - idealDirectCostPercent;

  const costCentersBudget = proforma.cost_centers_budget || [];
  const idealTotalOpex = costCentersBudget.reduce((sum, c) => sum + (c.amount || 0), 0);
  const idealTotalOpexPercent = costCentersBudget.reduce((sum, c) => sum + (c.percent || 0), 0);
  const idealTotalCosts = idealDirectCost + idealTotalOpex;
  const idealTotalCostsPercent = idealDirectCostPercent + idealTotalOpexPercent;
  const idealEbitda = idealIncome - idealTotalCosts;
  const idealEbitdaPercent = idealIncome > 0 ? (idealEbitda / idealIncome) * 100 : 0;

  // Datos reales
  const actualIncome = actualData?.totalIncome || 0;
  const actualDirectCost = actualData?.totalSupplyCost || 0;
  const actualDirectCostPercent = actualIncome > 0 ? (actualDirectCost / actualIncome) * 100 : 0;
  const actualGrossMargin = actualIncome - actualDirectCost;
  const actualGrossMarginPercent = actualIncome > 0 ? (actualGrossMargin / actualIncome) * 100 : 0;
  const actualTotalOpex = actualData?.totalOpex || 0;
  const actualTotalOpexPercent = actualIncome > 0 ? (actualTotalOpex / actualIncome) * 100 : 0;
  const actualTotalCosts = actualDirectCost + actualTotalOpex;
  const actualTotalCostsPercent = actualIncome > 0 ? (actualTotalCosts / actualIncome) * 100 : 0;
  const actualEbitda = actualIncome - actualTotalCosts;
  const actualEbitdaPercent = actualIncome > 0 ? (actualEbitda / actualIncome) * 100 : 0;

  // Función para determinar el estado de comparación
  const getComparisonStatus = (actual, ideal, isLowerBetter = false) => {
    if (!ideal) return 'neutral';
    const diff = isLowerBetter ? ideal - actual : actual - ideal;
    const percentDiff = (diff / ideal) * 100;
    
    if (isLowerBetter) {
      if (actual <= ideal) return 'excellent';
      if (percentDiff >= -10) return 'warning';
      return 'critical';
    } else {
      if (actual >= ideal) return 'excellent';
      if (percentDiff >= -10) return 'warning';
      return 'critical';
    }
  };

  const statusColors = {
    excellent: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    critical: 'bg-red-100 text-red-700',
    neutral: 'bg-gray-100 text-gray-600'
  };

  const statusIcons = {
    excellent: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    critical: <XCircle className="w-4 h-4 text-red-500" />,
    neutral: null
  };

  // Componente para filas de detalle CON soporte para ideal personalizado
  // isDirectCost indica si es el FOOD COST principal (naranja) vs FOOD COST en OPEX (azul)
  const DetailRow = ({ label, actualAmount, actualPercent, currency, centerName, canEdit = false, isDirectCost = false }) => {
    // Para item_budgets, usamos el centerName real (FOOD COST o el nombre del centro OPEX)
    const idealPercent = getItemIdealPercent(centerName, label);
    const hasIdeal = idealPercent !== null;
    const totalIncome = actualData?.totalIncome || 0;
    const idealAmount = hasIdeal && totalIncome > 0 ? (idealPercent / 100) * totalIncome : null;
    const diffPercent = hasIdeal ? actualPercent - idealPercent : null;
    const isOverBudget = hasIdeal && actualPercent > idealPercent;

    return (
      <tr className="bg-gray-50/50 border-b border-gray-100 group">
        <td className="py-2 px-4 text-sm text-gray-600" style={{ paddingLeft: '56px' }}>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            {label}
            {canEdit && onUpdateItemBudgets && (
              <button
                onClick={() => {
                  // Pasar isDirectCost para saber qué límite aplicar
                  setEditingItem({ centerName, itemName: label, isDirectCost });
                  setEditPercent(idealPercent?.toString() || '');
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                title="Editar % ideal"
              >
                <Pencil className="w-3 h-3 text-gray-500" />
              </button>
            )}
          </div>
        </td>
        <td className="py-2 px-4 text-right font-mono text-sm bg-purple-50/30">
          {hasIdeal ? formatCurrency(idealAmount, currency) : <span className="text-gray-400 text-xs">—</span>}
        </td>
        <td className="py-2 px-4 text-right font-mono text-sm bg-purple-50/30">
          {hasIdeal ? `${idealPercent.toFixed(1)}%` : <span className="text-gray-400 text-xs">—</span>}
        </td>
        <td className="py-2 px-4 text-right font-mono text-sm text-gray-700">
          {formatCurrency(actualAmount, currency)}
        </td>
        <td className="py-2 px-4 text-right font-mono text-sm text-gray-700">
          {actualPercent.toFixed(1)}%
        </td>
        <td className="py-2 px-4 text-center">
          {hasIdeal ? (
            <div className="flex items-center justify-center gap-1">
              {isOverBudget ? (
                <XCircle className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className={`text-xs font-mono ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
              </span>
            </div>
          ) : (
            <span className="text-gray-400 text-xs">—</span>
          )}
        </td>
      </tr>
    );
  };

  // Componente de fila
  const TableRow = ({ label, idealAmount, idealPercent, actualAmount, actualPercent, isHeader, isTotal, isSubtotal, isBold, indent = 0, isLowerBetter = false, expandable = false, expanded = false, onToggle = null }) => {
    const bgClass = isHeader ? 'bg-slate-800 text-white' : 
                    isTotal ? 'bg-slate-100' : 
                    isSubtotal ? 'bg-gray-50' : 
                    'bg-white hover:bg-gray-50';
    
    const status = !isHeader ? getComparisonStatus(
      isLowerBetter ? actualPercent : actualAmount, 
      isLowerBetter ? idealPercent : idealAmount, 
      isLowerBetter
    ) : 'neutral';

    const diffAmount = actualAmount - idealAmount;
    const diffPercent = actualPercent - idealPercent;

    return (
      <tr className={`${bgClass} border-b border-gray-200 transition-colors`}>
        <td className={`py-3 px-4 ${isBold ? 'font-bold' : ''}`} style={{ paddingLeft: `${16 + indent * 20}px` }}>
          <div className="flex items-center gap-2">
            {expandable && (
              <button onClick={onToggle} className="p-0.5 hover:bg-gray-200 rounded">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
            {!expandable && indent > 0 && <span className="w-5" />}
            <span>{label}</span>
          </div>
        </td>
        {/* IDEAL */}
        <td className={`py-3 px-4 text-right font-mono ${isHeader ? 'font-bold' : ''} bg-purple-50/50`}>
          {isHeader ? idealAmount : formatCurrency(idealAmount, currency)}
        </td>
        <td className={`py-3 px-4 text-right font-mono ${isHeader ? 'font-bold' : ''} bg-purple-50/50`}>
          {isHeader ? idealPercent : `${idealPercent.toFixed(1)}%`}
        </td>
        {/* ACTUAL */}
        <td className={`py-3 px-4 text-right font-mono ${isHeader ? 'font-bold' : ''}`}>
          {isHeader ? actualAmount : formatCurrency(actualAmount, currency)}
        </td>
        <td className={`py-3 px-4 text-right font-mono ${isHeader ? 'font-bold' : ''}`}>
          {isHeader ? actualPercent : `${actualPercent.toFixed(1)}%`}
        </td>
        {/* DIFERENCIA */}
        <td className={`py-3 px-4 text-center ${isHeader ? '' : ''}`}>
          {!isHeader && (
            <div className="flex items-center justify-center gap-1">
              {statusIcons[status]}
              <span className={`text-xs font-mono ${diffPercent > 0 ? (isLowerBetter ? 'text-red-600' : 'text-emerald-600') : (isLowerBetter ? 'text-emerald-600' : 'text-red-600')}`}>
                {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
              </span>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="py-3 px-4 text-left font-bold">CONCEPTO</th>
              <th colSpan={2} className="py-3 px-4 text-center font-bold bg-purple-900/50">
                IDEAL (Proforma)
              </th>
              <th colSpan={2} className="py-3 px-4 text-center font-bold bg-blue-900/50">
                {monthLabel || 'MES ACTUAL'}
              </th>
              <th className="py-3 px-4 text-center font-bold">DIFERENCIA</th>
            </tr>
            <tr className="bg-slate-700 text-white text-sm">
              <th className="py-2 px-4"></th>
              <th className="py-2 px-4 text-right bg-purple-900/30">Monto</th>
              <th className="py-2 px-4 text-right bg-purple-900/30">%</th>
              <th className="py-2 px-4 text-right bg-blue-900/30">Monto</th>
              <th className="py-2 px-4 text-right bg-blue-900/30">%</th>
              <th className="py-2 px-4 text-center">vs Ideal</th>
            </tr>
          </thead>
          <tbody>
            {/* INGRESOS */}
            <tr className="bg-emerald-600 text-white">
              <td colSpan={6} className="py-2 px-4 font-bold text-sm">📈 INGRESOS NETOS</td>
            </tr>
            <TableRow
              label="Ingresos Netos"
              idealAmount={idealIncome}
              idealPercent={100}
              actualAmount={actualIncome}
              actualPercent={100}
              isBold
            />

            {/* FOOD COST */}
            <tr className="bg-amber-600 text-white">
              <td colSpan={6} className="py-2 px-4 font-bold text-sm">📉 FOOD COST</td>
            </tr>
            <TableRow
              label="Costo de Insumos"
              idealAmount={idealDirectCost}
              idealPercent={idealDirectCostPercent}
              actualAmount={actualDirectCost}
              actualPercent={actualDirectCostPercent}
              isLowerBetter
              expandable={Object.keys(actualData?.costByCenter?.['FOOD COST']?.details || {}).length > 0}
              expanded={expandedSections['FOOD_COST']}
              onToggle={() => toggleSection('FOOD_COST')}
            />
            {expandedSections['FOOD_COST'] && (
              <>
                {Object.entries(actualData?.costByCenter?.['FOOD COST']?.details || {})
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([detailName, detailData]) => (
                    <DetailRow
                      key={detailName}
                      label={detailName}
                      actualAmount={detailData.total || 0}
                      actualPercent={detailData.percentOfSales || 0}
                      currency={currency}
                      centerName="FOOD COST"
                      canEdit={true}
                      isDirectCost={true}
                    />
                  ))
                }

              </>
            )}

            {/* MARGEN OPERACIONAL */}
            <tr className="bg-teal-100">
              <td className="py-3 px-4 font-bold text-teal-800">MARGEN OPERACIONAL</td>
              <td className="py-3 px-4 text-right font-mono font-bold bg-purple-50">{formatCurrency(idealGrossMargin, currency)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold bg-purple-50">{idealGrossMarginPercent.toFixed(1)}%</td>
              <td className={`py-3 px-4 text-right font-mono font-bold ${actualGrossMargin >= idealGrossMargin ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(actualGrossMargin, currency)}
              </td>
              <td className={`py-3 px-4 text-right font-mono font-bold ${actualGrossMarginPercent >= idealGrossMarginPercent ? 'text-emerald-600' : 'text-red-600'}`}>
                {actualGrossMarginPercent.toFixed(1)}%
              </td>
              <td className="py-3 px-4 text-center">
                {actualGrossMarginPercent >= idealGrossMarginPercent ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                )}
              </td>
            </tr>

            {/* CENTROS DE COSTO */}
            <tr className="bg-blue-600 text-white">
              <td colSpan={6} className="py-2 px-4 font-bold text-sm">📊 CENTROS DE COSTO (OPEX)</td>
            </tr>

            {costCentersBudget.map((center, idx) => {
              const actualCenter = actualData?.costByCenter?.[center.name.toUpperCase()] || { total: 0, percent: 0, details: {} };
              const centerKey = `CENTER_${center.name.toUpperCase()}`;
              const hasDetails = Object.keys(actualCenter.details || {}).length > 0;
              
              return (
                <React.Fragment key={idx}>
                  <TableRow
                    label={center.name}
                    idealAmount={center.amount || 0}
                    idealPercent={center.percent || 0}
                    actualAmount={actualCenter.total || 0}
                    actualPercent={actualCenter.percent || 0}
                    indent={1}
                    isLowerBetter
                    expandable={hasDetails}
                    expanded={expandedSections[centerKey]}
                    onToggle={() => toggleSection(centerKey)}
                  />
                  {expandedSections[centerKey] && (
                    <>
                      {Object.entries(actualCenter.details || {})
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([detailName, detailData]) => (
                          <DetailRow
                            key={detailName}
                            label={detailName}
                            actualAmount={detailData.total || 0}
                            actualPercent={detailData.percentOfSales || 0}
                            currency={currency}
                            centerName={center.name.toUpperCase()}
                            canEdit={true}
                          />
                        ))
                      }

                    </>
                  )}
                </React.Fragment>
              );
            })}

            {/* TOTAL COSTOS OPERACIÓN */}
            <tr className="bg-slate-200">
              <td className="py-3 px-4 font-bold">COSTOS DE OPERACIÓN</td>
              <td className="py-3 px-4 text-right font-mono font-bold bg-purple-100">{formatCurrency(idealTotalCosts, currency)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold bg-purple-100">{idealTotalCostsPercent.toFixed(1)}%</td>
              <td className={`py-3 px-4 text-right font-mono font-bold ${actualTotalCosts <= idealTotalCosts ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(actualTotalCosts, currency)}
              </td>
              <td className={`py-3 px-4 text-right font-mono font-bold ${actualTotalCostsPercent <= idealTotalCostsPercent ? 'text-emerald-600' : 'text-red-600'}`}>
                {actualTotalCostsPercent.toFixed(1)}%
              </td>
              <td className="py-3 px-4 text-center">
                <span className={`text-sm font-mono ${actualTotalCostsPercent <= idealTotalCostsPercent ? 'text-emerald-600' : 'text-red-600'}`}>
                  {(actualTotalCostsPercent - idealTotalCostsPercent) > 0 ? '+' : ''}
                  {(actualTotalCostsPercent - idealTotalCostsPercent).toFixed(1)}%
                </span>
              </td>
            </tr>

            {/* EBITDA */}
            <tr className={`${actualEbitda >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <td className="py-4 px-4 font-bold text-lg flex items-center gap-2">
                {actualEbitda >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                EBITDA
              </td>
              <td className="py-4 px-4 text-right font-mono font-bold text-lg bg-purple-100">{formatCurrency(idealEbitda, currency)}</td>
              <td className="py-4 px-4 text-right font-mono font-bold text-lg bg-purple-100">{idealEbitdaPercent.toFixed(1)}%</td>
              <td className={`py-4 px-4 text-right font-mono font-bold text-lg ${actualEbitda >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {actualEbitda < 0 ? '-' : ''}{formatCurrency(Math.abs(actualEbitda), currency)}
              </td>
              <td className={`py-4 px-4 text-right font-mono font-bold text-lg ${actualEbitda >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {actualEbitdaPercent.toFixed(1)}%
              </td>
              <td className="py-4 px-4 text-center">
                <Badge className={actualEbitda >= idealEbitda ? 'bg-emerald-500' : 'bg-red-500'}>
                  {(actualEbitdaPercent - idealEbitdaPercent) > 0 ? '+' : ''}
                  {(actualEbitdaPercent - idealEbitdaPercent).toFixed(1)}%
                </Badge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Dialog para editar % ideal de un ítem */}
      <Dialog open={!!editingItem} onOpenChange={() => { setEditingItem(null); setErrorMessage(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Presupuesto Ideal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Centro de Costo</p>
              <p className="font-medium">{editingItem?.centerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Ítem</p>
              <p className="font-medium">{editingItem?.itemName}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Porcentaje Ideal (% sobre ventas)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max={getCenterMaxPercent(editingItem?.centerName, editingItem?.isDirectCost) - getAssignedPercentForCenter(editingItem?.centerName, editingItem?.itemName)}
                  value={editPercent}
                  onChange={(e) => { setEditPercent(e.target.value); setErrorMessage(''); }}
                  placeholder="Ej: 1.5"
                  className="w-32"
                />
                <span className="text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Máximo disponible: {(getCenterMaxPercent(editingItem?.centerName, editingItem?.isDirectCost) - getAssignedPercentForCenter(editingItem?.centerName, editingItem?.itemName)).toFixed(1)}% 
                ({editingItem?.isDirectCost ? 'Food Cost Directo' : 'Centro de Costo'}: {getCenterMaxPercent(editingItem?.centerName, editingItem?.isDirectCost)}%)
              </p>
              {errorMessage && (
                <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded border border-red-200">
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {getItemIdealPercent(editingItem?.centerName, editingItem?.itemName) !== null && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  handleDeleteItemBudget(editingItem.centerName, editingItem.itemName);
                  setEditingItem(null);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveItemPercent}>
              <Save className="w-4 h-4 mr-1" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </Card>
  );
}