import { base44 } from '@/api/base44Client';

/**
 * Processes stock updates when creating a new supply purchase.
 * - Adds received quantity to stock
 * - Creates stock movement
 * - Creates loss (RegistroMerma) if received < invoiced
 * - Auto-creates SupplyItem if it doesn't exist
 */
export async function processStockForNewPurchase({
  stockItems,
  supplyData,
  supplyItemsList,
  paymentDate,
  queryClient
}) {
  for (const stockItem of stockItems) {
    const itemCategory = stockItem.category || supplyData.supply_category || '';
    const receivedQty = (stockItem.received_quantity != null && stockItem.received_quantity >= 0)
      ? stockItem.received_quantity
      : stockItem.quantity;
    const invoicedQty = stockItem.quantity;
    const shortageQty = invoicedQty - receivedQty;

    let matchedSupply = supplyItemsList.find(s =>
      s.name?.toLowerCase() === stockItem.name?.toLowerCase() &&
      s.restaurant_id === supplyData.restaurant_id
    );

    if (!matchedSupply) {
      const itemSubtotal = parseFloat(stockItem.subtotal) || 0;
      const newSupplyItem = await base44.entities.SupplyItem.create({
        restaurant_id: supplyData.restaurant_id,
        name: stockItem.name,
        category: itemCategory,
        unit_of_measure: stockItem.unit || 'kg',
        current_stock: 0,
        average_unit_cost: invoicedQty > 0
          ? Math.round((itemSubtotal / invoicedQty) * 100) / 100
          : 0,
        supplier: supplyData.supplier || '',
        is_active: true
      });
      matchedSupply = { ...newSupplyItem, current_stock: 0 };
      queryClient?.invalidateQueries({ queryKey: ['supplyItems'] });
    }

    const newStock = (matchedSupply.current_stock || 0) + receivedQty;
    const itemSubtotal = parseFloat(stockItem.subtotal) || 0;
    await base44.entities.SupplyItem.update(matchedSupply.id, {
      current_stock: newStock,
      ...(invoicedQty > 0 && itemSubtotal > 0 ? {
        average_unit_cost: Math.round((itemSubtotal / invoicedQty) * 100) / 100
      } : {})
    });
    await base44.entities.StockMovement.create({
      restaurant_id: supplyData.restaurant_id,
      product_name: matchedSupply.name || stockItem.name,
      product_id: matchedSupply.id,
      item_type: 'supply',
      movement_type: 'purchase',
      quantity: receivedQty,
      previous_stock: matchedSupply.current_stock || 0,
      new_stock: newStock,
      transaction_date: paymentDate ? `${paymentDate}T12:00:00` : new Date().toISOString(),
      notes: `Compra - ${supplyData.supplier || 'Sin proveedor'}${shortageQty > 0 ? ` (Faltante proveedor: ${shortageQty} ${stockItem.unit || ''})` : ''}`
    });

    if (shortageQty > 0) {
      const purchaseUnitCost = invoicedQty > 0 && itemSubtotal > 0
        ? Math.round((itemSubtotal / invoicedQty) * 100) / 100
        : (matchedSupply.average_unit_cost || 0);
      await base44.entities.RegistroMerma.create({
        restaurant_id: supplyData.restaurant_id,
        date: supplyData.date || new Date().toISOString().split('T')[0],
        supply_name: matchedSupply.name || stockItem.name,
        supply_id: matchedSupply.id,
        quantity: shortageQty,
        unit: stockItem.unit || matchedSupply.unit_of_measure || 'kg',
        estimated_value: Math.round(shortageQty * purchaseUnitCost),
        reason: 'otro',
        notes: `Pérdida externa | facturado:${invoicedQty} | recibido:${receivedQty} | faltante:${shortageQty} | proveedor:${supplyData.supplier || 'N/A'} | factura:${supplyData.invoice_number || 'N/A'}`
      });
    }
  }
}

/**
 * Processes stock rectification when editing an already-processed purchase.
 * Computes delta between old and new received quantities, adjusts stock, and updates losses.
 */
