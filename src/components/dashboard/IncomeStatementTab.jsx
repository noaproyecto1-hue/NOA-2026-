import React, { useState, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, Target
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import MonthDropdownSelector from './MonthDropdownSelector';
import ProformaFinanciera from '@/components/analysis/ProformaFinanciera';
import IncomeStatementView from './IncomeStatementView';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function IncomeStatementTab({
  sales = [],
  supplyCosts = [],
  opex = [],
  previousSales = [],
  previousSupplyCosts = [],
  previousOpex = [],
  quarterAnalysis: quarterAnalysisProp = null,
  restaurant,
  currency,
  dateRange,
  onDateChange,
  dataPrefiltered = false,
  dashboardViewMode = 'monthly',
  supplyItems = [],
}) {
  const queryClient = useQueryClient();

  // Mutación para actualizar item_budgets del restaurante
  const updateItemBudgetsMutation = useMutation({
    mutationFn: async (newItemBudgets) => {
      const updatedProforma = {
        ...restaurant.proforma,
        item_budgets: newItemBudgets
      };
      await base44.entities.Restaurant.update(restaurant.id, { proforma: updatedProforma });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
    }
  });
  const [viewMode, setViewMode] = useState('estado'); // 'estado' o 'proforma'


  const costCenters = restaurant?.config?.cost_centers || [];

  // Período anterior
  const previousMonth = useMemo(() => ({
    from: startOfMonth(subMonths(dateRange.from, 1)),
    to: endOfMonth(subMonths(dateRange.from, 1))
  }), [dateRange]);

  const filterByDate = (items, range, useDateTimeField = false) => {
    return items.filter(item => {
      const itemDate = new Date(useDateTimeField ? (item.date_time || item.date) : item.date);
      return itemDate >= range.from && itemDate <= range.to;
    });
  };

  // Si los datos ya vienen prefiltrados del backend, usarlos directamente
  const currentSales = dataPrefiltered 
    ? sales.filter(s => !s.is_cancelled) 
    : filterByDate(sales.filter(s => !s.is_cancelled), dateRange, true);
  const prevSalesFiltered = dataPrefiltered 
    ? previousSales.filter(s => !s.is_cancelled) 
    : filterByDate(sales.filter(s => !s.is_cancelled), previousMonth, true);
  const currentSupplyCosts = dataPrefiltered 
    ? supplyCosts 
    : filterByDate(supplyCosts.filter(c => c.payment_status === 'pagado'), dateRange);
  const prevSupplyCostsFiltered = dataPrefiltered 
    ? previousSupplyCosts 
    : filterByDate(supplyCosts.filter(c => c.payment_status === 'pagado'), previousMonth);
  const currentOpex = dataPrefiltered 
    ? opex 
    : filterByDate(opex.filter(o => o.payment_status === 'pagado'), dateRange);
  const prevOpexFiltered = dataPrefiltered 
    ? previousOpex 
    : filterByDate(opex.filter(o => o.payment_status === 'pagado'), previousMonth);

  // Calcular ventas netas (sin IVA)
  // IMPORTANTE: tanto subtotal como total_amount de FUDO vienen con IVA incluido
  // Siempre calcular el neto dividiendo por (1 + taxRate/100) cuando applies_tax es true
  const getNetSale = (sale) => {
    const amount = sale.total_amount || sale.subtotal || 0;
    if (!amount) return 0;
    // Si no aplica impuesto, el monto ya es neto
    if (sale.applies_tax === false) return amount;
    const taxRate = sale.tax_rate || 19;
    return Math.round(amount / (1 + taxRate / 100));
  };

  // Análisis de ingresos — estructura jerárquica: Local / Delivery > orígenes
  const incomeAnalysis = useMemo(() => {
    const analysis = { lines: {}, total: 0, prevTotal: 0 };

    const ensureLine = (name) => {
      if (!analysis.lines[name]) analysis.lines[name] = { total: 0, prevTotal: 0, subLines: {} };
    };
    const ensureSubLine = (parent, name) => {
      if (!analysis.lines[parent].subLines[name]) analysis.lines[parent].subLines[name] = { total: 0, prevTotal: 0 };
    };

    const normalizeDeliverySource = (raw) => {
      if (!raw) return 'Delivery (sin origen)';
      const trimmed = raw.trim().toLowerCase();
      if (trimmed.includes('uber')) return 'Uber Eats';
      if (trimmed.includes('pedidos') || trimmed.includes('peya')) return 'PedidosYa';
      if (trimmed.includes('rappi')) return 'Rappi';
      if (trimmed.includes('directo')) return 'Delivery Directo';
      return raw.trim().replace(/\b\w/g, c => c.toUpperCase());
    };

    currentSales.forEach(sale => {
      const amount = getNetSale(sale);
      analysis.total += amount;
      if (sale.sale_type === 'delivery') {
        ensureLine('Delivery');
        analysis.lines['Delivery'].total += amount;
        const source = normalizeDeliverySource(sale.delivery_source);
        ensureSubLine('Delivery', source);
        analysis.lines['Delivery'].subLines[source].total += amount;
      } else {
        ensureLine('Venta en Local');
        analysis.lines['Venta en Local'].total += amount;
      }
    });

    prevSalesFiltered.forEach(sale => {
      const amount = getNetSale(sale);
      analysis.prevTotal += amount;
      if (sale.sale_type === 'delivery') {
        ensureLine('Delivery');
        analysis.lines['Delivery'].prevTotal += amount;
        const source = normalizeDeliverySource(sale.delivery_source);
        ensureSubLine('Delivery', source);
        analysis.lines['Delivery'].subLines[source].prevTotal += amount;
      } else {
        ensureLine('Venta en Local');
        analysis.lines['Venta en Local'].prevTotal += amount;
      }
    });

    Object.keys(analysis.lines).forEach(line => {
      const data = analysis.lines[line];
      data.percentOfTotal = analysis.total > 0 ? (data.total / analysis.total) * 100 : 0;
      data.changePercent = data.prevTotal > 0 ? ((data.total - data.prevTotal) / data.prevTotal) * 100 : 0;
      Object.keys(data.subLines || {}).forEach(sub => {
        data.subLines[sub].percentOfTotal = analysis.total > 0 ? (data.subLines[sub].total / analysis.total) * 100 : 0;
      });
    });

    return analysis;
  }, [currentSales, prevSalesFiltered]);

  const totalIncome = incomeAnalysis.total;
  const prevTotalIncome = incomeAnalysis.prevTotal;

  // Mapa de insumo -> categoría real desde el catálogo de SupplyItems
  const supplyItemCategoryMap = useMemo(() => {
    const map = {};
    supplyItems.forEach(item => {
      if (item.name && item.category) {
        map[item.name.trim().toLowerCase()] = item.category;
      }
    });
    return map;
  }, [supplyItems]);

  // Resolver la categoría real de un SupplyCost:
  // 1. Si supply_category es un centro genérico (FOOD COST, EXPLOTACION, etc.) o vacío, buscar por nombre del insumo en el catálogo
  // 2. Si no, usar supply_category tal cual
  const resolveCategory = (cost) => {
    const rawCat = (cost.supply_category || '').trim().toUpperCase();
    const genericCenters = ['FOOD COST', 'EXPLOTACION', 'GENERAL', ''];
    
    if (genericCenters.includes(rawCat)) {
      // Buscar la categoría real por nombre del insumo
      const itemName = (cost.supply_item_name || '').trim().toLowerCase();
      if (itemName && supplyItemCategoryMap[itemName]) {
        return supplyItemCategoryMap[itemName];
      }
      // Fallback: el nombre del item como categoría, o General
      return cost.supply_category || 'General';
    }
    return cost.supply_category || 'General';
  };

  // Análisis de costos de insumos (food cost) con jerarquía: Categoría > Ítem
  const foodCostAnalysis = useMemo(() => {
    const analysis = {};

    const initCenter = (name) => {
      if (!analysis[name]) analysis[name] = { total: 0, prevTotal: 0, categories: {} };
    };
    const initCategory = (center, cat) => {
      if (!analysis[center].categories[cat]) analysis[center].categories[cat] = { total: 0, items: {} };
    };
    const initItem = (center, cat, item) => {
      if (!analysis[center].categories[cat].items[item]) analysis[center].categories[cat].items[item] = { total: 0 };
    };

    currentSupplyCosts.forEach(cost => {
      // Si tiene invoice_items, desglosar cada insumo individual
      if (cost.invoice_items && cost.invoice_items.length > 0) {
        // Prorratear total_cost (con IVA) entre items en proporción a sus subtotales netos
        const totalCostWithTax = cost.total_cost || 0;
        const sumSubtotals = cost.invoice_items.reduce((s, i) => s + (i.subtotal || 0), 0);

        cost.invoice_items.forEach(invItem => {
          const itemCategory = invItem.category || resolveCategory(cost);
          let centerName = 'FOOD COST';
          const centerConfig = costCenters.find(c => c.items?.some(i => i.toUpperCase() === itemCategory.toUpperCase()));
          if (centerConfig) centerName = centerConfig.name;
          const itemName = invItem.name || 'Sin nombre';
          // Monto prorrateado del total con IVA
          const itemAmt = sumSubtotals > 0 
            ? Math.round((invItem.subtotal || 0) / sumSubtotals * totalCostWithTax) 
            : 0;

          initCenter(centerName);
          initCategory(centerName, itemCategory);
          initItem(centerName, itemCategory, itemName);
          analysis[centerName].total += itemAmt;
          analysis[centerName].categories[itemCategory].total += itemAmt;
          analysis[centerName].categories[itemCategory].items[itemName].total += itemAmt;
        });
      } else {
        // Compra de un solo insumo
        let centerName = 'FOOD COST';
        const category = resolveCategory(cost);
        const centerConfig = costCenters.find(c => c.items?.some(item => item.toUpperCase() === category.toUpperCase()));
        if (centerConfig) centerName = centerConfig.name;
        const itemName = cost.supply_item_name || category;

        initCenter(centerName);
        initCategory(centerName, category);
        initItem(centerName, category, itemName);
        const amt = cost.total_cost || 0;
        analysis[centerName].total += amt;
        analysis[centerName].categories[category].total += amt;
        analysis[centerName].categories[category].items[itemName].total += amt;
      }
    });

    prevSupplyCostsFiltered.forEach(cost => {
      let centerName = 'FOOD COST';
      const category = resolveCategory(cost);
      const centerConfig = costCenters.find(c => c.items?.some(item => item.toUpperCase() === category.toUpperCase()));
      if (centerConfig) centerName = centerConfig.name;

      initCenter(centerName);
      analysis[centerName].prevTotal += cost.total_cost || 0;
    });

    return analysis;
  }, [currentSupplyCosts, prevSupplyCostsFiltered, costCenters, supplyItemCategoryMap]);

  // Análisis de opex con detalle: Centro de Costo → Categoría → Ítem (descripción)
  const opexAnalysis = useMemo(() => {
    const analysis = {};
    const opexToCenter = {
      'payroll': 'PAYROLL/RRHH', 'rent': 'REAL STATE/RENTA', 'utilities': 'GASTOS FIJOS',
      'maintenance': 'ADMINISTRACIÓN', 'marketing': 'MARKETING',
      'insurance': 'GASTOS FIJOS', 'licenses': 'ADMINISTRACIÓN',
      'technology': 'ADMINISTRACIÓN', 'other': 'ADMINISTRACIÓN'
    };

    const initCenter = (name) => {
      if (!analysis[name]) analysis[name] = { total: 0, prevTotal: 0, categories: {} };
    };
    const initCategory = (center, cat) => {
      if (!analysis[center].categories[cat]) analysis[center].categories[cat] = { total: 0, items: {} };
    };
    const initItem = (center, cat, item) => {
      if (!analysis[center].categories[cat].items[item]) analysis[center].categories[cat].items[item] = { total: 0 };
    };

    // Gastos fijos
    const fixedExpenses = restaurant?.config?.fixed_expenses || [];
    fixedExpenses.filter(e => e.is_active).forEach(expense => {
      const centerName = 'GASTOS FIJOS';
      const category = expense.type || 'General';
      const itemName = expense.name || 'Gasto Fijo';
      initCenter(centerName);
      initCategory(centerName, category);
      initItem(centerName, category, itemName);
      analysis[centerName].total += expense.amount || 0;
      analysis[centerName].categories[category].total += expense.amount || 0;
      analysis[centerName].categories[category].items[itemName].total += expense.amount || 0;
      analysis[centerName].prevTotal += expense.amount || 0;
    });

    currentOpex.forEach(expense => {
      // Priorizar cost_center_name del registro, luego mapeo por type
      const centerName = expense.cost_center_name || opexToCenter[expense.type] || 'ADMINISTRACIÓN';
      // Priorizar category del registro, luego usar description como categoría
      const category = expense.category || expense.description || expense.type || 'Sin categoría';
      const itemName = expense.description || 'Sin especificar';
      
      initCenter(centerName);
      initCategory(centerName, category);
      initItem(centerName, category, itemName);
      analysis[centerName].total += expense.amount || 0;
      analysis[centerName].categories[category].total += expense.amount || 0;
      analysis[centerName].categories[category].items[itemName].total += expense.amount || 0;
    });

    prevOpexFiltered.forEach(expense => {
      const centerName = expense.cost_center_name || opexToCenter[expense.type] || 'ADMINISTRACIÓN';
      initCenter(centerName);
      analysis[centerName].prevTotal += expense.amount || 0;
    });

    return analysis;
  }, [currentOpex, prevOpexFiltered, restaurant]);

  // Backward compat: combined costAnalysis for getMonthData and other calculations
  const costAnalysis = useMemo(() => {
    const combined = {};
    Object.entries(foodCostAnalysis).forEach(([name, data]) => {
      combined[name] = { ...data, type: 'supply', percentOfSales: totalIncome > 0 ? (data.total / totalIncome) * 100 : 0, prevPercentOfSales: prevTotalIncome > 0 ? (data.prevTotal / prevTotalIncome) * 100 : 0 };
    });
    Object.entries(opexAnalysis).forEach(([name, data]) => {
      combined[name] = { ...data, type: 'opex', percentOfSales: totalIncome > 0 ? (data.total / totalIncome) * 100 : 0, prevPercentOfSales: prevTotalIncome > 0 ? (data.prevTotal / prevTotalIncome) * 100 : 0 };
    });
    return combined;
  }, [foodCostAnalysis, opexAnalysis, totalIncome, prevTotalIncome]);

  const totalCosts = Object.values(costAnalysis).reduce((sum, c) => sum + c.total, 0);
  const prevTotalCosts = Object.values(costAnalysis).reduce((sum, c) => sum + c.prevTotal, 0);
  const grossProfit = totalIncome - totalCosts;
  const prevGrossProfit = prevTotalIncome - prevTotalCosts;
  const grossMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
  const prevGrossMargin = prevTotalIncome > 0 ? (prevGrossProfit / prevTotalIncome) * 100 : 0;
  const totalCostPercent = totalIncome > 0 ? (totalCosts / totalIncome) * 100 : 0;
  const prevTotalCostPercent = prevTotalIncome > 0 ? (prevTotalCosts / prevTotalIncome) * 100 : 0;

  // Función para calcular datos de cualquier mes (para ProformaFinanciera)
  const getMonthData = useMemo(() => {
    return (from, to) => {
      const monthSales = sales.filter(s => {
        if (s.is_cancelled) return false;
        const d = new Date(s.date_time || s.date);
        return d >= from && d <= to;
      });
      const monthSupply = supplyCosts.filter(s => {
        const d = new Date(s.date);
        return d >= from && d <= to;
      });
      const monthOpex = opex.filter(o => {
        const d = new Date(o.date);
        return d >= from && d <= to;
      });

      const monthIncome = monthSales.reduce((sum, s) => sum + getNetSale(s), 0);
      
      // Supply costs by center
      const centerData = {};
      const opexToCenter = {
        'payroll': 'PAYROLL/RRHH', 'rent': 'REAL STATE/RENTA', 'utilities': 'GASTOS FIJOS',
        'maintenance': 'ADMINISTRACIÓN', 'marketing': 'MARKETING',
        'insurance': 'GASTOS FIJOS', 'licenses': 'ADMINISTRACIÓN',
        'technology': 'ADMINISTRACIÓN', 'other': 'ADMINISTRACIÓN'
      };

      let totalSupply = 0;
      monthSupply.forEach(cost => {
        let centerName = 'FOOD COST';
        const category = cost.supply_category || 'General';
        const centerConfig = costCenters.find(c => c.items?.some(item => item.toUpperCase() === category.toUpperCase()));
        if (centerConfig) centerName = centerConfig.name;
        if (!centerData[centerName.toUpperCase()]) centerData[centerName.toUpperCase()] = { total: 0, percent: 0 };
        centerData[centerName.toUpperCase()].total += cost.total_cost || 0;
        totalSupply += cost.total_cost || 0;
      });

      let totalOpexAmt = 0;
      // Gastos fijos
      const fixedExpenses = restaurant?.config?.fixed_expenses || [];
      fixedExpenses.filter(e => e.is_active).forEach(expense => {
        const cn = 'GASTOS FIJOS';
        if (!centerData[cn]) centerData[cn] = { total: 0, percent: 0 };
        centerData[cn].total += expense.amount || 0;
        totalOpexAmt += expense.amount || 0;
      });

      monthOpex.forEach(expense => {
        // Priorizar cost_center_name (campo real), luego fallback por type (legacy)
        const cn = (expense.cost_center_name || opexToCenter[expense.type] || 'ADMINISTRACIÓN').toUpperCase();
        if (!centerData[cn]) centerData[cn] = { total: 0, percent: 0 };
        centerData[cn].total += expense.amount || 0;
        totalOpexAmt += expense.amount || 0;
      });

      return {
        totalIncome: monthIncome,
        totalSupplyCost: totalSupply,
        totalOpex: totalOpexAmt,
        costByCenter: centerData
      };
    };
  }, [sales, supplyCosts, opex, costCenters, restaurant]);

  const totalFoodCost = Object.values(foodCostAnalysis).reduce((sum, c) => sum + c.total, 0);
  const totalFoodCostPercent = totalIncome > 0 ? (totalFoodCost / totalIncome) * 100 : 0;
  const totalOpexAmount = Object.values(opexAnalysis).reduce((sum, c) => sum + c.total, 0);
  const totalOpexPercent = totalIncome > 0 ? (totalOpexAmount / totalIncome) * 100 : 0;
  
  // Margen operacional (después de food cost)
  const operationalMargin = totalIncome - totalFoodCost;
  const operationalMarginPercent = totalIncome > 0 ? (operationalMargin / totalIncome) * 100 : 0;

  // === PROMEDIO TRIMESTRAL (pre-aggregated from backend) ===
  const quarterAnalysis = useMemo(() => {
    if (!quarterAnalysisProp) {
      return { avgIncome: 0, avgSupply: 0, avgOpex: 0, avgTotalCosts: 0, avgEbitda: 0, avgOperationalMargin: 0, centerAvgs: {}, hasData: false };
    }
    const qTotalIncome = quarterAnalysisProp.totalIncome || 0;
    const qTotalSupply = quarterAnalysisProp.totalSupply || 0;
    const qTotalOpex = quarterAnalysisProp.totalOpex || 0;

    const avgIncome = qTotalIncome / 3;
    const avgSupply = qTotalSupply / 3;
    const avgOpex = qTotalOpex / 3;
    const avgTotalCosts = avgSupply + avgOpex;
    const avgEbitda = avgIncome - avgTotalCosts;
    const avgOperationalMargin = avgIncome - avgSupply;

    // By cost center (pre-aggregated from backend)
    const centerAvgs = {};
    const supplyCostsByCat = quarterAnalysisProp.supplyCostsByCategory || {};
    Object.entries(supplyCostsByCat).forEach(([category, total]) => {
      let centerName = 'FOOD COST';
      const centerConfig = costCenters.find(c => c.items?.some(item => item.toUpperCase() === category.toUpperCase()));
      if (centerConfig) centerName = centerConfig.name;
      centerAvgs[centerName] = (centerAvgs[centerName] || 0) + total;
    });
    const opexByCenter = quarterAnalysisProp.opexByCenter || {};
    Object.entries(opexByCenter).forEach(([center, total]) => {
      centerAvgs[center] = (centerAvgs[center] || 0) + total;
    });
    // Divide by 3 for monthly average
    Object.keys(centerAvgs).forEach(k => { centerAvgs[k] = centerAvgs[k] / 3; });

    return {
      avgIncome, avgSupply, avgOpex, avgTotalCosts, avgEbitda, avgOperationalMargin,
      centerAvgs,
      hasData: qTotalIncome > 0 || qTotalSupply > 0 || qTotalOpex > 0
    };
  }, [quarterAnalysisProp, costCenters]);

  // Show comparison column? Monthly = trimestral, Annual = año anterior, Weekly = hidden
  const showComparisonCol = dashboardViewMode !== 'weekly';

  // Period label based on dashboard view mode
  const periodLabel = useMemo(() => {
    if (dashboardViewMode === 'annual') {
      return `Año ${format(dateRange.from, 'yyyy')}`;
    }
    if (dashboardViewMode === 'weekly') {
      return `Semana del ${format(dateRange.from, "d MMM", { locale: es })} al ${format(dateRange.to, "d MMM", { locale: es })}`;
    }
    return format(dateRange.from, 'MMMM yyyy', { locale: es });
  }, [dashboardViewMode, dateRange]);

  return (
    <div className="space-y-4">
      {/* Header: Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div />
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={setViewMode} className="bg-white rounded-xl p-1 shadow-sm border">
            <TabsList className="bg-transparent">
              <TabsTrigger 
                value="estado" 
                className="data-[state=active]:bg-violet-600 data-[state=active]:text-white px-3 py-1.5 rounded-lg gap-1.5 text-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Estado de Resultados
              </TabsTrigger>
              <TabsTrigger 
                value="proforma" 
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white px-3 py-1.5 rounded-lg gap-1.5 text-sm"
              >
                <Target className="w-3.5 h-3.5" />
                Proforma Financiera
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Contenido */}
      <div className="space-y-4">

          {/* Vista Proforma Financiera */}
          {viewMode === 'proforma' && (
            <ProformaFinanciera
              proforma={restaurant?.proforma}
              currency={currency}
              getMonthData={getMonthData}
              currentDateRange={dateRange}
              dashboardViewMode={dashboardViewMode}
              allSales={sales}
              allSupplyCosts={supplyCosts}
              allOpex={opex}
              restaurant={restaurant}
            />
          )}

        {/* Estado de Resultados - Vista colapsable */}
        {viewMode === 'estado' && (
          <IncomeStatementView
            incomeAnalysis={incomeAnalysis}
            totalIncome={totalIncome}
            prevTotalIncome={prevTotalIncome}
            foodCostAnalysis={foodCostAnalysis}
            opexAnalysis={opexAnalysis}
            operationalMargin={operationalMargin}
            operationalMarginPercent={operationalMarginPercent}
            totalCosts={totalCosts}
            totalCostPercent={totalCostPercent}
            grossProfit={grossProfit}
            grossMargin={grossMargin}
            prevGrossMargin={prevGrossMargin}
            quarterAnalysis={quarterAnalysis}
            showComparisonCol={showComparisonCol}
            dashboardViewMode={dashboardViewMode}
            currency={currency}
            proforma={restaurant?.proforma}
          />
        )}
      </div>
    </div>
  );
}