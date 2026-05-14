/**
 * Auto-sincronización de Configuración
 * 
 * Después de cada importación (insumos, ventas, compras), detecta valores nuevos
 * y los agrega automáticamente a la configuración del restaurante.
 * 
 * Campos que sincroniza:
 * - supply_categories (categorías de insumos)
 * - preparation_zones (áreas/zonas de preparación)
 * - product_categories (categorías de productos)
 * - rooms (salas del local)
 * - payment_methods (métodos de pago)
 */

import { base44 } from '@/api/base44Client';

// Normalizar texto para comparación (sin tildes, mayúsculas, espacios extra)
const normalize = (str) => {
  if (!str) return '';
  return str.toString().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
};

// Verificar si un valor ya existe en un arreglo (comparación normalizada)
const existsIn = (value, list) => {
  if (!value || !list) return true;
  const norm = normalize(value);
  if (!norm) return true;
  return list.some(item => {
    // Si el item es un objeto (ej: supply_categories con {name, cost_type})
    const itemName = typeof item === 'object' ? item.name : item;
    return normalize(itemName) === norm;
  });
};

/**
 * Sincronizar configuración del restaurante después de una importación.
 * Detecta valores nuevos y los agrega a config.
 * 
 * @param {string} restaurantId - ID del restaurante
 * @param {object} restaurant - Objeto completo del restaurante
 * @param {object} newValues - Valores detectados en la importación:
 *   {
 *     supplyCategories: string[],       // categorías de insumos nuevas
 *     preparationZones: string[],       // áreas/zonas de preparación nuevas
 *     productCategories: string[],      // categorías de productos nuevas
 *     rooms: string[],                  // salas detectadas
 *     paymentMethods: string[],         // métodos de pago detectados
 *   }
 * @returns {object} { updated: boolean, additions: { field: string[] }[] }
 */