export async function processStockRectification({
  stockItems,
  updateData,
  previousData,
  supplyItemsList,
  paymentDate
}) {
  // Build map of OLD received quantities
  const oldItemsMap = {};
  const prevItems = previousData.invoice_items || [];
  if (prevItems.length > 0) {
    prevItems.forEach(pi => {
      const key = (pi.name || '').toLowerCase().trim();
      oldItemsMap[key] = {
        receivedQty: pi.received_quantity != null ? parseFloat(pi.received_quantity) : parseFloat(pi.quantity) || 0,
        invoicedQty: parseFloat(pi.quantity) || 0
      };
    });
  } else if (previousData.supply_item_name) {
    const key = previousData.supply_item_name.toLowerCase().trim();
    oldItemsMap[key] = {
      receivedQty: previousData.quantity_received != null ? parseFloat(previousData.quantity_received) : parseFloat(previousData.quantity_purchased) || 0,
      invoicedQty: parseFloat(previousData.quantity_purchased) || 0
    };
  }

  for (const stockItem of stockItems) {
    const itemKey = (stockItem.name || '').toLowerCase().trim();
    const oldData = oldItemsMap[itemKey];

    const newReceivedQty = (stockItem.received_quantity != null && stockItem.received_quantity >= 0)
      ? stockItem.received_quantity
      : stockItem.quantity;
    const newInvoicedQty = stockItem.quantity;
    const oldReceivedQty = oldData ? oldData.receivedQty : 0;

    const delta = newReceivedQty - oldReceivedQty;
    if (Math.abs(delta) < 0.001) continue;

    let matchedSupply = supplyItemsList.find(s =>
      s.name?.toLowerCase() === itemKey &&
      s.restaurant_id === updateData.restaurant_id
    );

    if (!matchedSupply) continue;

    // Refresh current stock
    const freshList = await base44.entities.SupplyItem.filter({ restaurant_id: updateData.restaurant_id });
    const freshSupply = freshList.find(s => s.id === matchedSupply.id);
    const currentStock = freshSupply ? (freshSupply.current_stock || 0) : (matchedSupply.current_stock || 0);

    const newStock = Math.max(0, currentStock + delta);
    const itemSubtotal = parseFloat(stockItem.subtotal) || 0;

    await base44.entities.SupplyItem.update(matchedSupply.id, {
      current_stock: newStock,
      ...(newInvoicedQty > 0 && itemSubtotal > 0 ? {
        average_unit_cost: Math.round((itemSubtotal / newInvoicedQty) * 100) / 100
      } : {})
    });

    const txDate = paymentDate ? `${paymentDate}T12:00:00` : new Date().toISOString();
    await base44.entities.StockMovement.create({
      restaurant_id: updateData.restaurant_id,
      product_name: matchedSupply.name || stockItem.name,
      product_id: matchedSupply.id,
      item_type: 'supply',
      movement_type: 'adjustment',
      quantity: delta,
      previous_stock: currentStock,
      new_stock: newStock,
      transaction_date: txDate,
      notes: `Rectificación compra | antes recibido:${oldReceivedQty} | ahora recibido:${newReceivedQty} | ajuste:${delta > 0 ? '+' : ''}${delta} | ${updateData.supplier || 'Sin proveedor'} | factura:${updateData.invoice_number || 'N/A'}`
    });

    // Handle loss changes
    const newShortage = newInvoicedQty - newReceivedQty;
    const oldShortage = oldData ? (oldData.invoicedQty - oldData.receivedQty) : 0;

    if (Math.abs(newShortage - oldShortage) >= 0.001) {
      const purchaseUnitCost = newInvoicedQty > 0 && itemSubtotal > 0
        ? Math.round((itemSubtotal / newInvoicedQty) * 100) / 100
        : (matchedSupply.average_unit_cost || 0);

      // Delete old loss records for this purchase+item
      const oldLosses = await base44.entities.RegistroMerma.filter({
        restaurant_id: updateData.restaurant_id,
        supply_name: matchedSupply.name || stockItem.name
      });
      const invoiceRef = previousData.invoice_number || updateData.invoice_number || 'N/A';
      const relatedLosses = oldLosses.filter(l =>
        l.notes && l.notes.includes(`factura:${invoiceRef}`) && l.notes.includes('Pérdida externa')
      );
      for (const loss of relatedLosses) {
        await base44.entities.RegistroMerma.delete(loss.id);
      }

      if (newShortage > 0) {
        await base44.entities.RegistroMerma.create({
          restaurant_id: updateData.restaurant_id,
          date: updateData.date || new Date().toISOString().split('T')[0],
          supply_name: matchedSupply.name || stockItem.name,
          supply_id: matchedSupply.id,
          quantity: newShortage,
          unit: stockItem.unit || matchedSupply.unit_of_measure || 'kg',
          estimated_value: Math.round(newShortage * purchaseUnitCost),
          reason: 'otro',
          notes: `Pérdida externa | facturado:${newInvoicedQty} | recibido:${newReceivedQty} | faltante:${newShortage} | proveedor:${updateData.supplier || 'N/A'} | factura:${updateData.invoice_number || 'N/A'}`
        });
      }
    }
  }
}