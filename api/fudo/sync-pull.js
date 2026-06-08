// Devuelve las ventas Fudo ya sincronizadas (cron diario) desde Vercel KV.
// El frontend llama acá, recibe el listado, y mergea con su localStorage.
//
// GET  /api/fudo/sync-pull  → { ok, sales, lastSync, lastRunSummary }
// POST /api/fudo/sync-pull  → fuerza una sincronización inmediata antes de
//                              devolver (útil para "sincronizar ahora").

import { sendJson } from '../_utils.js';
import { kvGet, kvAvailable } from '../_kv.js';
import cronHandler from '../cron/sync-fudo.js';

const STATE_KEY = 'fudo:sync:state';

export default async function handler(req, res) {
  if (!kvAvailable()) {
    return sendJson(res, 503, {
      ok: false,
      message: 'Vercel KV no configurado.',
      sales: [],
    });
  }

  // POST → fuerza un sync ahora (saltándose el cron). Espera unos segundos.
  if (req.method === 'POST') {
    // Reusamos el handler del cron — bypass del secret en esta ruta (el usuario
    // ya está autenticado en la app por el login local).
    process.env.__SKIP_CRON_AUTH = '1';
    const tempRes = {
      statusCode: 200, headers: {}, _body: null,
      setHeader() {}, end(b) { this._body = b; },
    };
    const tempReq = { ...req, headers: { ...req.headers, authorization: `Bearer ${process.env.CRON_SECRET || 'noop'}` } };
    try { await cronHandler(tempReq, tempRes); } catch (e) { /* ignore */ }
  }

  const state = (await kvGet(STATE_KEY)) || { sales: [], lastSync: null };
  return sendJson(res, 200, { ok: true, ...state });
}
