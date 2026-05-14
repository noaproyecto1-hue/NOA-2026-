import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Bulk delete data for a restaurant with timezone-aware date filtering.
 * 
 * When a restaurant is in America/Santiago and the user picks "2025-03-01" to "2025-03-31",
 * the date range must be interpreted in Santiago time, not UTC.
 * A sale at 2025-03-31T23:00 Santiago time = 2025-04-01T02:00 UTC — it should be included.
 */

// Convert a local date string + time to a UTC ISO string
// e.g. "2025-03-01" + "00:00:00" + "America/Santiago" → UTC equivalent
function localDateToUTC(dateStr, timeStr, timezone) {
  // Build an ISO string and use Intl to figure out the offset
  const localStr = `${dateStr}T${timeStr}`;
  
  // Get the UTC offset for this timezone at this specific date/time
  const localDate = new Date(localStr + 'Z'); // treat as UTC first
  
  // Use Intl.DateTimeFormat to get the timezone offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  
  // Get what this UTC moment looks like in the target timezone
  const parts = formatter.formatToParts(localDate);
  const get = (type) => parts.find(p => p.type === type)?.value;
  
  const tzYear = parseInt(get('year'));
  const tzMonth = parseInt(get('month'));
  const tzDay = parseInt(get('day'));
  const tzHour = parseInt(get('hour') === '24' ? '0' : get('hour'));
  const tzMinute = parseInt(get('minute'));
  
  // The difference between what we wanted (localStr) and what we got (tz representation)
  // tells us the offset
  const wantedDate = new Date(localStr + 'Z');
  const gotDate = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0));
  
  const offsetMs = gotDate.getTime() - wantedDate.getTime();
  
  // Apply the offset: local time - offset = UTC time
  // If Santiago is UTC-3, a local 00:00 should become 03:00 UTC
  return new Date(wantedDate.getTime() + offsetMs);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action, restaurantId, entityKey, dateFrom, dateTo, dateField, timezone } = await req.json();

    if (!restaurantId || !entityKey) {
      return Response.json({ error: 'Missing restaurantId or entityKey' }, { status: 400 });
    }

    const entity = base44.asServiceRole.entities[entityKey];
    if (!entity) {
      return Response.json({ error: `Entity ${entityKey} not found` }, { status: 400 });
    }

    const tz = timezone || 'America/Santiago';

    // Build UTC date boundaries from local timezone dates
    let utcFrom = null;
    let utcTo = null;
    if (dateFrom && dateTo && dateField) {
      utcFrom = localDateToUTC(dateFrom, '00:00:00', tz);
      utcTo = localDateToUTC(dateTo, '23:59:59', tz);
      console.log(`Date filter: ${dateFrom} → ${dateTo} in ${tz}`);
      console.log(`UTC range: ${utcFrom.toISOString()} → ${utcTo.toISOString()}`);
    }

    // Helper: does a record match the date filter?
    const matchesDateFilter = (record) => {
      if (!utcFrom || !utcTo || !dateField) return true;
      const val = record[dateField];
      if (!val) return false;
      const d = new Date(val);
      return d >= utcFrom && d <= utcTo;
    };

    // ACTION: count
    if (action === 'count') {
      // Fetch up to 100 to get a count. For exact counts on large datasets,
      // we'll indicate if there are potentially more.
      const batch = await entity.filter(
        { restaurant_id: restaurantId },
        '-created_date',
        100
      );
      
      const matching = batch.filter(matchesDateFilter);
      
      return Response.json({ 
        count: matching.length,
        totalInRestaurant: batch.length,
        hasMore: batch.length >= 100
      });
    }

    // ACTION: delete — delete all matching records in waves
    if (action === 'delete') {
      let totalDeleted = 0;
      const MAX_WAVES = 100; // Safety: 100 waves × 100 records = 10,000 max
      
      for (let wave = 0; wave < MAX_WAVES; wave++) {
        const batch = await entity.filter(
          { restaurant_id: restaurantId },
          '-created_date',
          100
        );
        
        if (batch.length === 0) break;
        
        const toDelete = batch.filter(matchesDateFilter);
        
        if (toDelete.length === 0) break;
        
        // Delete in parallel chunks of 10
        for (let i = 0; i < toDelete.length; i += 10) {
          const chunk = toDelete.slice(i, i + 10);
          await Promise.all(chunk.map(record => entity.delete(record.id)));
        }
        
        totalDeleted += toDelete.length;
        
        // If batch had less than 100, no more records exist
        if (batch.length < 100) break;
        
        // Small delay between waves
        await new Promise(r => setTimeout(r, 200));
      }
      
      return Response.json({ 
        deleted: totalDeleted,
        entityKey,
        timezone: tz
      });
    }

    return Response.json({ error: 'Invalid action. Use "count" or "delete"' }, { status: 400 });
    
  } catch (error) {
    console.error('bulkDeleteData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});