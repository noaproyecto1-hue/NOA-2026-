import { base44 } from '@/api/base44Client';

const PAGE_SIZE = 5000;
const MAX_RECORDS = 100000;

/**
 * Fetch all records from an entity using pagination (skip-based).
 * Returns up to MAX_RECORDS items.
 */
export async function fetchAllRecords(entityName, filter = {}, sort = '-created_date') {
  let allRecords = [];
  let skip = 0;

  while (skip < MAX_RECORDS) {
    const batch = await base44.entities[entityName].filter(filter, sort, PAGE_SIZE, skip);
    allRecords = allRecords.concat(batch);
    if (batch.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  return allRecords;
}

/**
 * Fetch all records for multiple restaurant IDs in parallel.
 */
export async function fetchAllForRestaurants(entityName, restaurantIds, extraFilter = {}, sort = '-created_date') {
  if (!restaurantIds || restaurantIds.length === 0) return [];
  const promises = restaurantIds.map(id =>
    fetchAllRecords(entityName, { restaurant_id: id, ...extraFilter }, sort).catch(() => [])
  );
  return (await Promise.all(promises)).flat();
}