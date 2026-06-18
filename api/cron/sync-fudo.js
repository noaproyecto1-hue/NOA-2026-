// Cron diario de sincronización con Fudo.
// Se dispara automáticamente por Vercel Cron (ver vercel.json → crons).
//
// Flujo:
//   1. Lee la última fecha de sincronización desde KV.
//   2. Llama a Fudo (api.fu.do/v1alpha1/sales) trayendo todas las ventas
//      desde esa fecha hasta hoy.
//   3. Mergea con las ventas ya guardadas (rolling window 60 días).
//   4. Guarda en KV bajo 'fudo:sync:state' para que cualquier navegador las
//      pueda traer luego con /api/fudo/sync-pull.
//
// Seguridad: Vercel agrega 'Authorization: Bearer <CRON_SECRET>' a las llamadas
// de cron. Validamos para que nadie externo dispare el sync.

import { sendJson } from '../_utils.js';
import { kvGet, kvSet, kvAvailable } from '../_kv.js';
import { fudoListSales } from '../../server/integrations/fudo.js';

const STATE_KEY = 'fudo:sync:state';
const ROLLING_DAYS = 90; // Mantiene en KV las ventas de los últimos 90 días

// Mapea una venta de Fudo (api.fu.do/v1alpha1/sales) al modelo de NOA.
// Campos reales de Fudo: total, saleType (EAT-IN/DELIVERY/TAKEAWAY),
// saleState (CLOSED/IN-COURSE/PAYMENT-PROCESS/CANCELED), expectedPayments,
// people, customerName, createdAt, closedAt.
function mapFudoSale(s) {
  const a = s.attributes || {};
  const total = Number(a.total) || 0;
  const neto = Math.round(total / 1.19);          // IVA Chile 19%
  const saleType = (a.saleType || '').toUpperCase();
  const isDelivery = saleType.includes('DELIVERY');
  // Método de pago desde expectedPayments si viene
  let paymentMethod = 'Otros';
  if (Array.isArray(a.expectedPayments) && a.expectedPayments.length) {
    paymentMethod = a.expectedPayments[0]?.paymentMethod || a.expectedPayments[0]?.name || 'Otros';
  }
  return {
    id: `fudo-${s.id}`,
    external_source: 'fudo',
    date_time: a.closedAt || a.createdAt,
    total_amount: total,
    subtotal_amount: neto,
    tax_amount: total - neto,
    tip_amount: 0,
    discount_amount: 0,
    payment_method: paymentMethod,
    is_delivery: isDelivery,
    origin: isDelivery ? 'Delivery' : (saleType === 'TAKEAWAY' ? 'Para llevar' : 'Mesa'),
    sale_type: a.saleType || '',
    sale_state: a.saleState || '',
    customer_name: a.customerName || '',
    people: a.people || 0,
    // Solo las CLOSED son ventas completadas (pagadas). El resto son tabs abiertas.
    is_cancelled: a.saleState === 'CANCELED' || a.saleState !== 'CLOSED',
  };
}

export default async function handler(req, res) {
  // Verificación de auth (cron secret) — opcional pero recomendado en producción.
  // Vercel inyecta CRON_SECRET automáticamente si está configurado.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return sendJson(res, 401, { ok: false, message: 'unauthorized' });
    }
  }

  if (!kvAvailable()) {
    return sendJson(res, 503, {
      ok: false,
      message: 'Vercel KV no configurado. No se puede persistir la sincronización.',
    });
  }

  try {
    // 1) Estado anterior
    const previous = (await kvGet(STATE_KEY)) || { sales: [], lastSync: null };

    // 2) Cargar config compartida (credenciales) desde KV
    const shared = (await kvGet('noa:shared-config')) || {};
    const fudoCfg = shared.fudo || {};

    // 3) Determinar rango: desde la última sincronización (o 7 días atrás) hasta hoy
    const now = new Date();
    // Primera sincronización: trae 90 días. Las siguientes: desde 1 día antes
    // de la última (margen para ventas que cerraron tarde).
    const since = previous.lastSync
      ? new Date(new Date(previous.lastSync).getTime() - 86400_000)
      : new Date(now.getTime() - 90 * 86400_000);
    const dateFrom = since.toISOString().slice(0, 10);
    const dateTo = now.toISOString().slice(0, 10);

    // 4) Pull desde Fudo (el cliente pagina y filtra por rango internamente)
    const resp = await fudoListSales({ ...fudoCfg, dateFrom, dateTo, maxPages: 40 });
    const allNew = (resp?.data || []).map((s) => mapFudoSale(s));

    // 5) Merge: dedupe por id, mantener rolling window
    const cutoff = new Date(now.getTime() - ROLLING_DAYS * 86400_000).toISOString();
    const byId = new Map();
    for (const s of previous.sales || []) {
      if (s.date_time && s.date_time >= cutoff) byId.set(s.id, s);
    }
    for (const s of allNew) byId.set(s.id, s); // los nuevos sobrescriben
    const merged = [...byId.values()].sort((a, b) => (b.date_time || '').localeCompare(a.date_time || ''));

    // 6) Persistir nuevo estado
    const state = {
      sales: merged,
      lastSync: now.toISOString(),
      lastRunSummary: {
        dateFrom,
        dateTo,
        broughtFromFudo: allNew.length,
        totalInKv: merged.length,
        runAt: now.toISOString(),
      },
    };
    await kvSet(STATE_KEY, state);

    return sendJson(res, 200, {
      ok: true,
      message: `Sincronizadas ${allNew.length} ventas desde Fudo (${dateFrom} → ${dateTo}). Total en KV: ${merged.length}.`,
      ...state.lastRunSummary,
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, message: err.message });
  }
}
