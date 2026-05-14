import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const TARGET_RESTAURANT_ID = '699676b8ec1e12cc8da50337';
const TARGET_RESTAURANT_NAME = 'IA Restaurant';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, maxRetries = 6) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error);
      if (!message.includes('429') && !message.toLowerCase().includes('rate limit')) {
        throw error;
      }
      await sleep(400 * attempt);
    }
  }
  throw lastError;
}

async function deleteByRestaurant(base44, entityKey) {
  try {
    const entity = base44.asServiceRole.entities[entityKey];
    if (!entity) {
      return { entity: entityKey, deleted: 0, skipped: true, reason: 'Entity not found' };
    }

    let deleted = 0;
    const MAX_WAVES = 200;

    for (let wave = 0; wave < MAX_WAVES; wave++) {
      const batch = await withRetry(() => entity.filter({ restaurant_id: TARGET_RESTAURANT_ID }, '-created_date', 20));
      if (!batch.length) break;

      for (const record of batch) {
        await withRetry(() => entity.delete(record.id));
        deleted += 1;
        await sleep(75);
      }

      if (batch.length < 20) break;
      await sleep(300);
    }

    return { entity: entityKey, deleted };
  } catch (error) {
    return { entity: entityKey, deleted: 0, skipped: true, reason: error.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const restaurants = await base44.asServiceRole.entities.Restaurant.filter({ id: TARGET_RESTAURANT_ID });
    const restaurant = restaurants?.[0];

    if (!restaurant) {
      return Response.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    if (restaurant.name !== TARGET_RESTAURANT_NAME) {
      return Response.json({
        error: `Safety check failed. Expected ${TARGET_RESTAURANT_NAME} but found ${restaurant.name}`
      }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedEntity = body.entityKey || null;

    const deletionOrder = requestedEntity ? [requestedEntity] : [
      'Customer',
      'Supplier',
      'InventoryCount',
      'RecipeSample',
      'RegistroMerma',
      'NPS',
      'OpEx',
      'Sale',
      'SupplyCost',
      'Recipe',
      'SupplyItem',
      'StockMovement',
      'DailyMetrics',
      'EmployeeMetrics',
      'Alert',
      'AlertConfig',
      'DailyCountConfig',
      'DeviationConfig',
      'SyncLog',
      'Restaurant'
    ];

    const results = [];
    for (const entityKey of deletionOrder) {
      if (entityKey === 'Restaurant') {
        await withRetry(() => base44.asServiceRole.entities.Restaurant.delete(TARGET_RESTAURANT_ID));
        results.push({ entity: 'Restaurant', deleted: 1 });
        continue;
      }
      const result = await deleteByRestaurant(base44, entityKey);
      results.push(result);
    }

    return Response.json({
      success: true,
      restaurant_id: TARGET_RESTAURANT_ID,
      restaurant_name: TARGET_RESTAURANT_NAME,
      deleted_entities: results,
      restaurant_deleted: deletionOrder.includes('Restaurant')
    });
  } catch (error) {
    console.error('deleteIaRestaurantData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});