import { sendJson, readJson } from '../_utils.js';
import { fudoListSales } from '../../server/integrations/fudo.js';
import { kvGet } from '../_kv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
  try {
    let body = await readJson(req);
    if (!body?.apiKey && !body?.apiSecret) {
      const shared = await kvGet('noa:shared-config');
      if (shared?.fudo) body = { ...shared.fudo, ...(body || {}) };
    }
    const result = await fudoListSales(body);
    return sendJson(res, 200, result);
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
