import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Genera alertas de stock bajo para productos e insumos.
 * Verifica duplicados directamente en BD para evitar alertas repetidas.
 * Solo se ejecuta UNA VEZ por montaje del componente.
 */
export default function StockAlertGenerator({
  restaurantId,
  inventory = [],
  supplyItems = []
}) {
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  const createAlertMutation = useMutation({
    mutationFn: (alertData) => base44.entities.Alert.create(alertData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] })
  });

  useEffect(() => {
    // Solo ejecutar UNA VEZ por montaje, y solo cuando tengamos datos
    if (hasRun.current || !restaurantId) return;
    if (inventory.length === 0 && supplyItems.length === 0) return;

    hasRun.current = true;
    generateStockAlerts();
  }, [restaurantId, inventory, supplyItems]);

  const generateStockAlerts = async () => {
    // Fetch existing non-resolved alerts FRESH from DB to avoid race conditions
    let existingAlerts = [];
    try {
      existingAlerts = await base44.entities.Alert.filter({
        restaurant_id: restaurantId,
        is_resolved: false
      });
    } catch (e) {
      console.warn('Could not fetch existing alerts for dedup check:', e);
      return; // Don't generate if we can't check for duplicates
    }

    const alertAlreadyExists = (type, itemId, itemName) => {
      return existingAlerts.some(a => {
        if (a.type === type) {
          if (itemId && a.related_item_id === itemId) return true;
          if (itemName && a.related_item_name === itemName) return true;
        }
        return false;
      });
    };

    const alerts = [];

    // 1. Alertas de productos con stock bajo
    const filteredInventory = inventory.filter(i => i.restaurant_id === restaurantId);
    for (const item of filteredInventory) {
      const current = item.current_stock || 0;
      const minStock = item.min_stock || 0;
      const warningStock = item.warning_stock || 0;

      if (minStock > 0 && current <= minStock) {
        if (!alertAlreadyExists('low_stock_product', item.id, item.product_name)) {
          alerts.push({
            restaurant_id: restaurantId,
            type: 'low_stock_product',
            severity: 'red',
            title: `Stock Crítico: ${item.product_name}`,
            message: `El producto "${item.product_name}" tiene ${current} ${item.unit_of_measure || 'unidades'} en stock. Nivel crítico configurado: ${minStock}.`,
            suggested_action: 'Realizar pedido urgente al proveedor o ajustar el menú temporalmente.',
            related_item_id: item.id,
            related_item_name: item.product_name
          });
        }
      } else if (warningStock > 0 && current <= warningStock) {
        if (!alertAlreadyExists('low_stock_product', item.id, item.product_name)) {
          alerts.push({
            restaurant_id: restaurantId,
            type: 'low_stock_product',
            severity: 'yellow',
            title: `Stock Bajo: ${item.product_name}`,
            message: `El producto "${item.product_name}" tiene ${current} ${item.unit_of_measure || 'unidades'} en stock. Nivel de advertencia: ${warningStock}.`,
            suggested_action: 'Programar reabastecimiento próximamente.',
            related_item_id: item.id,
            related_item_name: item.product_name
          });
        }
      }
    }

    // 2. Alertas de insumos con stock bajo
    const filteredSupplies = supplyItems.filter(s => s.restaurant_id === restaurantId);
    for (const item of filteredSupplies) {
      const current = item.current_stock || 0;
      const minStock = item.min_stock || 0;
      const warningStock = item.warning_stock || 0;

      if (minStock > 0 && current <= minStock) {
        if (!alertAlreadyExists('low_stock_supply', item.id, item.name)) {
          alerts.push({
            restaurant_id: restaurantId,
            type: 'low_stock_supply',
            severity: 'red',
            title: `Insumo Crítico: ${item.name}`,
            message: `El insumo "${item.name}" tiene ${current} ${item.unit_of_measure || 'unidades'} en stock. Nivel crítico configurado: ${minStock}.`,
            suggested_action: 'Contactar al proveedor inmediatamente para reabastecer.',
            related_item_id: item.id,
            related_item_name: item.name
          });
        }
      } else if (warningStock > 0 && current <= warningStock) {
        if (!alertAlreadyExists('low_stock_supply', item.id, item.name)) {
          alerts.push({
            restaurant_id: restaurantId,
            type: 'low_stock_supply',
            severity: 'yellow',
            title: `Insumo Bajo: ${item.name}`,
            message: `El insumo "${item.name}" tiene ${current} ${item.unit_of_measure || 'unidades'} en stock. Nivel de advertencia: ${warningStock}.`,
            suggested_action: 'Incluir en el próximo pedido de compras.',
            related_item_id: item.id,
            related_item_name: item.name
          });
        }
      }
    }

    // Crear alertas secuencialmente para evitar race conditions
    for (const alert of alerts) {
      try {
        await createAlertMutation.mutateAsync(alert);
      } catch (e) {
        console.warn('Failed to create stock alert:', e);
      }
    }
  };

  return null;
}