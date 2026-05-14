/**
 * Helper para clasificación contable de categorías de insumos.
 * 
 * Las categorías de insumos pueden ser:
 * - food_cost: Se contabilizan como Costo de Ventas (Food Cost)
 * - cost_center: Se contabilizan como gasto operativo en un centro de costo específico
 * 
 * Backward compatible: si supply_categories es un array de strings,
 * se tratan todas como food_cost.
 */

/**
 * Normaliza supply_categories (puede ser strings legacy o objetos nuevos)
 * @param {Array} categories - Array de strings o objetos
 * @returns {Array<{name: string, cost_type: string, cost_center_name?: string, cost_center_category?: string}>}
 */
export const normalizeSupplyCategories = (categories = []) => {
  return categories.map(cat => {
    if (typeof cat === 'string') {
      return { name: cat, cost_type: 'food_cost' };
    }
    return {
      name: cat.name || '',
      cost_type: cat.cost_type || 'food_cost',
      cost_center_name: cat.cost_center_name || '',
      cost_center_category: cat.cost_center_category || ''
    };
  });
};

/**
 * Obtiene los nombres de categorías (compatible con el sistema existente)
 * @param {Array} categories - supply_categories del restaurante
 * @returns {string[]} Lista de nombres
 */
export const getCategoryNames = (categories = []) => {
  return normalizeSupplyCategories(categories).map(c => c.name);
};

/**
 * Resuelve la clasificación contable de una categoría.
 * La categoría del insumo actúa como subcategoría natural del centro de costo.
 * @param {string} categoryName - Nombre de la categoría
 * @param {Array} categories - supply_categories del restaurante
 * @returns {{cost_type: string, cost_center_name: string, cost_center_category: string}}
 */
export const resolveCategoryCostType = (categoryName, categories = []) => {
  const normalized = normalizeSupplyCategories(categories);
  const found = normalized.find(c => c.name?.toLowerCase() === categoryName?.toLowerCase());
  if (found && found.cost_type === 'cost_center') {
    return {
      cost_type: 'cost_center',
      cost_center_name: found.cost_center_name || '',
      // La categoría del insumo es la subcategoría dentro del centro de costo
      cost_center_category: categoryName || ''
    };
  }
  return { cost_type: 'food_cost', cost_center_name: '', cost_center_category: '' };
};

/**
 * Obtiene el label de destino contable para mostrar en UI
 * La categoría del insumo actúa como subcategoría natural del centro de costo.
 * @param {string} categoryName - Nombre de la categoría
 * @param {Array} categories - supply_categories del restaurante
 * @returns {string} Label legible
 */
export const getCostTypeLabel = (categoryName, categories = []) => {
  const resolved = resolveCategoryCostType(categoryName, categories);
  if (resolved.cost_type === 'cost_center') {
    return resolved.cost_center_name || 'Centro de Costo';
  }
  return 'Food Cost';
};

/**
 * Verifica si una categoría es food cost
 */
export const isFoodCost = (categoryName, categories = []) => {
  return resolveCategoryCostType(categoryName, categories).cost_type === 'food_cost';
};

/**
 * Convierte supply_categories normalizado de vuelta al formato para guardar
 * (siempre guarda como objetos)
 * No guarda cost_center_category ya que la categoría del insumo es la subcategoría natural.
 */
export const serializeSupplyCategories = (normalizedCategories = []) => {
  return normalizedCategories.map(cat => ({
    name: cat.name,
    cost_type: cat.cost_type || 'food_cost',
    ...(cat.cost_type === 'cost_center' ? {
      cost_center_name: cat.cost_center_name || ''
    } : {})
  }));
};