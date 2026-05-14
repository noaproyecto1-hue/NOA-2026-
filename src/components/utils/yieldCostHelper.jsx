/**
 * Calcula el costo ajustado por rendimiento de un insumo.
 * Si el rendimiento es 80%, el costo real por unidad útil es mayor.
 * Fórmula: costo_compra / (rendimiento / 100)
 * 
 * @param {object} supplyItem - El insumo con average_unit_cost y yield_percentage
 * @returns {number} Costo por unidad útil (ajustado por rendimiento)
 */
export function getYieldAdjustedCost(supplyItem) {
  if (!supplyItem) return 0;
  const cost = supplyItem.average_unit_cost || 0;
  const yieldPct = supplyItem.yield_percentage;
  // Si no tiene rendimiento configurado o es 100%, devolver costo normal
  if (!yieldPct || yieldPct >= 100) return cost;
  if (yieldPct <= 0) return cost; // Seguridad
  return cost / (yieldPct / 100);
}

/**
 * Calcula el costo de un ingrediente en una receta usando el rendimiento.
 * 
 * @param {object} ingredient - {supply_name, supply_id, quantity, unit}
 * @param {array} supplyItems - Lista de SupplyItems
 * @returns {number} Costo total del ingrediente ajustado por rendimiento
 */
export function getIngredientCostWithYield(ingredient, supplyItems) {
  const supply = supplyItems.find(s => s.name === ingredient.supply_name || s.id === ingredient.supply_id);
  if (!supply) return 0;
  return getYieldAdjustedCost(supply) * (ingredient.quantity || 0);
}