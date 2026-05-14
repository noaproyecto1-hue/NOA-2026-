import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Función que se ejecuta automáticamente cuando se crea una Sale.
 * Busca recetas asociadas a los productos vendidos y descuenta ingredientes del inventario.
 * Registra movimientos de stock para trazabilidad.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Entity automation payload
    const { event, data } = body;

    // Solo procesar eventos de creación
    if (event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'Not a create event' });
    }

    const sale = data;
    if (!sale || !sale.restaurant_id) {
      return Response.json({ skipped: true, reason: 'No sale data or restaurant_id' });
    }

    // FUDO sales: stock is deducted in consolidated batch by autoSyncFudoSales
    // to avoid race conditions when multiple sales are created via bulkCreate.
    // Only manual/Excel sales should be deducted here.
    if (sale.transaction_id?.startsWith('FUDO-')) {
      return Response.json({ skipped: true, reason: 'FUDO sale — stock handled by autoSyncFudoSales' });
    }

    // Si la venta está cancelada, no descontar
    if (sale.is_cancelled) {
      return Response.json({ skipped: true, reason: 'Sale is cancelled' });
    }

    const products = sale.products || [];
    if (products.length === 0) {
      return Response.json({ skipped: true, reason: 'No products in sale' });
    }

    // Cargar recetas, supply items y configuración del restaurante
    const [allRecipes, allSupplyItems, restaurants] = await Promise.all([
      base44.asServiceRole.entities.Recipe.filter({ restaurant_id: sale.restaurant_id }),
      base44.asServiceRole.entities.SupplyItem.filter({ restaurant_id: sale.restaurant_id }),
      base44.asServiceRole.entities.Restaurant.filter({ id: sale.restaurant_id }),
    ]);

    // Lista de productos combo/contenedor que NO necesitan match
    const restaurant = restaurants[0];
    const comboProducts = (restaurant?.combo_products || []).map(n => n.toLowerCase().trim());

    // Crear mapas para búsqueda rápida
    const recipesByName = {};
    for (const recipe of allRecipes) {
      if (recipe.dish_name) {
        recipesByName[recipe.dish_name.toLowerCase().trim()] = recipe;
      }
    }

    const supplyItemsByName = {};
    const supplyItemsById = {};
    for (const item of allSupplyItems) {
      if (item.name) supplyItemsByName[item.name.toLowerCase().trim()] = item;
      if (item.id) supplyItemsById[item.id] = item;
    }

    // Build set of sub-recipe names to exclude from direct supply matching
    const subRecipeNames = new Set();
    for (const recipe of allRecipes) {
      if (recipe.is_sub_recipe && recipe.dish_name) {
        subRecipeNames.add(recipe.dish_name.toLowerCase().trim());
      }
    }

    // Mapa para acumular deducciones de stock: supplyItemId -> totalQuantityToDeduct
    const deductions = {};
    const deductionDetails = []; // Para logs

    // Helper: recursively expand recipe ingredients, handling nested sub-recipes
    const expandRecipe = (recipe, multiplier, originalProductName, depth = 0) => {
      if (depth > 5) return; // safety limit
      const servings = recipe.servings || 1;

      // Process direct ingredients
      for (const ingredient of (recipe.ingredients || [])) {
        let supplyItem = null;
        if (ingredient.supply_id) supplyItem = supplyItemsById[ingredient.supply_id];
        if (!supplyItem && ingredient.supply_name) {
          supplyItem = supplyItemsByName[ingredient.supply_name.toLowerCase().trim()];
        }

        // If this ingredient name matches a sub-recipe, expand it recursively instead
        const ingLower = ingredient.supply_name?.toLowerCase().trim();
        if (ingLower && recipesByName[ingLower] && recipesByName[ingLower].is_sub_recipe) {
          const subRecipe = recipesByName[ingLower];
          const subMultiplier = multiplier * (ingredient.quantity || 0) / servings;
          expandRecipe(subRecipe, subMultiplier, originalProductName, depth + 1);
          continue;
        }

        if (!supplyItem) continue;

        const ingredientQty = ingredient.quantity || 0;
        const deductQty = parseFloat(((ingredientQty / servings) * multiplier).toFixed(6));
        if (deductQty <= 0) continue;

        if (!deductions[supplyItem.id]) {
          deductions[supplyItem.id] = { item: supplyItem, totalDeduct: 0, sources: [] };
        }
        deductions[supplyItem.id].totalDeduct += deductQty;
        deductions[supplyItem.id].sources.push(`${originalProductName} x${multiplier}`);
      }

      // Process sub-recipes referenced in recipe.sub_recipes
      for (const subRef of (recipe.sub_recipes || [])) {
        let subRecipe = null;
        if (subRef.recipe_id) subRecipe = allRecipes.find(r => r.id === subRef.recipe_id);
        if (!subRecipe && subRef.recipe_name) subRecipe = recipesByName[subRef.recipe_name.toLowerCase().trim()];
        if (!subRecipe) continue;

        const subQtyNeeded = (subRef.quantity || 1) * multiplier / servings;
        expandRecipe(subRecipe, subQtyNeeded, originalProductName, depth + 1);
      }
    };

    // Helper: procesar un nombre de producto individual contra recetas e insumos
    const processProductName = (rawName, quantitySold, originalProductName) => {
      const productName = rawName.toLowerCase().trim();
      if (!productName) return;

      const recipe = recipesByName[productName];

      // CASO 1: No hay receta → buscar si el producto es un insumo directo
      // BUT skip if it's a sub-recipe name (sub-recipes should only be expanded, not deducted directly)
      if (!recipe) {
        if (subRecipeNames.has(productName)) {
          console.log(`[Sub-recipe skip] "${rawName}" is a sub-recipe — skipping direct deduction`);
          return;
        }
        const directSupply = supplyItemsByName[productName];
        if (directSupply) {
          if (!deductions[directSupply.id]) {
            deductions[directSupply.id] = { item: directSupply, totalDeduct: 0, sources: [] };
          }
          deductions[directSupply.id].totalDeduct += quantitySold;
          deductions[directSupply.id].sources.push(`${originalProductName} (directo) x${quantitySold}`);
          console.log(`[Direct match] ${originalProductName} → SupplyItem "${directSupply.name}" x${quantitySold}`);
        }
        return;
      }

      // CASO 2: Tiene receta → expandir recursivamente
      expandRecipe(recipe, quantitySold, originalProductName, 0);
    };

    for (const product of products) {
      // Saltar productos cancelados
      if (product.is_cancelled) continue;

      const rawProductName = (product.product_name || '').trim();
      if (!rawProductName) continue;

      const quantitySold = product.quantity || 1;

      // Skip combo/container products — inventory is deducted via their sub-items
      if (comboProducts.includes(rawProductName.toLowerCase().trim())) {
        console.log(`[Combo skip] "${rawProductName}" is a combo/container product — skipping direct deduction`);
        continue;
      }

      // If name contains "+", split into individual products
      if (rawProductName.includes('+')) {
        const subProducts = rawProductName.split('+').map(s => s.trim()).filter(Boolean);
        console.log(`[Split] "${rawProductName}" → ${subProducts.length} sub-productos: ${subProducts.join(', ')}`);
        for (const subProductName of subProducts) {
          processProductName(subProductName, quantitySold, rawProductName);
        }
        continue;
      }

      processProductName(rawProductName, quantitySold, rawProductName);
    }

    // Detectar productos sin match — solo si hay inventario configurado (al menos 1 receta o 1 insumo)
    const hasInventorySetup = allRecipes.length > 0 || allSupplyItems.length > 0;
    const unmatchedProducts = [];

    if (hasInventorySetup) {
      for (const product of products) {
        if (product.is_cancelled) continue;
        if (product.is_extra) continue;
        const rawName = (product.product_name || '').trim();
        if (!rawName) continue;

        // Si tiene "+", verificar cada sub-producto por separado
        const namesToCheck = rawName.includes('+')
          ? rawName.split('+').map(s => s.trim()).filter(Boolean)
          : [rawName];

        for (const name of namesToCheck) {
          const lowerName = name.toLowerCase().trim();
          // Skip combo/container products (e.g. MENU EJECUTIVO)
          if (comboProducts.includes(lowerName)) continue;
          const hasRecipe = !!recipesByName[lowerName];
          const hasDirectSupply = !!supplyItemsByName[lowerName];
          if (!hasRecipe && !hasDirectSupply) {
            unmatchedProducts.push(name);
          }
        }
      }

      if (unmatchedProducts.length > 0) {
        const uniqueUnmatched = [...new Set(unmatchedProducts)];
        console.log(`[deductStockOnSale] ⚠️ ${uniqueUnmatched.length} productos sin match: ${uniqueUnmatched.join(', ')}`);
        try {
          await base44.asServiceRole.entities.Alert.create({
            restaurant_id: sale.restaurant_id,
            type: 'custom',
            category: 'inventario',
            severity: 'yellow',
            title: `${uniqueUnmatched.length} producto(s) de FUDO sin match en inventario`,
            message: `Los siguientes productos vendidos en FUDO no tienen receta ni insumo asociado en NOA, por lo que NO se descontó inventario: ${uniqueUnmatched.slice(0, 10).join(', ')}${uniqueUnmatched.length > 10 ? ` y ${uniqueUnmatched.length - 10} más...` : ''}`,
            suggested_action: 'Revisa los nombres de estos productos en FUDO y asegúrate de que coincidan exactamente con una receta o insumo en NOA. Si son productos válidos, crea la receta o insumo correspondiente.',
            metadata: { unmatched_products: uniqueUnmatched, sale_id: sale.transaction_id || sale.id },
            is_read: false,
            is_resolved: false
          });
        } catch (alertErr) {
          console.error('[deductStockOnSale] Error creating unmatched alert:', alertErr.message);
        }
      }
    } else {
      console.log('[deductStockOnSale] No inventory setup yet — skipping unmatched product alerts');
    }

    // Aplicar deducciones
    const deductionEntries = Object.entries(deductions);
    if (deductionEntries.length === 0) {
      return Response.json({ 
        success: true, 
        deducted: 0,
        unmatched_products: unmatchedProducts,
        message: 'No matching recipes/ingredients found for this sale' 
      });
    }

    const movements = [];

    // Actualizar stock en paralelo (batches de 10 para no saturar)
    const BATCH = 10;
    for (let i = 0; i < deductionEntries.length; i += BATCH) {
      const batch = deductionEntries.slice(i, i + BATCH);
      await Promise.all(batch.map(async ([supplyItemId, info]) => {
        const { item, totalDeduct, sources } = info;
        const previousStock = item.current_stock || 0;
        const newStock = parseFloat(Math.max(0, previousStock - totalDeduct).toFixed(3));

        await base44.asServiceRole.entities.SupplyItem.update(supplyItemId, {
          current_stock: newStock
        });

        movements.push({
          restaurant_id: sale.restaurant_id,
          product_name: item.name,
          product_id: supplyItemId,
          item_type: 'supply',
          movement_type: 'sale',
          quantity: -totalDeduct,
          previous_stock: previousStock,
          new_stock: newStock,
          transaction_date: sale.date_time || new Date().toISOString(),
          reference_id: sale.transaction_id || sale.id,
          reference_name: sources.join(', '),
          notes: `Descuento automático por venta ${sale.transaction_id || ''}`
        });

        console.log(`[Stock] ${item.name}: ${previousStock} → ${newStock} (-${totalDeduct.toFixed(3)}) | ${sources.join(', ')}`);
      }));
    }

    const deducted = movements.length;

    // Registrar todos los movimientos en bulk
    if (movements.length > 0) {
      await base44.asServiceRole.entities.StockMovement.bulkCreate(movements);
    }

    console.log(`[deductStockOnSale] Sale ${sale.transaction_id}: ${deducted} ingredients deducted from ${products.length} products`);

    return Response.json({
      success: true,
      sale_id: sale.transaction_id,
      products_count: products.length,
      deducted,
      movements_created: movements.length,
      message: `Stock deducted for ${deducted} ingredients`
    });

  } catch (error) {
    console.error('[deductStockOnSale] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});