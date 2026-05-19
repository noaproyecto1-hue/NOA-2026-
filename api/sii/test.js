import { sendJson, readJson, siiOverridesToOpts } from '../_utils.js';
import { createRcvClient } from '../../server/simpleapi/rcv.js';
import { kvGet } from '../_kv.js';

export default async function handler(req, res) {
  try {
    let overrides = req.method === 'POST' ? await readJson(req) : {};
    // Si el navegador no mandó overrides, leer config compartida del KV.
    if (Object.keys(overrides).length === 0) {
      const shared = await kvGet('noa:shared-config');
      if (shared?.sii) overrides = shared.sii;
    }
    const now = new Date();
    const client = createRcvClient(siiOverridesToOpts(overrides));
    await client.getCompras({ year: now.getFullYear(), month: now.getMonth() + 1 });
    return sendJson(res, 200, { ok: true, message: 'Conexión exitosa con SII vía SimpleAPI.' });
  } catch (err) {
    const detail = err.body ? (typeof err.body === 'string' ? err.body : JSON.stringify(err.body)) : '';
    return sendJson(res, 200, { ok: false, message: err.message + (detail ? ` — ${detail}` : '') });
  }
}
