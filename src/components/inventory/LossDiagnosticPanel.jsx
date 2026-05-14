import React, { useMemo, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, AlertTriangle, Trash2, TrendingUp, ChefHat, ShieldAlert, ChevronDown, ChevronUp, HelpCircle, Truck, Clock, TrendingDown, PackagePlus, ArrowUpDown } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, getCurrencySymbol } from '@/components/utils/currencyHelper';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatDateInUserTz } from '@/components/utils/timezoneHelper';

// Diagnóstico de cada insumo con pérdida:
// DIAGNOSTIC LOGIC — CLEAR AND CORRECT:
// 
// When you do an inventory count, loss = expected_stock - actual_stock.
// The expected_stock ALREADY includes ALL documented movements:
//   ✅ Purchases (stock added for received qty)
//   ✅ Sales/recipes (theoretical qty deducted)  
//   ✅ Merma/waste (deducted when registered)
//   ✅ External losses (purchase only adds received, not invoiced)
//   ✅ Samplings, transfers, adjustments
//
// Therefore, the count loss is what's MISSING beyond everything documented.
// The ONLY thing that can explain this is:
//   1. RECIPE DEVIATION: staff uses MORE than theoretical → system deducts theoretical,
//      but extra amount is consumed without stock movement → shows up as count loss
//   2. UNEXPLAINED: everything else (theft, count error, unregistered use)
//
// Merma and external losses are CONTEXT only (already in expected stock).
// Price inflation is CONTEXT only (affects $ value, not physical quantity).