export async function syncConfigAfterImport(restaurantId, restaurant, newValues) {
  if (!restaurantId || !restaurant) return { updated: false, additions: [] };

  const config = restaurant.config || {};
  const supplyCategories = config.supply_categories || [];
  const preparationZones = config.preparation_zones || [];
  const productCategories = config.product_categories || [];
  const rooms = config.rooms || [];
  const paymentMethods = config.payment_methods || [];

  const additions = [];
  const configUpdates = {};

  // 1. Categorías de insumos (supply_categories) - son objetos {name, cost_type}
  // Normalize existing categories first (may be legacy strings)
  const normalizedSupplyCategories = supplyCategories.map(cat =>
    typeof cat === 'string' ? { name: cat, cost_type: 'food_cost' } : cat
  );
  if (newValues.supplyCategories?.length > 0) {
    const newCats = newValues.supplyCategories.filter(cat => cat && !existsIn(cat, normalizedSupplyCategories));
    if (newCats.length > 0) {
      const newCatObjects = newCats.map(name => ({
        name: name.trim(),
        cost_type: 'food_cost',
        cost_center_name: ''
      }));
      configUpdates.supply_categories = [...normalizedSupplyCategories, ...newCatObjects];
      additions.push({ field: 'Categorías de insumos', values: newCats });
    }
  } else if (supplyCategories.some(cat => typeof cat === 'string')) {
    // Fix legacy string categories even if no new ones
    configUpdates.supply_categories = normalizedSupplyCategories;
  }

  // 2. Zonas de preparación (preparation_zones) - son strings
  if (newValues.preparationZones?.length > 0) {
    const newZones = newValues.preparationZones.filter(zone => zone && !existsIn(zone, preparationZones));
    if (newZones.length > 0) {
      configUpdates.preparation_zones = [...preparationZones, ...newZones.map(z => z.trim())];
      additions.push({ field: 'Zonas de preparación', values: newZones });
    }
  }

  // 3. Categorías de productos (product_categories) - son strings
  if (newValues.productCategories?.length > 0) {
    const newProdCats = newValues.productCategories.filter(cat => cat && !existsIn(cat, productCategories));
    if (newProdCats.length > 0) {
      configUpdates.product_categories = [...productCategories, ...newProdCats.map(c => c.trim())];
      additions.push({ field: 'Categorías de productos', values: newProdCats });
    }
  }

  // 4. Salas (rooms) - son strings
  if (newValues.rooms?.length > 0) {
    const newRooms = newValues.rooms.filter(room => room && !existsIn(room, rooms));
    if (newRooms.length > 0) {
      configUpdates.rooms = [...rooms, ...newRooms.map(r => r.trim())];
      additions.push({ field: 'Salas', values: newRooms });
    }
  }

  // 5. Métodos de pago (payment_methods) - son strings
  if (newValues.paymentMethods?.length > 0) {
    const newMethods = newValues.paymentMethods.filter(m => m && !existsIn(m, paymentMethods));
    if (newMethods.length > 0) {
      configUpdates.payment_methods = [...paymentMethods, ...newMethods.map(m => m.trim())];
      additions.push({ field: 'Métodos de pago', values: newMethods });
    }
  }

  // Si hay cambios, actualizar el restaurante
  if (Object.keys(configUpdates).length > 0) {
    // Asegurar que supply_categories siempre se envíe como objetos
    const updatedConfig = { ...config, ...configUpdates };
    if (updatedConfig.supply_categories) {
      updatedConfig.supply_categories = updatedConfig.supply_categories.map(c =>
        typeof c === 'string' ? { name: c, cost_type: 'food_cost' } : c
      );
    }
    await base44.entities.Restaurant.update(restaurantId, { config: updatedConfig });

    // Generar alerta si se agregaron categorías de insumos nuevas sin clasificar
    const newCatAddition = additions.find(a => a.field === 'Categorías de insumos');
    if (newCatAddition && newCatAddition.values.length > 0) {
      const catNames = newCatAddition.values.join(', ');
      await base44.entities.Alert.create({
        restaurant_id: restaurantId,
        type: 'custom',
        category: 'inventario',
        severity: 'yellow',
        title: `${newCatAddition.values.length} categoría(s) de insumo nueva(s) detectada(s)`,
        message: `Se detectaron categorías nuevas: ${catNames}. Por defecto se clasificaron como "Food Cost". Ve a Configuración → Insumos para revisar y asignar el destino contable correcto (Food Cost o Centro de Costo).`,
        suggested_action: 'Ir a Configuración del restaurante → pestaña Insumos → Categorías de Insumos para clasificar correctamente.',
        is_read: false,
        is_resolved: false,
        metadata: { new_categories: newCatAddition.values }
      });
    }

    return { updated: true, additions };
  }

  return { updated: false, additions: [] };
}

/**
 * Extraer valores únicos de una importación de insumos (SupplyImportDialog)
 */
export function extractValuesFromSupplyImport(previewItems) {
  const supplyCategories = [...new Set(previewItems.map(i => i.matched_category || i.categoria_insumo).filter(Boolean))];
  const preparationZones = [...new Set(previewItems.map(i => i.area).filter(Boolean))];
  return { supplyCategories, preparationZones };
}

/**
 * Extraer valores únicos de una importación de ventas (SalesImportDialog)
 */
export function extractValuesFromSalesImport(sales) {
  const productCategories = new Set();
  const rooms = new Set();
  const paymentMethods = new Set();

  for (const sale of sales) {
    if (sale.room) rooms.add(sale.room);
    if (sale.payment_method) paymentMethods.add(sale.payment_method);
    if (sale.products) {
      for (const prod of sale.products) {
        if (prod.category) productCategories.add(prod.category);
      }
    }
  }

  return {
    productCategories: [...productCategories],
    rooms: [...rooms],
    paymentMethods: [...paymentMethods],
  };
}

/**
 * Extraer valores únicos de una importación de compras (PurchasesImportDialog)
 */
export function extractValuesFromPurchasesImport(supplyCostRecords) {
  const supplyCategories = [...new Set(supplyCostRecords.map(r => r.supply_category).filter(Boolean))];
  return { supplyCategories };
}