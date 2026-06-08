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
const ROLLING_DAYS = 60; // Mantiene en KV las ventas de los últimos 60 días

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
    const since = previous.lastSync ? new Date(previous.lastSync) : new Date(now.getTime() - 7 * 86400_000);
    const dateFrom = since.toISOString().slice(0, 10);
    const dateTo = now.toISOString().slice(0, 10);

    // 4) Pull desde Fudo (varias páginas si hace falta)
    const allNew = [];
    let page = 1;
    while (page <= 20) {
      const resp = await fudoListSales({ ...fudoCfg, dateFrom, dateTo, page, pageSize: 500 });
      const items = (resp?.data || []).map((s) => ({
        id: s.id,
        external_source: 'fudo',
        date_time: s.attributes?.createdAt || s.attributes?.date,
        total_amount: Number(s.attributes?.total) || 0,
        subtotal_amount: Number(s.attributes?.subtotal) || 0,
        tax_amount: Number(s.attributes?.tax) || 0,
        tip_amount: Number(s.attributes?.tip) || 0,
        discount_amount: Number(s.attributes?.discount) || 0,
        payment_method: s.attributes?.paymentMethod || 'Otros',
        is_cancelled: Boolean(s.attributes?.cancelled),
      }));
      if (items.length === 0) break;
      allNew.push(...items);
      if (items.length < 500) break;
      page += 1;
    }

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
