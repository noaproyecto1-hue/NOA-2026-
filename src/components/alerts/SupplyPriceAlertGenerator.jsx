import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Componente que genera alertas automáticas al detectar cambios de precio en insumos.
 * Se ejecuta cuando se importan nuevas compras.
 * 
 * Detecta:
 * - Subida de precio de un insumo respecto a última compra (>10%)
 * - Bajada significativa de precio (oportunidad)
 * - Volumen de compra inusual vs promedio
 */
export default function SupplyPriceAlertGenerator({ 
  restaurantId, 
  newPurchases = [], // Las compras recién importadas
  historicalPurchases = [], // Historial de compras para comparar
  onAlertsGenerated,
  autoAlertsEnabled = false, // Por defecto desactivado
  alertThresholds = {} // Umbrales configurables del restaurante
}) {
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  const createAlertMutation = useMutation({
    mutationFn: (alertData) => base44.entities.Alert.create(alertData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });

  useEffect(() => {
    // Solo ejecutar si las alertas automáticas están habilitadas
    if (!autoAlertsEnabled) return;
    
    if (!restaurantId || newPurchases.length === 0 || hasRun.current) return;
    
    hasRun.current = true;
    generatePriceAlerts();
    
    return () => {
      hasRun.current = false;
    };
  }, [restaurantId, newPurchases]);

  // Check for existing non-resolved alert of same type+item to prevent duplicates
  const alertExistsForItem = async (type, itemName) => {
    const existing = await base44.entities.Alert.filter({
      restaurant_id: restaurantId,
      type: type,
      is_resolved: false
    });
    return existing.some(a => a.related_item_name === itemName);
  };

  const generatePriceAlerts = async () => {
    const alertsToCreate = [];
    // Usar umbral configurable del restaurante, o 15% por defecto
    const priceChangeThreshold = (alertThresholds.cost_spike_percent || 15) / 100;
    const volumeChangeThreshold = 0.50; // 50% más volumen de lo usual

    // Agrupar historial por insumo
    const historicalByItem = {};
    historicalPurchases.forEach(purchase => {
      const key = purchase.supply_item_name || purchase.supply_category;
      if (!historicalByItem[key]) {
        historicalByItem[key] = [];
      }
      historicalByItem[key].push(purchase);
    });

    // Analizar cada nueva compra
    for (const newPurchase of newPurchases) {
      const itemKey = newPurchase.supply_item_name || newPurchase.supply_category;
      const historical = historicalByItem[itemKey] || [];
      
      if (historical.length === 0) continue; // Sin historial, no podemos comparar

      // Calcular precio unitario de la nueva compra
      const newUnitPrice = newPurchase.quantity_purchased > 0 
        ? newPurchase.subtotal / newPurchase.quantity_purchased 
        : newPurchase.subtotal;

      // Obtener última compra del mismo insumo
      const sortedHistorical = historical.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      const lastPurchase = sortedHistorical[0];
      
      const lastUnitPrice = lastPurchase.quantity_purchased > 0
        ? lastPurchase.subtotal / lastPurchase.quantity_purchased
        : lastPurchase.subtotal;

      // Calcular cambio porcentual
      if (lastUnitPrice > 0) {
        const priceChange = (newUnitPrice - lastUnitPrice) / lastUnitPrice;

        // Alerta de subida de precio - PRIORIDAD ALTA (estos son costos específicos y accionables)
        if (priceChange > priceChangeThreshold) {
          const percentChange = (priceChange * 100).toFixed(1);
          // Determinar severidad: >30% rojo, >20% rojo, resto amarillo
          let severity = 'yellow';
          if (priceChange > 0.20) severity = 'red';
          
          alertsToCreate.push({
            restaurant_id: restaurantId,
            type: 'supply_price_increase',
            category: 'costo_ventas',
            severity,
            title: `⚠️ Subió precio: ${itemKey}`,
            message: `El precio de ${itemKey} aumentó ${percentChange}% respecto a la última compra. Precio anterior: $${lastUnitPrice.toFixed(0)} → Nuevo: $${newUnitPrice.toFixed(0)}`,
            suggested_action: `Negociar con proveedor ${newPurchase.supplier || 'actual'}, buscar alternativas o ajustar precio de venta`,
            related_item_name: itemKey,
            metadata: {
              previous_price: lastUnitPrice,
              new_price: newUnitPrice,
              percent_change: priceChange * 100,
              supplier: newPurchase.supplier,
              unit: newPurchase.unit_of_measure
            }
          });
        }

        // Alerta de bajada de precio (oportunidad)
        if (priceChange < -priceChangeThreshold) {
          const percentChange = Math.abs(priceChange * 100).toFixed(1);
          alertsToCreate.push({
            restaurant_id: restaurantId,
            type: 'supply_price_decrease',
            category: 'costo_ventas',
            severity: 'green',
            title: `Bajó precio: ${itemKey}`,
            message: `Buena noticia: ${itemKey} bajó ${percentChange}% de precio. Considera comprar más cantidad.`,
            suggested_action: 'Evaluar si conviene aumentar inventario aprovechando el precio',
            related_item_name: itemKey,
            metadata: {
              previous_price: lastUnitPrice,
              new_price: newUnitPrice,
              percent_change: priceChange * 100,
              supplier: newPurchase.supplier
            }
          });
        }
      }

      // Detectar volumen de compra inusual
      if (historical.length >= 3 && newPurchase.quantity_purchased > 0) {
        const avgQuantity = historical.reduce((sum, p) => sum + (p.quantity_purchased || 0), 0) / historical.length;
        
        if (avgQuantity > 0) {
          const volumeChange = (newPurchase.quantity_purchased - avgQuantity) / avgQuantity;
          
          if (volumeChange > volumeChangeThreshold) {
            alertsToCreate.push({
              restaurant_id: restaurantId,
              type: 'unusual_purchase_volume',
              category: 'costo_ventas',
              severity: 'green',
              title: `Compra alta: ${itemKey}`,
              message: `Se compró ${(volumeChange * 100).toFixed(0)}% más de ${itemKey} que el promedio usual (${avgQuantity.toFixed(1)} ${newPurchase.unit_of_measure || 'unidades'}).`,
              suggested_action: 'Verificar si es compra planificada o error',
              related_item_name: itemKey,
              metadata: {
                average_quantity: avgQuantity,
                purchased_quantity: newPurchase.quantity_purchased,
                percent_above_average: volumeChange * 100
              }
            });
          }
        }
      }
    }

    // Crear las alertas, skipping duplicates
    const filteredAlerts = [];
    for (const alert of alertsToCreate) {
      const isDuplicate = await alertExistsForItem(alert.type, alert.related_item_name);
      if (!isDuplicate) filteredAlerts.push(alert);
    }
    for (const alert of filteredAlerts) {
      await createAlertMutation.mutateAsync(alert);
    }

    if (onAlertsGenerated && filteredAlerts.length > 0) {
      onAlertsGenerated(filteredAlerts.length);
    }
  };

  return null; // Este componente no renderiza nada
}