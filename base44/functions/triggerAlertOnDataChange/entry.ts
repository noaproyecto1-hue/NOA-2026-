import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Lightweight trigger: when DailyMetrics changes (which happens when Sales/SupplyCost/OpEx change),
// this function calls runScheduledAlertAnalysis for the affected restaurant only.
// This provides near-real-time alerts instead of waiting for the 3h cron.

// Debounce: skip if the last analysis for this restaurant was less than 5 min ago
const MIN_INTERVAL_MS = 5 * 60 * 1000;
const recentRuns = {};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const data = body.data;
    if (!data || !data.restaurant_id) {
      return Response.json({ skipped: true, reason: 'no restaurant_id in data' });
    }

    const restaurantId = data.restaurant_id;

    // Debounce: skip if recently analyzed
    const now = Date.now();
    if (recentRuns[restaurantId] && (now - recentRuns[restaurantId]) < MIN_INTERVAL_MS) {
      console.log('[triggerAlert] Skipping ' + restaurantId + ' — analyzed ' + Math.round((now - recentRuns[restaurantId]) / 1000) + 's ago');
      return Response.json({ skipped: true, reason: 'debounced' });
    }
    recentRuns[restaurantId] = now;

    console.log('[triggerAlert] Triggering alert analysis for restaurant ' + restaurantId);

    // Call the main alert analysis function for this specific restaurant
    const result = await base44.asServiceRole.functions.invoke('runScheduledAlertAnalysis', {
      restaurant_id: restaurantId
    });

    console.log('[triggerAlert] Done:', JSON.stringify(result.data || {}).slice(0, 200));

    return Response.json({
      success: true,
      restaurant_id: restaurantId,
      result: result.data
    });

  } catch (error) {
    console.error('[triggerAlertOnDataChange] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});