export default function LossDiagnosticPanel({
  inventoryCounts = [],
  wasteRecords = [],
  supplyItems = [],
  supplyCosts = [],
  stockMovements = [],
  recipes = [],
  recipeSamples = [],
  selectedRestaurant = 'all',
  currency = 'USD'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('current');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [expandedItem, setExpandedItem] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const sym = getCurrencySymbol(currency);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (filterMonth === 'current') {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    } else if (filterMonth === 'last') {
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10), to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10) };
    }
    return { from: '2020-01-01', to: new Date().toISOString().slice(0, 10) };
  }, [filterMonth]);

  const diagnostics = useMemo(() => {
    const restFilter = (item) => selectedRestaurant === 'all' || item.restaurant_id === selectedRestaurant;
    const dateFilter = (date) => date >= dateRange.from && date <= dateRange.to;

    // ALL counts for this restaurant sorted by (date ASC, created_date ASC)
    // This gives us a reliable chronological order even when multiple counts share a date.
    const allCounts = inventoryCounts
      .filter(c => restFilter(c))
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.created_date || '').localeCompare(b.created_date || ''));

    // 1. Pérdidas por conteo en el período seleccionado
    const periodCounts = allCounts.filter(c => dateFilter(c.date));
    const lossByItem = {};
    const surplusByItem = {};
    periodCounts.forEach(c => {
      if (c.loss_quantity > 0) {
        if (!lossByItem[c.supply_name]) lossByItem[c.supply_name] = { qty: 0, value: 0, counts: [] };
        lossByItem[c.supply_name].qty += c.loss_quantity;
        lossByItem[c.supply_name].value += c.loss_value || 0;
        lossByItem[c.supply_name].counts.push(c);
      } else if (c.loss_quantity < 0) {
        // Sobrante: actual > esperado
        if (!surplusByItem[c.supply_name]) surplusByItem[c.supply_name] = { qty: 0, value: 0, counts: [] };
        surplusByItem[c.supply_name].qty += Math.abs(c.loss_quantity);
        surplusByItem[c.supply_name].value += Math.abs(c.loss_value || 0);
        surplusByItem[c.supply_name].counts.push(c);
      }
    });

    if (Object.keys(lossByItem).length === 0 && Object.keys(surplusByItem).length === 0) return { losses: [], surpluses: [] };

    // For each item with loss, determine the diagnostic window:
    // FROM = date of the previous count for this item (the one right before the earliest loss count)
    // TO = date of the latest loss count in the period
    //
    // CRITICAL: We identify the "previous count" by finding the earliest loss count record
    // in the period, then looking for the last count record for the same supply that was
    // created BEFORE that record (using created_date as tiebreaker when dates match).
    const diagnosticWindows = {};
    Object.entries(lossByItem).forEach(([name, lossData]) => {
      // Sort loss counts chronologically (date + created_date)
      const sortedLossCounts = [...lossData.counts].sort((a, b) => 
        (a.date || '').localeCompare(b.date || '') || (a.created_date || '').localeCompare(b.created_date || '')
      );
      const earliestLossCount = sortedLossCounts[0];
      const latestLossCount = sortedLossCounts[sortedLossCounts.length - 1];

      // All counts for this supply, sorted chronologically
      const allCountsForItem = allCounts.filter(c => c.supply_name === name);
      
      // Find the index of the earliest loss count in the full sorted list
      const earliestLossIdx = allCountsForItem.findIndex(c => c.id === earliestLossCount.id);
      
      let windowFrom;
      if (earliestLossIdx > 0) {
        // The previous count is the one right before in chronological order
        windowFrom = allCountsForItem[earliestLossIdx - 1].date;
      } else {
        // No previous count at all: use item creation date or first purchase
        const item = supplyItems.find(s => s.name === name && restFilter(s));
        const itemCreated = item?.created_date ? item.created_date.slice(0, 10) : null;
        const firstPurchase = supplyCosts
          .filter(sc => restFilter(sc) && sc.supply_item_name === name)
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0]?.date;
        
        const candidates = [itemCreated, firstPurchase].filter(Boolean);
        windowFrom = candidates.length > 0 ? candidates.sort()[0] : '2020-01-01';
      }

      diagnosticWindows[name] = { from: windowFrom, to: latestLossCount.date };
    });

    // 2. Merma y pérdida externa — CONTEXT ONLY (already deducted from stock)
    // ALL waste registered through the system creates a StockMovement that deducts stock.
    // ALL external losses (faltante proveedor) adjust the purchase to only add received qty.
    // Therefore: ALL documented waste/external is ALREADY in the expected stock.
    // They are shown for CONTEXT only — they NEVER explain the count's loss.
    
    const allWaste = wasteRecords.filter(w => restFilter(w));
    const wasteByItem = {};       // Merma interna — CONTEXT only, always already deducted
    const externalLossByItem = {}; // Pérdida externa — CONTEXT only, always already deducted
    
    Object.keys(lossByItem).forEach(name => {
      const window = diagnosticWindows[name];
      const itemWaste = allWaste.filter(w => 
        w.supply_name === name && w.date >= window.from && w.date <= window.to
      );
      
      itemWaste.forEach(w => {
        const isExternal = (w.notes || '').toLowerCase().startsWith('pérdida externa');
        
        if (isExternal) {
          if (!externalLossByItem[name]) externalLossByItem[name] = { qty: 0, value: 0, details: [], alreadyDeducted: true };
          externalLossByItem[name].qty += w.quantity || 0;
          externalLossByItem[name].value += w.estimated_value || 0;
          const noteParts = (w.notes || '').split('|').reduce((acc, p) => {
            const [k, ...v] = p.split(':');
            if (k && v.length) acc[k.trim()] = v.join(':').trim();
            return acc;
          }, {});
          externalLossByItem[name].details.push({
            qty: w.quantity || 0,
            supplier: noteParts['proveedor'] || '',
            invoice: noteParts['factura'] || '',
            date: w.date
          });
        } else {
          if (!wasteByItem[name]) wasteByItem[name] = { qty: 0, value: 0, reasons: {}, entries: [], alreadyDeducted: true };
          wasteByItem[name].qty += w.quantity || 0;
          wasteByItem[name].value += w.estimated_value || 0;
          const reason = w.reason || 'otro';
          wasteByItem[name].reasons[reason] = (wasteByItem[name].reasons[reason] || 0) + (w.quantity || 0);
          // Store individual entries for detailed display
          wasteByItem[name].entries.push({
            qty: w.quantity || 0,
            reason: w.reason || 'otro',
            date: w.date,
            registeredBy: w.registered_by || w.created_by || ''
          });
        }
      });
    });

    // 3. Alza de precio — only within each item's diagnostic window
    const allCosts = supplyCosts.filter(sc => restFilter(sc));
    const priceImpactByItem = {};
    
    Object.keys(lossByItem).forEach(name => {
      const window = diagnosticWindows[name];
      const itemCosts = allCosts
        .filter(sc => sc.supply_item_name === name && sc.date)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      
      // Find purchases in the window and the one just before
      const purchasesInWindow = itemCosts.filter(sc => sc.date >= window.from && sc.date <= window.to);
      const purchasesBefore = itemCosts.filter(sc => sc.date <= window.from);
      
      if (purchasesInWindow.length > 0) {
        const latestInWindow = purchasesInWindow[purchasesInWindow.length - 1];
        const latestQty = latestInWindow.quantity_purchased || 0;
        const latestCost = latestInWindow.total_cost || latestInWindow.subtotal || 0;
        
        // Compare with previous (either earlier in window or before window)
        const previousPurchase = purchasesInWindow.length > 1 
          ? purchasesInWindow[purchasesInWindow.length - 2]
          : purchasesBefore[purchasesBefore.length - 1];
        
        if (previousPurchase && latestQty > 0) {
          const prevQty = previousPurchase.quantity_purchased || 0;
          const prevCost = previousPurchase.total_cost || previousPurchase.subtotal || 0;
          if (prevQty > 0 && prevCost > 0) {
            const latest = latestCost / latestQty;
            const previous = prevCost / prevQty;
            if (latest > previous) {
              const priceDiff = latest - previous;
              const changePct = ((latest - previous) / previous) * 100;
              const inflatedValue = priceDiff * lossByItem[name].qty;
              priceImpactByItem[name] = { priceDiff, changePct, inflatedValue, latest, previous };
            }
          }
        }
      }
    });

    // 4. Recetas — build map of which recipes use each supply + quantities
    const recipesByItem = {};
    const recipeIngredientMap = {}; // supply_name → [{ recipe, qtyPerServing, unit }]
    recipes.filter(r => restFilter(r) && !r.is_sub_recipe).forEach(r => {
      (r.ingredients || []).forEach(ing => {
        if (!recipesByItem[ing.supply_name]) recipesByItem[ing.supply_name] = [];
        recipesByItem[ing.supply_name].push(r.dish_name);
        if (!recipeIngredientMap[ing.supply_name]) recipeIngredientMap[ing.supply_name] = [];
        const servings = r.servings || 1;
        recipeIngredientMap[ing.supply_name].push({
          recipeId: r.id,
          recipeName: r.dish_name,
          qtyPerServing: (ing.quantity || 0) / servings,
          unit: ing.unit
        });
      });
    });

    // 5. Estimate theoretical consumption — sales data removed (was loading 5000+ records)
    // Now uses recipe ingredient × sampling deviation only (no sales-based theoretical consumption)
    // This is more accurate: sampling deviation directly measures over-portioning

    // 6. Get sampling deviation data (% over-portioning) per supply from RecipeSample
    const filteredSamples = recipeSamples.filter(s => restFilter(s));
    const samplingDeviationBySupply = {}; // supply_name → avg positive deviation %
    
    filteredSamples.forEach(sample => {
      (sample.ingredients || []).forEach(ing => {
        if (!samplingDeviationBySupply[ing.supply_name]) {
          samplingDeviationBySupply[ing.supply_name] = { positiveDeviations: [], negativeDeviations: [] };
        }
        const dev = ing.deviation_percent || 0;
        if (dev > 0) {
          samplingDeviationBySupply[ing.supply_name].positiveDeviations.push(dev);
        } else if (dev < 0) {
          samplingDeviationBySupply[ing.supply_name].negativeDeviations.push(dev);
        }
      });
    });

    // Build diagnostic per item
    const results = [];
    Object.entries(lossByItem).forEach(([name, loss]) => {
      const item = supplyItems.find(s => s.name === name && restFilter(s));
      const unitCost = item?.average_unit_cost || 0;
      const window = diagnosticWindows[name];

      const waste = wasteByItem[name] || { qty: 0, value: 0, reasons: {}, entries: [] };
      const external = externalLossByItem[name] || { qty: 0, value: 0, details: [] };
      const priceImpact = priceImpactByItem[name] || null;
      const relatedRecipes = recipesByItem[name] || [];
      const recipeIngredients = recipeIngredientMap[name] || [];

      // === CRITICAL LOGIC ===
      // The count's loss (expected - actual) is what's missing AFTER all stock movements.
      // Merma and external losses that already generated stock movements are already 
      // incorporated into the expected stock — they do NOT explain the count's loss.
      // Only merma/external that did NOT deduct stock can explain the count's loss.
      
      const wasteAlreadyDeducted = waste.alreadyDeducted;
      const externalAlreadyDeducted = external.alreadyDeducted;

      // === STEP A: Merma documentada ===
      // Only counts as explanation if it did NOT already deduct stock
      const wasteQtyExplains = wasteAlreadyDeducted ? 0 : Math.min(waste.qty, loss.qty);
      const wasteQtyContext = waste.qty; // Full amount for display context
      let remainingLoss = loss.qty - wasteQtyExplains;

      // === STEP B: Pérdida externa (faltante proveedor) ===
      // Only counts as explanation if it did NOT already deduct stock  
      const externalQtyExplains = externalAlreadyDeducted ? 0 : Math.min(external.qty, remainingLoss);
      const externalQtyContext = external.qty; // Full amount for display context
      remainingLoss -= externalQtyExplains;

      // === STEP C: Desviación de recetas (SOLO positiva = usaron MÁS de lo debido) ===
      // recipe_sale movements ARE already deducted from stock for the THEORETICAL amount.
      // But if staff over-portions, they use MORE than the recipe says → that extra is NOT 
      // deducted from stock (only theoretical is deducted). So deviation CAN explain count loss.
      const hasRecipes = relatedRecipes.length > 0;
      let theoreticalConsumption = 0;
      
      if (hasRecipes && recipeIngredients.length > 0) {
        stockMovements.filter(m => {
          if (!restFilter(m)) return false;
          const mDate = (m.transaction_date || m.created_date || '').slice(0, 10);
          return mDate >= window.from && mDate <= window.to && 
                 m.product_name === name && 
                 (m.movement_type === 'recipe_sale' || m.movement_type === 'sale');
        }).forEach(m => {
          theoreticalConsumption += Math.abs(m.quantity || 0);
        });
      }

      let deviationQty = 0;
      const samplingData = samplingDeviationBySupply[name];
      
      if (hasRecipes && samplingData && samplingData.positiveDeviations.length > 0 && theoreticalConsumption > 0) {
        const avgPositiveDev = samplingData.positiveDeviations.reduce((s, d) => s + d, 0) / samplingData.positiveDeviations.length;
        const extraFromDeviation = theoreticalConsumption * (avgPositiveDev / 100);
        deviationQty = Math.min(extraFromDeviation, remainingLoss);
      }

      remainingLoss -= deviationQty;

      // === STEP D: Sin explicación ===
      const unexplainedQty = Math.max(0, remainingLoss);

      const deviationValue = deviationQty * unitCost;
      
      // Price inflation is CONTEXT only — it does NOT explain physical loss.
      // It just means the same loss costs more money. Showing it as a "cause" confuses users.
      const unexplainedValue = unexplainedQty * unitCost;
      
      // For display: use the explaining amounts, not the context amounts
      const wasteQty = wasteQtyExplains;
      const wasteValue = wasteQty * unitCost;
      const externalQty = externalQtyExplains;
      const externalValue = externalQty * unitCost;

      // Severity based on unexplained percentage
      const unexplainedPct = loss.qty > 0 ? (unexplainedQty / loss.qty) * 100 : 0;
      const severity = unexplainedPct >= 50 ? 'critical' : unexplainedPct >= 20 ? 'warning' : 'ok';

      // Build sampling info for display
      const samplingInfo = samplingData ? {
        positiveSamples: samplingData.positiveDeviations.length,
        negativeSamples: samplingData.negativeDeviations.length,
        avgPositiveDev: samplingData.positiveDeviations.length > 0 
          ? samplingData.positiveDeviations.reduce((s, d) => s + d, 0) / samplingData.positiveDeviations.length 
          : 0,
        theoreticalConsumption: Math.round(theoreticalConsumption * 1000) / 1000
      } : null;

      results.push({
        name,
        category: item?.category || '—',
        unit: item?.unit_of_measure || '',
        unitCost,
        totalLossQty: loss.qty,
        totalLossValue: loss.value || loss.qty * unitCost,
        diagnosticWindow: window,
        // Context amounts (documented but already deducted from stock — do NOT explain count loss)
        wasteQtyContext: wasteQtyContext,
        wasteReasons: waste.reasons,
        wasteEntries: waste.entries || [],
        externalQtyContext: externalQtyContext,
        externalDetails: external.details,
        // Amounts that EXPLAIN the count loss
        deviationQty: Math.round(deviationQty * 1000) / 1000,
        deviationValue,
        // Unexplained
        unexplainedQty: Math.round(unexplainedQty * 1000) / 1000,
        unexplainedValue,
        unexplainedPct,
        severity,
        // Context info
        hasRecipes,
        recipeNames: [...new Set(relatedRecipes)].slice(0, 3),
        priceImpact,
        samplingInfo,
        theoreticalConsumption: Math.round(theoreticalConsumption * 1000) / 1000
      });
    });

    // Build surplus diagnostics
    const surplusResults = [];
    Object.entries(surplusByItem).forEach(([name, surplus]) => {
      const item = supplyItems.find(s => s.name === name && restFilter(s));
      const unitCost = item?.average_unit_cost || 0;
      const surplusValue = surplus.qty * unitCost;

      // Possible explanations for surplus
      const possibleCauses = [];
      
      // Check if there was a purchase in the period (possible unregistered purchase or received more)
      const window = { from: dateRange.from, to: dateRange.to };
      const recentPurchases = supplyCosts.filter(sc => 
        restFilter(sc) && sc.supply_item_name === name && sc.date >= window.from && sc.date <= window.to
      );
      if (recentPurchases.length > 0) {
        // Check if received_quantity > quantity_purchased
        const hasExtraReceived = recentPurchases.some(p => 
          p.quantity_received && p.quantity_purchased && p.quantity_received > p.quantity_purchased
        );
        if (hasExtraReceived) {
          possibleCauses.push({ icon: PackagePlus, label: 'Proveedor entregó más de lo facturado', color: 'text-emerald-600' });
        }
        possibleCauses.push({ icon: PackagePlus, label: 'Compra registrada pero stock no actualizado correctamente', color: 'text-blue-600' });
      }

      // Check for transfers in
      const transfersIn = stockMovements.filter(m => 
        restFilter(m) && m.product_name === name && m.movement_type === 'transfer_in' && 
        (m.transaction_date || '').slice(0, 10) >= window.from && (m.transaction_date || '').slice(0, 10) <= window.to
      );
      if (transfersIn.length > 0) {
        possibleCauses.push({ icon: Truck, label: 'Traspaso recibido de otra sucursal', color: 'text-cyan-600' });
      }

      // Check price decrease (bought more for the same money)
      const allItemCosts = supplyCosts
        .filter(sc => restFilter(sc) && sc.supply_item_name === name && sc.date)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const purchasesInWindow = allItemCosts.filter(sc => sc.date >= window.from && sc.date <= window.to);
      const purchasesBefore = allItemCosts.filter(sc => sc.date < window.from);
      if (purchasesInWindow.length > 0 && purchasesBefore.length > 0) {
        const latestP = purchasesInWindow[purchasesInWindow.length - 1];
        const prevP = purchasesBefore[purchasesBefore.length - 1];
        const latestUnit = (latestP.total_cost || latestP.subtotal || 0) / (latestP.quantity_purchased || 1);
        const prevUnit = (prevP.total_cost || prevP.subtotal || 0) / (prevP.quantity_purchased || 1);
        if (latestUnit < prevUnit) {
          possibleCauses.push({ icon: TrendingDown, label: `Baja de precio: compró más por menos (${Math.round(((prevUnit - latestUnit) / prevUnit) * 100)}% menos)`, color: 'text-green-600' });
        }
      }

      // Always add generic causes
      possibleCauses.push({ icon: ArrowUpDown, label: 'Error en conteo anterior (se contó menos de lo real)', color: 'text-amber-600' });
      possibleCauses.push({ icon: ArrowUpDown, label: 'Error en conteo actual (se contó de más)', color: 'text-amber-600' });
      if (recentPurchases.length === 0) {
        possibleCauses.push({ icon: PackagePlus, label: 'Posible compra no registrada en el sistema', color: 'text-orange-600' });
      }

      surplusResults.push({
        name,
        category: item?.category || '—',
        unit: item?.unit_of_measure || '',
        unitCost,
        surplusQty: surplus.qty,
        surplusValue,
        possibleCauses
      });
    });

    return {
      losses: results.sort((a, b) => b.unexplainedValue - a.unexplainedValue),
      surpluses: surplusResults.sort((a, b) => b.surplusValue - a.surplusValue)
    };
  }, [inventoryCounts, wasteRecords, supplyItems, supplyCosts, stockMovements, recipes, recipeSamples, selectedRestaurant, dateRange]);

  const losses = diagnostics.losses || [];
  const surpluses = diagnostics.surpluses || [];

  const filtered = losses.filter(item => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterSeverity === 'critical') return item.severity === 'critical';
    if (filterSeverity === 'warning') return item.severity === 'warning' || item.severity === 'critical';
    if (filterSeverity === 'ok') return item.severity === 'ok';
    return true;
  });

  const filteredSurpluses = surpluses.filter(item => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const totalLossValue = filtered.reduce((s, i) => s + i.totalLossValue, 0);
  const totalDeviationValue = filtered.reduce((s, i) => s + i.deviationValue, 0);
  const totalUnexplainedValue = filtered.reduce((s, i) => s + i.unexplainedValue, 0);
  const totalWasteContext = filtered.reduce((s, i) => s + (i.wasteQtyContext || 0) * (i.unitCost || 0), 0);
  const totalExternalContext = filtered.reduce((s, i) => s + (i.externalQtyContext || 0) * (i.unitCost || 0), 0);
  const criticalCount = filtered.filter(i => i.severity === 'critical').length;
  const totalSurplusValue = filteredSurpluses.reduce((s, i) => s + i.surplusValue, 0);

  const reasonLabels = {
    vencimiento: 'Vencimiento',
    'daño': 'Daño',
    contaminacion: 'Contaminación',
    preparacion: 'Preparación',
    otro: 'Otro'
  };

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-0">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">Diagnóstico Inteligente de Pérdidas</p>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Cuando haces un conteo, la <span className="text-white font-semibold">pérdida = stock esperado − stock real</span>. 
                El stock esperado <span className="text-white font-semibold">YA incluye</span> toda merma documentada, pérdida externa (faltante proveedor) y ventas teóricas. 
                Por eso la pérdida del conteo es lo que falta <span className="text-amber-300 font-semibold">ADICIONAL</span> a todo eso.
              </p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                <span className="text-violet-300 font-semibold">Desviación de recetas</span> = el sistema descuenta la cantidad teórica por venta, pero si el staff usa más (sobre-porcionamiento), esa diferencia aparece como pérdida en el conteo. 
                Lo que queda <span className="text-red-300 font-semibold">sin explicación</span> requiere investigación (robo, error de conteo, uso no registrado).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[180px] h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ({losses.length})</SelectItem>
            <SelectItem value="critical">🔴 Requiere investigación ({losses.filter(d => d.severity === 'critical').length})</SelectItem>
            <SelectItem value="warning">🟡 Atención ({losses.filter(d => d.severity === 'warning' || d.severity === 'critical').length})</SelectItem>
            <SelectItem value="ok">🟢 Explicados ({losses.filter(d => d.severity === 'ok').length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards — Only 3: Total Loss, Deviation (explains), Unexplained */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Pérdida Total en Conteos</p>
            <p className="text-xl font-black text-red-700 mt-1">{formatCurrency(totalLossValue, currency)}</p>
            <p className="text-[10px] text-red-400 mt-1">Lo que falta ADICIONAL a merma y pérdida externa ya descontadas</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-100">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Explicado por Desviación</p>
            <p className="text-xl font-black text-violet-700 mt-1">{formatCurrency(totalDeviationValue, currency)}</p>
            <p className="text-[10px] text-violet-400 mt-1">
              {totalLossValue > 0 ? ((totalDeviationValue / totalLossValue) * 100).toFixed(0) : 0}% — sobre-porcionamiento en recetas
            </p>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${criticalCount > 0 ? 'from-red-100 to-rose-100 border-red-300 ring-1 ring-red-200' : 'from-emerald-50 to-green-50 border-emerald-100'}`}>
          <CardContent className="p-4 text-center">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${criticalCount > 0 ? 'text-red-500' : 'text-emerald-400'}`}>
              {criticalCount > 0 ? '⚠️ Sin Explicación' : '✓ Todo Explicado'}
            </p>
            <p className={`text-xl font-black mt-1 ${criticalCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatCurrency(totalUnexplainedValue, currency)}</p>
            <p className={`text-[10px] mt-1 ${criticalCount > 0 ? 'text-red-500 font-bold' : 'text-emerald-500'}`}>
              {criticalCount > 0 ? `${criticalCount} insumo(s) requieren investigación` : 'Sin pérdidas sin explicar'}
            </p>
          </CardContent>
        </Card>
      </div>
      {/* Context: documented events that are NOT causes of count loss */}
      {(totalWasteContext > 0 || totalExternalContext > 0) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold">Contexto (ya incluido en stock esperado):</span>
            {totalWasteContext > 0 && <span>Merma documentada: <span className="font-bold text-orange-600">{formatCurrency(totalWasteContext, currency)}</span></span>}
            {totalExternalContext > 0 && <span>Pérdida externa: <span className="font-bold text-cyan-600">{formatCurrency(totalExternalContext, currency)}</span></span>}
            <span className="italic text-slate-400">— estos montos ya fueron descontados del inventario y no explican la pérdida del conteo</span>
          </p>
        </div>
      )}

      {/* Item List */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((item, idx) => {
            const isExpanded = expandedItem === item.name;
            const severityConfig = {
              critical: { border: 'border-red-200', icon: '🔴', label: 'Investigar', bg: 'bg-red-50', text: 'text-red-700', badgeBg: 'bg-red-100 text-red-700' },
              warning: { border: 'border-amber-200', icon: '🟡', label: 'Atención', bg: 'bg-amber-50', text: 'text-amber-700', badgeBg: 'bg-amber-100 text-amber-700' },
              ok: { border: 'border-emerald-200', icon: '🟢', label: 'Explicado', bg: 'bg-emerald-50', text: 'text-emerald-700', badgeBg: 'bg-emerald-100 text-emerald-700' }
            }[item.severity];

            // Only 2 real causes: deviation (explains) and unexplained
            const causes = [];
            if (item.deviationQty > 0) causes.push({ label: 'Desviación recetas', qty: item.deviationQty, value: item.deviationValue, color: 'bg-violet-400', textColor: 'text-violet-700', icon: ChefHat });
            if (item.unexplainedQty > 0) causes.push({ label: 'Sin explicación', qty: item.unexplainedQty, value: item.unexplainedValue, color: 'bg-red-500', textColor: 'text-red-700', icon: ShieldAlert });

            return (
              <motion.div key={item.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                <Card className={`bg-white border ${severityConfig.border} hover:shadow-lg transition-all`}>
                  <CardContent className="p-4">
                    {/* Header */}
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedItem(isExpanded ? null : item.name)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                          item.severity === 'critical' ? 'bg-gradient-to-br from-red-500 to-rose-600' :
                          item.severity === 'warning' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                          'bg-gradient-to-br from-emerald-500 to-green-600'
                        }`}>
                          <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">{item.category} · {item.unit}</span>
                            <Badge className={`border-0 text-[10px] ${severityConfig.badgeBg}`}>
                              {severityConfig.icon} {severityConfig.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-black text-red-600">-{item.totalLossQty} {item.unit}</p>
                          <p className="text-sm font-bold text-red-500">{formatCurrency(item.totalLossValue, currency)}</p>
                        </div>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        </motion.div>
                      </div>
                    </div>

                    {/* Cause breakdown bar — only deviation + unexplained */}
                    <div className="mt-3">
                      <div className="flex rounded-full overflow-hidden h-3 bg-gray-100">
                        {item.deviationValue > 0 && (
                          <div className="bg-violet-400 transition-all" style={{ width: `${item.totalLossValue > 0 ? (item.deviationValue / item.totalLossValue) * 100 : 0}%` }} />
                        )}
                        {item.unexplainedValue > 0 && (
                          <div className="bg-red-500 transition-all" style={{ width: `${item.totalLossValue > 0 ? (item.unexplainedValue / item.totalLossValue) * 100 : 0}%` }} />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-[10px] flex-wrap">
                        {item.deviationValue > 0 && (
                          <span className="flex items-center gap-1 text-violet-700">
                            <span className="w-2 h-2 rounded-full bg-violet-400" /> Desviación recetas {item.totalLossValue > 0 ? ((item.deviationValue / item.totalLossValue) * 100).toFixed(0) : 0}%
                          </span>
                        )}
                        {item.unexplainedValue > 0 && (
                          <span className="flex items-center gap-1 font-bold text-red-600">
                            <span className="w-2 h-2 rounded-full bg-red-500" /> Sin explicar {item.totalLossValue > 0 ? ((item.unexplainedValue / item.totalLossValue) * 100).toFixed(0) : 0}%
                          </span>
                        )}
                        {/* Context: documented causes already in stock */}
                        {item.wasteQtyContext > 0 && (
                          <span className="flex items-center gap-1 text-gray-400 italic">
                            <span className="w-2 h-2 rounded-full bg-orange-200" /> Merma {item.wasteQtyContext} {item.unit} (ya en stock)
                          </span>
                        )}
                        {item.externalQtyContext > 0 && (
                          <span className="flex items-center gap-1 text-gray-400 italic">
                            <span className="w-2 h-2 rounded-full bg-cyan-200" /> Ext. {item.externalQtyContext} {item.unit} (ya en stock)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                            {/* Diagnostic window info */}
                            {item.diagnosticWindow && (
                              <div className="bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <p className="text-xs text-slate-600">
                                  <span className="font-bold">Ventana de análisis:</span>{' '}
                                  {formatDateInUserTz(item.diagnosticWindow.from, "dd 'de' MMMM yyyy", user) || item.diagnosticWindow.from}
                                  {' → '}
                                  {formatDateInUserTz(item.diagnosticWindow.to, "dd 'de' MMMM yyyy", user) || item.diagnosticWindow.to}
                                  <span className="text-slate-400 ml-1">(solo eventos entre el conteo anterior y el actual)</span>
                                </p>
                              </div>
                            )}
                            
                            {/* Info: documented causes already in expected stock */}
                            {(item.wasteQtyContext > 0 || item.externalQtyContext > 0) ? (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                <div className="flex items-start gap-2">
                                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                  <div className="text-xs text-slate-600">
                                    <p className="font-bold mb-1">Eventos documentados en el período (ya incluidos en stock esperado):</p>
                                    {item.wasteQtyContext > 0 && (
                                      <p>• Merma registrada: <span className="font-bold">{item.wasteQtyContext} {item.unit}</span> — el stock esperado ya la descontó</p>
                                    )}
                                    {item.externalQtyContext > 0 && (
                                      <p>• Faltante proveedor: <span className="font-bold">{item.externalQtyContext} {item.unit}</span> — el stock solo sumó lo recibido</p>
                                    )}
                                    <p className="text-slate-500 mt-1 italic">
                                      Estos {item.wasteQtyContext + item.externalQtyContext} {item.unit} NO son parte de la pérdida de -{item.totalLossQty} {item.unit}. 
                                      La pérdida del conteo es lo que falta <span className="font-bold text-red-600">ADEMÁS</span> de todo esto.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {/* Cause table — only causes that explain count loss */}
                            <div className="bg-gray-50 rounded-xl overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-100/80">
                                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-500 uppercase">Causa</th>
                                    <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 uppercase">Cantidad</th>
                                    <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 uppercase">Valor</th>
                                    <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 uppercase">% Pérdida</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {item.deviationQty > 0 && (
                                    <tr className="bg-violet-50/50">
                                      <td className="py-2 px-3 flex items-center gap-2">
                                        <ChefHat className="w-3.5 h-3.5 text-violet-500" />
                                        <span className="font-semibold text-violet-700">Desviación de recetas</span>
                                        <TooltipProvider><Tooltip><TooltipTrigger><HelpCircle className="w-3 h-3 text-violet-300" /></TooltipTrigger>
                                          <TooltipContent className="max-w-xs"><p className="text-xs">El sistema descuenta la cantidad TEÓRICA por receta. Si el staff usa más (sobre-porcionamiento), esa diferencia no se descuenta → aparece como pérdida en el conteo.</p></TooltipContent>
                                        </Tooltip></TooltipProvider>
                                      </td>
                                      <td className="py-2 px-3 text-right font-bold text-violet-600">{item.deviationQty.toFixed(1)} {item.unit}</td>
                                      <td className="py-2 px-3 text-right font-bold text-violet-600">{formatCurrency(item.deviationValue, currency)}</td>
                                      <td className="py-2 px-3 text-right font-bold text-violet-600">{item.totalLossValue > 0 ? ((item.deviationValue / item.totalLossValue) * 100).toFixed(0) : 0}%</td>
                                    </tr>
                                  )}
                                  <tr className="bg-red-50/50">
                                    <td className="py-2 px-3 flex items-center gap-2">
                                      <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                                      <span className="font-bold text-red-700">Sin explicación</span>
                                      <TooltipProvider><Tooltip><TooltipTrigger><HelpCircle className="w-3 h-3 text-red-300" /></TooltipTrigger>
                                        <TooltipContent className="max-w-xs"><p className="text-xs">Lo que falta y no tiene causa conocida. Posible: robo, error de conteo, uso no registrado, traspaso sin documentar.</p></TooltipContent>
                                      </Tooltip></TooltipProvider>
                                    </td>
                                    <td className="py-2 px-3 text-right font-black text-red-600">{item.unexplainedQty.toFixed(1)} {item.unit}</td>
                                    <td className="py-2 px-3 text-right font-black text-red-600">{formatCurrency(item.unexplainedValue, currency)}</td>
                                    <td className="py-2 px-3 text-right font-black text-red-600">{item.totalLossValue > 0 ? ((item.unexplainedValue / item.totalLossValue) * 100).toFixed(0) : 0}%</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* Waste breakdown — CONTEXT only (already in expected stock) */}
                            {item.wasteQtyContext > 0 && item.wasteEntries && item.wasteEntries.length > 0 && (
                              <div className="rounded-xl px-3 py-2 bg-gray-50 border border-gray-100">
                                <p className="text-[10px] font-bold uppercase mb-1 text-gray-400">
                                  Detalle merma documentada <span className="normal-case font-normal italic">(ya descontada del inventario)</span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {item.wasteEntries.map((entry, ei) => {
                                    const fmtDate = entry.date ? entry.date.split('-').reverse().join('/') : '';
                                    return (
                                      <Badge key={ei} className="border-0 text-xs bg-gray-100 text-gray-500">
                                        {reasonLabels[entry.reason] || entry.reason}: {entry.qty} {item.unit}
                                        {fmtDate && <span className="ml-1 text-gray-400">({fmtDate})</span>}
                                        {entry.registeredBy && <span className="ml-1 text-gray-400">· {entry.registeredBy}</span>}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* External loss — CONTEXT only (already in expected stock) */}
                            {item.externalQtyContext > 0 && item.externalDetails.length > 0 && (
                              <div className="rounded-xl px-3 py-2 bg-gray-50 border border-gray-100">
                                <p className="text-[10px] font-bold uppercase mb-1 text-gray-400">
                                  Detalle faltante proveedor <span className="normal-case font-normal italic">(ya descontada del inventario)</span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {item.externalDetails.map((d, di) => {
                                    const fmtDate = d.date ? d.date.split('-').reverse().join('/') : '';
                                    return (
                                      <Badge key={di} className="border-0 text-xs bg-gray-100 text-gray-500">
                                        {d.supplier || 'Proveedor'}: -{d.qty} {item.unit} {d.invoice ? `(Fact. ${d.invoice})` : ''}
                                        {fmtDate && <span className="ml-1 text-gray-400">({fmtDate})</span>}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Price impact — context only */}
                            {item.priceImpact && (
                              <div className="bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                                  <p className="text-xs text-blue-600">
                                    <span className="font-semibold">Nota:</span> Hubo alza de precio {sym}{item.priceImpact.previous.toFixed(0)} → {sym}{item.priceImpact.latest.toFixed(0)}/{item.unit} (+{item.priceImpact.changePct.toFixed(1)}%). 
                                    Esto encarece el valor de la pérdida, pero <span className="font-semibold">no explica la pérdida física</span> (no se pierde más insumo por el alza).
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Recipes + sampling detail */}
                            {item.hasRecipes && (
                              <div className="bg-violet-50 rounded-xl px-3 py-2 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <ChefHat className="w-3.5 h-3.5 text-violet-500" />
                                  <p className="text-xs text-violet-700">
                                    <span className="font-bold">Presente en recetas:</span> {item.recipeNames.join(', ')}
                                    {item.recipeNames.length >= 3 && '...'}
                                  </p>
                                </div>
                                {item.theoreticalConsumption > 0 && (
                                  <p className="text-xs text-violet-600 ml-5">
                                    📊 Consumo teórico por ventas en el período: <span className="font-bold">{item.theoreticalConsumption} {item.unit}</span>
                                  </p>
                                )}
                                {item.samplingInfo && item.samplingInfo.positiveSamples > 0 && (
                                  <p className="text-xs text-violet-600 ml-5">
                                    🔬 Muestreos detectaron sobre-porcionamiento promedio de <span className="font-bold text-red-600">+{item.samplingInfo.avgPositiveDev.toFixed(1)}%</span> 
                                    {' '}({item.samplingInfo.positiveSamples} muestreo{item.samplingInfo.positiveSamples !== 1 ? 's' : ''})
                                    {item.deviationQty > 0 && <> → pérdida estimada: <span className="font-bold">{item.deviationQty} {item.unit}</span></>}
                                  </p>
                                )}
                                {item.samplingInfo && item.samplingInfo.negativeSamples > 0 && item.samplingInfo.positiveSamples === 0 && (
                                  <p className="text-xs text-emerald-600 ml-5">
                                    ✅ Muestreos muestran sub-porcionamiento (usaron menos) — no genera pérdida de inventario
                                  </p>
                                )}
                                {!item.samplingInfo && (
                                  <p className="text-xs text-violet-500 ml-5 italic">
                                    💡 Sin muestreos aún — realiza muestreos para medir desviación real
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Investigation needed */}
                            {item.severity === 'critical' && (
                              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                <div className="flex items-start gap-2">
                                  <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-xs font-bold text-red-700">⚠️ Requiere Investigación</p>
                                    <p className="text-xs text-red-600 mt-0.5">
                                      <span className="font-bold">{item.unexplainedQty.toFixed(1)} {item.unit}</span> ({formatCurrency(item.unexplainedValue, currency)}) desaparecieron sin causa conocida.
                                      {' '}Posibles causas: robo, error de conteo, uso no registrado (platos sin registrar en POS), o traspaso no documentado.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay pérdidas para diagnosticar</p>
            <p className="text-sm text-gray-400 mt-1">Realiza conteos de inventario para detectar discrepancias</p>
          </CardContent>
        </Card>
      )}

      {/* Surplus Section */}
      {filteredSurpluses.length > 0 && (
        <div className="space-y-3 mt-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Sobrantes detectados</h3>
              <p className="text-xs text-gray-500">Insumos donde se contó MÁS de lo esperado — valor total: <span className="font-bold text-emerald-600">{formatCurrency(totalSurplusValue, currency)}</span></p>
            </div>
          </div>

          {filteredSurpluses.map((item, idx) => (
            <motion.div key={item.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card className="bg-white border border-emerald-200 hover:shadow-lg transition-all">
                <CardContent className="p-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedItem(expandedItem === `surplus_${item.name}` ? null : `surplus_${item.name}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-gradient-to-br from-emerald-500 to-green-600">
                        <TrendingDown className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{item.category} · {item.unit}</span>
                          <Badge className="border-0 text-[10px] bg-emerald-100 text-emerald-700">🟢 Sobrante</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-600">+{item.surplusQty} {item.unit}</p>
                        <p className="text-sm font-bold text-emerald-500">{formatCurrency(item.surplusValue, currency)}</p>
                      </div>
                      <motion.div animate={{ rotate: expandedItem === `surplus_${item.name}` ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      </motion.div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedItem === `surplus_${item.name}` && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                            <p className="text-xs font-bold text-emerald-700 mb-2">🔍 Posibles causas del sobrante:</p>
                            <div className="space-y-2">
                              {item.possibleCauses.map((cause, ci) => {
                                const CauseIcon = cause.icon;
                                return (
                                  <div key={ci} className="flex items-center gap-2">
                                    <CauseIcon className={`w-3.5 h-3.5 ${cause.color} shrink-0`} />
                                    <p className={`text-xs ${cause.color}`}>{cause.label}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400 italic px-1">
                            💡 Un sobrante no siempre es positivo — puede indicar un error en el registro de compras o en el conteo anterior. Verifica que todas las compras y traspasos estén registrados.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}