import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Revierte/ajusta el stock de ingredientes cuando una venta es editada o eliminada.
 * Se ejecuta como entity automation en Sale (update, delete).
 *
 * Casos:
 *   - DELETE: revierte todos los descuentos de ingredientes hechos por esa venta
 *   - UPDATE: si la venta fue cancelada (is_cancelled=true) o los productos cambiaron,
 *     revierte la deducción anterior y aplica la nueva (si no está cancelada)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    if (!event || !old_data) {
      return Response.json({ skipped: true, reason: 'No event or old_data' });
    }

    const eventType = event.type; // 'update' or 'delete'
    const oldSale = old_data;
    const newSale = data; // null on delete

    if (!oldSale?.restaurant_id) {
      return Response.json({ skipped: true, reason: 'No restaurant_id in old_data' });
    }

    // If old sale was already cancelled, nothing was deducted — skip
    if (oldSale.is_cancelled) {
      // Exception: if update UN-cancels it, we need to deduct (but that's handled by create-like logic)
      // For now, if old was cancelled, no stock was deducted, so nothing to reverse
      if (eventType === 'delete') {
        return Response.json({ skipped: true, reason: 'Old sale was cancelled, no stock to reverse' });
      }
      // If update: old was cancelled, new is not cancelled → need to DEDUCT (like a create)
      if (newSale && !newSale.is_cancelled) {
        console.log('[reverseStock] Sale un-cancelled — triggering fresh deduction');
        // Call deductStockOnSale logic by invoking it
        await base44.asServiceRole.functions.invoke('deductStockOnSale', {
          event: { type: 'create', entity_name: 'Sale', entity_id: event.entity_id },
          data: newSale
        });
        return Response.json({ success: true, action: 'deducted_after_uncancel' });
      }
      return Response.json({ skipped: true, reason: 'Old cancelled, new also cancelled or deleted' });
    }

    // Load recipes, supply items for this restaurant
    const [allRecipes, allSupplyItems, restaurants] = await Promise.all([
      base44.asServiceRole.entities.Recipe.filter({ restaurant_id: oldSale.restaurant_id }),
      base44.asServiceRole.entities.SupplyItem.filter({ restaurant_id: oldSale.restaurant_id }),
      base44.asServiceRole.entities.Restaurant.filter({ id: oldSale.restaurant_id }),
    ]);

    const restaurant = restaurants[0];
    const comboProducts = (restaurant?.combo_products || []).map(n => n.toLowerCase().trim());

    const recipesByName = {};
    for (const recipe of allRecipes) {
      if (recipe.dish_name) recipesByName[recipe.dish_name.toLowerCase().trim()] = recipe;
    }
    const supplyItemsByName = {};
    const supplyItemsById = {};
    for (const item of allSupplyItems) {
      if (item.name) supplyItemsByName[item.name.toLowerCase().trim()] = item;
      if (item.id) supplyItemsById[item.id] = item;
    }

    // Calculate deductions for a set of products (reused for old and new)
    const calculateDeductions = (products) => {
      const deductions = {};

      const processProductName = (rawName, quantitySold) => {
        const productName = rawName.toLowerCase().trim();
        if (!productName) return;
        const recipe = recipesByName[productName];

        if (!recipe) {
          const directSupply = supplyItemsByName[productName];
          if (directSupply) {
            if (!deductions[directSupply.id]) deductions[directSupply.id] = { item: directSupply, totalDeduct: 0 };
            deductions[directSupply.id].totalDeduct += quantitySold;
          }
          return;
        }

        const servings = recipe.servings || 1;
        for (const ingredient of (recipe.ingredients || [])) {
          let supplyItem = ingredient.supply_id ? supplyItemsById[ingredient.supply_id] : null;
          if (!supplyItem && ingredient.supply_name) supplyItem = supplyItemsByName[ingredient.supply_name.toLowerCase().trim()];
          if (!supplyItem) continue;
          const deductQty = parseFloat(((ingredient.quantity || 0) / servings * quantitySold).toFixed(6));
          if (deductQty <= 0) continue;
          if (!deductions[supplyItem.id]) deductions[supplyItem.id] = { item: supplyItem, totalDeduct: 0 };
          deductions[supplyItem.id].totalDeduct += deductQty;
        }

        for (const subRef of (recipe.sub_recipes || [])) {
          let subRecipe = subRef.recipe_id ? allRecipes.find(r => r.id === subRef.recipe_id) : null;
          if (!subRecipe && subRef.recipe_name) subRecipe = recipesByName[subRef.recipe_name.toLowerCase().trim()];
          if (!subRecipe) continue;
          const subServings = subRecipe.servings || 1;
          const subQtyNeeded = (subRef.quantity || 1) * quantitySold / servings;
          for (const ingredient of (subRecipe.ingredients || [])) {
            let supplyItem = ingredient.supply_id ? supplyItemsById[ingredient.supply_id] : null;
            if (!supplyItem && ingredient.supply_name) supplyItem = supplyItemsByName[ingredient.supply_name.toLowerCase().trim()];
            if (!supplyItem) continue;
            const deductQty = parseFloat(((ingredient.quantity || 0) / subServings * subQtyNeeded).toFixed(6));
            if (deductQty <= 0) continue;
            if (!deductions[supplyItem.id]) deductions[supplyItem.id] = { item: supplyItem, totalDeduct: 0 };
            deductions[supplyItem.id].totalDeduct += deductQty;
          }
        }
      };

      for (const product of (products || [])) {
        if (product.is_cancelled) continue;
        const rawName = (product.product_name || '').trim();
        if (!rawName) continue;
        const qty = product.quantity || 1;
        if (comboProducts.includes(rawName.toLowerCase().trim())) continue;

        if (rawName.includes('+')) {
          rawName.split('+').map(s => s.trim()).filter(Boolean).forEach(sub => processProductName(sub, qty));
        } else {
          processProductName(rawName, qty);
        }
      }
      return deductions;
    };

    // Step 1: Calculate what OLD sale deducted
    const oldDeductions = calculateDeductions(oldSale.products);

    // Step 2: Calculate what NEW sale should deduct (if update and not cancelled/deleted)
    let newDeductions = {};
    if (eventType === 'update' && newSale && !newSale.is_cancelled) {
      newDeductions = calculateDeductions(newSale.products);
    }

    // Step 3: Compute net delta per supply item (positive = add back, negative = deduct more)
    const allSupplyIds = new Set([...Object.keys(oldDeductions), ...Object.keys(newDeductions)]);
    const movements = [];
    const BATCH = 10;
    const entries = [];

    for (const supplyId of allSupplyIds) {
      const oldQty = oldDeductions[supplyId]?.totalDeduct || 0;
      const newQty = newDeductions[supplyId]?.totalDeduct || 0;
      const delta = oldQty - newQty; // positive = restore stock, negative = deduct more

      if (Math.abs(delta) < 0.001) continue;

      const item = oldDeductions[supplyId]?.item || newDeductions[supplyId]?.item;
      entries.push({ supplyId, item, delta });
    }

    // Fetch fresh stock once (not per item!)
    const freshItems = await base44.asServiceRole.entities.SupplyItem.filter({ restaurant_id: oldSale.restaurant_id });
    const freshItemsById = {};
    for (const fi of freshItems) freshItemsById[fi.id] = fi;

    // Apply in batches
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      await Promise.all(batch.map(async ({ supplyId, item, delta }) => {
        const freshItem = freshItemsById[supplyId];
        const currentStock = freshItem ? (freshItem.current_stock || 0) : (item.current_stock || 0);
        const newStock = parseFloat(Math.max(0, currentStock + delta).toFixed(3));

        await base44.asServiceRole.entities.SupplyItem.update(supplyId, { current_stock: newStock });

        const movementType = eventType === 'delete' ? 'adjustment' : 'adjustment';
        const reason = eventType === 'delete' 
          ? `Reversión por eliminación de venta ${oldSale.transaction_id || ''}`
          : `Ajuste por edición de venta ${oldSale.transaction_id || ''}`;

        movements.push({
          restaurant_id: oldSale.restaurant_id,
          product_name: item.name,
          product_id: supplyId,
          item_type: 'supply',
          movement_type: 'adjustment',
          quantity: delta,
          previous_stock: currentStock,
          new_stock: newStock,
          transaction_date: new Date().toISOString(),
          reference_id: oldSale.transaction_id || oldSale.id || event.entity_id,
          reference_name: reason,
          notes: reason
        });

        console.log(`[reverseStock] ${item.name}: ${currentStock} → ${newStock} (${delta > 0 ? '+' : ''}${delta.toFixed(3)}) | ${reason}`);
      }));
    }

    if (movements.length > 0) {
      await base44.asServiceRole.entities.StockMovement.bulkCreate(movements);
    }

    console.log(`[reverseStock] ${eventType} sale ${oldSale.transaction_id}: ${movements.length} adjustments`);

    return Response.json({
      success: true,
      event_type: eventType,
      sale_id: oldSale.transaction_id || event.entity_id,
      adjustments: movements.length
    });

  } catch (error) {
    console.error('[reverseStockOnSaleChange] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});