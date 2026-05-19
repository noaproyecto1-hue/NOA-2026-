import { sendJson, readJson, siiOverridesToOpts } from '../_utils.js';
import { createRcvClient } from '../../server/simpleapi/rcv.js';

export default async function handler(req, res) {
  try {
    const overrides = req.method === 'POST' ? await readJson(req) : {};
    const now = new Date();
    const client = createRcvClient(siiOverridesToOpts(overrides));
    await client.getCompras({ year: now.getFullYear(), month: now.getMonth() + 1 });
    return sendJson(res, 200, { ok: true, message: 'Conexión exitosa con SII vía SimpleAPI.' });
  } catch (err) {
    const detail = err.body ? (typeof err.body === 'string' ? err.body : JSON.stringify(err.body)) : '';
    return sendJson(res, 200, { ok: false, message: err.message + (detail ? ` — ${detail}` : '') });
  }
}
