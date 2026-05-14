// Servicio para descontar stock de insumos cuando se vende una receta
import { base44 } from '@/api/base44Client';

/**
 * Descuenta los insumos del stock cuando se vende un producto con receta
 * @param {string} restaurantId - ID del restaurante
 * @param {string} productName - Nombre del producto vendido
 * @param {number} quantity - Cantidad vendida
 * @param {Array} recipes - Lista de recetas del restaurante
 * @param {Array} supplyItems - Lista de insumos del restaurante
 * @param {string} saleId - ID de la venta (referencia)
 */
export async function deductStockForSale(restaurantId, productName, quantity, recipes, supplyItems, saleId) {
  // Buscar receta que coincida con el nombre del producto
  const recipe = recipes.find(r => 
    r.restaurant_id === restaurantId && 
    r.dish_name.toLowerCase() === productName.toLowerCase() &&
    r.is_active
  );

  if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
    // No hay receta asociada, no descontar nada
    return { success: true, deducted: false, reason: 'No recipe found' };
  }

  const movements = [];
  const updates = [];
  
  // Las porciones que rinde la receta (default 1 si no está definido)
  const recipeServings = recipe.servings || 1;

  for (const ingredient of recipe.ingredients) {
    // Buscar el insumo
    const supply = supplyItems.find(s => 
      (s.name === ingredient.supply_name || s.id === ingredient.supply_id) &&
      s.restaurant_id === restaurantId
    );

    if (!supply) continue;

    // ingredient.quantity es para TODA la receta (que rinde recipeServings porciones)
    // Si vendes 1 plato y la receta rinde 10, descuentas ingredient.quantity / 10
    // Precisión de 6 decimales intermedios, 3 decimales para stock final
    const deductAmount = parseFloat(((ingredient.quantity * quantity) / recipeServings).toFixed(6));
    const previousStock = supply.current_stock || 0;
    const newStock = parseFloat(Math.max(0, previousStock - deductAmount).toFixed(3));

    // Preparar actualización del stock
    updates.push({
      id: supply.id,
      data: { current_stock: newStock }
    });

    // Preparar movimiento de stock
    movements.push({
      restaurant_id: restaurantId,
      product_name: supply.name,
      product_id: supply.id,
      item_type: 'supply',
      movement_type: 'sale',
      quantity: -deductAmount,
      previous_stock: previousStock,
      new_stock: newStock,
      reference_id: saleId,
      reference_name: productName,
      notes: `Venta de ${quantity}x ${productName}`
    });
  }

  // Ejecutar actualizaciones
  for (const update of updates) {
    await base44.entities.SupplyItem.update(update.id, update.data);
  }

  // Crear movimientos
  if (movements.length > 0) {
    await base44.entities.StockMovement.bulkCreate(movements);
  }

  return { 
    success: true, 
    deducted: true, 
    ingredientsDeducted: movements.length,
    recipeName: recipe.dish_name
  };
}

/**
 * Procesa una venta completa y descuenta stock de todos los productos
 * @param {Object} sale - Objeto de venta con products[]
 * @param {Array} recipes - Recetas del restaurante
 * @param {Array} supplyItems - Insumos del restaurante
 */
export async function processStockForSale(sale, recipes, supplyItems) {
  if (!sale.products || sale.products.length === 0) return;

  const results = [];

  for (const product of sale.products) {
    if (product.is_cancelled) continue;

    const result = await deductStockForSale(
      sale.restaurant_id,
      product.product_name,
      product.quantity || 1,
      recipes,
      supplyItems,
      sale.id
    );

    results.push({
      product: product.product_name,
      ...result
    });
  }

  return results;
}

/**
 * Aumenta el stock de insumos cuando se registra una compra
 * @param {Object} supplyCost - Registro de compra
 * @param {Array} supplyItems - Lista de insumos
 */
export async function addStockFromPurchase(supplyCost, supplyItems) {
  const { restaurant_id, supply_item_name, quantity_purchased } = supplyCost;

  if (!supply_item_name || !quantity_purchased) {
    return { success: false, reason: 'Missing item name or quantity' };
  }

  // Buscar el insumo
  const supply = supplyItems.find(s => 
    s.name.toLowerCase() === supply_item_name.toLowerCase() &&
    s.restaurant_id === restaurant_id
  );

  if (!supply) {
    return { success: false, reason: 'Supply item not found' };
  }

  const previousStock = supply.current_stock || 0;
  const newStock = previousStock + quantity_purchased;

  // Actualizar stock
  await base44.entities.SupplyItem.update(supply.id, { 
    current_stock: newStock 
  });

  // Crear movimiento
  await base44.entities.StockMovement.create({
    restaurant_id,
    product_name: supply.name,
    product_id: supply.id,
    item_type: 'supply',
    movement_type: 'purchase',
    quantity: quantity_purchased,
    previous_stock: previousStock,
    new_stock: newStock,
    reference_id: supplyCost.id,
    notes: `Compra: ${supplyCost.invoice_number || 'Sin factura'}`
  });

  return { success: true, newStock };
}