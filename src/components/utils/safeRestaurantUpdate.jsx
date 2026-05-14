import { base44 } from '@/api/base44Client';

/**
 * Wrapper seguro para Restaurant.update que normaliza supply_categories
 * antes de enviar, evitando errores de validación por datos legacy (strings).
 * 
 * @param {string} restaurantId - ID del restaurante
 * @param {object} data - Datos a actualizar
 * @param {object} [existingRestaurant] - Objeto restaurante existente (para acceder a config)
 */
export async function safeRestaurantUpdate(restaurantId, data, existingRestaurant = null) {
  const updateData = { ...data };

  // Si el update ya incluye config con supply_categories, normalizar
  if (updateData.config?.supply_categories) {
    updateData.config = {
      ...updateData.config,
      supply_categories: normalizeCategories(updateData.config.supply_categories)
    };
  } 
  // Si no incluye config pero el restaurante existente tiene strings legacy, incluir config normalizada
  else if (existingRestaurant?.config?.supply_categories?.some(c => typeof c === 'string')) {
    updateData.config = {
      ...existingRestaurant.config,
      supply_categories: normalizeCategories(existingRestaurant.config.supply_categories)
    };
  }

  return base44.entities.Restaurant.update(restaurantId, updateData);
}

function normalizeCategories(categories) {
  if (!Array.isArray(categories)) return categories;
  return categories.map(c => {
    if (typeof c === 'string') {
      return { name: c, cost_type: 'food_cost' };
    }
    return c;
  });
}