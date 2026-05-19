import { sendJson, readJson } from '../_utils.js';
import { fudoListSales } from '../../server/integrations/fudo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
  try {
    const body = await readJson(req);
    const result = await fudoListSales(body);
    return sendJson(res, 200, result);
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
