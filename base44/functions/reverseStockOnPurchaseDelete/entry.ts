import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Revierte el stock cuando se elimina una compra (SupplyCost).
 * Se ejecuta como entity automation en SupplyCost (delete).
 *
 * Si la compra tenía stock_updated=true, busca los items y resta
 * la cantidad recibida del stock actual del SupplyItem.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, old_data } = body;

    if (!event || event.type !== 'delete') {
      return Response.json({ skipped: true, reason: 'Not a delete event' });
    }

    const purchase = old_data;
    if (!purchase?.restaurant_id) {
      return Response.json({ skipped: true, reason: 'No restaurant_id' });
    }

    // Only reverse if stock was actually updated for this purchase
    if (!purchase.stock_updated) {
      return Response.json({ skipped: true, reason: 'stock_updated was false, nothing to reverse' });
    }

    // Determine which items had stock added
    const itemsToReverse = [];

    if (purchase.invoice_items && purchase.invoice_items.length > 0) {
      for (const item of purchase.invoice_items) {
        if (!item.name) continue;
        const receivedQty = (item.received_quantity != null && item.received_quantity >= 0)
          ? parseFloat(item.received_quantity)
          : parseFloat(item.quantity) || 0;
        if (receivedQty <= 0) continue;
        itemsToReverse.push({ name: item.name, quantity: receivedQty, unit: item.unit || 'kg' });
      }
    } else if (purchase.supply_item_name) {
      const receivedQty = (purchase.quantity_received != null && purchase.quantity_received >= 0)
        ? parseFloat(purchase.quantity_received)
        : parseFloat(purchase.quantity_purchased) || 0;
      if (receivedQty > 0) {
        itemsToReverse.push({ name: purchase.supply_item_name, quantity: receivedQty, unit: purchase.unit_of_measure || 'kg' });
      }
    }

    if (itemsToReverse.length === 0) {
      return Response.json({ skipped: true, reason: 'No items to reverse' });
    }

    // Fetch supply items for this restaurant
    const allSupplyItems = await base44.asServiceRole.entities.SupplyItem.filter({ 
      restaurant_id: purchase.restaurant_id 
    });

    const movements = [];

    for (const item of itemsToReverse) {
      const matched = allSupplyItems.find(s => 
        s.name?.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      if (!matched) {
        console.log(`[reverseStockOnPurchaseDelete] SupplyItem "${item.name}" not found, skipping`);
        continue;
      }

      const currentStock = matched.current_stock || 0;
      const newStock = parseFloat(Math.max(0, currentStock - item.quantity).toFixed(3));

      await base44.asServiceRole.entities.SupplyItem.update(matched.id, {
        current_stock: newStock
      });

      movements.push({
        restaurant_id: purchase.restaurant_id,
        product_name: matched.name,
        product_id: matched.id,
        item_type: 'supply',
        movement_type: 'adjustment',
        quantity: -item.quantity,
        previous_stock: currentStock,
        new_stock: newStock,
        transaction_date: new Date().toISOString(),
        reference_id: purchase.invoice_number || purchase.id || event.entity_id,
        reference_name: `Reversión por eliminación de compra | ${purchase.supplier || 'Sin proveedor'} | factura: ${purchase.invoice_number || 'N/A'}`,
        notes: `Stock revertido por eliminación de compra. Proveedor: ${purchase.supplier || 'N/A'}, Fecha: ${purchase.date || 'N/A'}`
      });

      console.log(`[reverseStockOnPurchaseDelete] ${matched.name}: ${currentStock} → ${newStock} (-${item.quantity})`);
    }

    if (movements.length > 0) {
      await base44.asServiceRole.entities.StockMovement.bulkCreate(movements);
    }

    console.log(`[reverseStockOnPurchaseDelete] Reversed ${movements.length} items for purchase ${purchase.invoice_number || event.entity_id}`);

    return Response.json({
      success: true,
      reversed_items: movements.length,
      purchase_id: event.entity_id
    });

  } catch (error) {
    console.error('[reverseStockOnPurchaseDelete] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});