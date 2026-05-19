import { sendJson, readJson, siiOverridesToOpts } from '../_utils.js';
import { createRcvClient } from '../../server/simpleapi/rcv.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const type = url.searchParams.get('type');
    const year = Number(url.searchParams.get('year'));
    const month = Number(url.searchParams.get('month'));
    if (type !== 'ventas' && type !== 'compras') {
      return sendJson(res, 400, { error: "type debe ser 'ventas' o 'compras'" });
    }
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return sendJson(res, 400, { error: 'year y month requeridos' });
    }
    const overrides = req.method === 'POST' ? await readJson(req) : {};
    const client = createRcvClient(siiOverridesToOpts(overrides));
    const data = type === 'ventas'
      ? await client.getVentas({ year, month })
      : await client.getCompras({ year, month });
    return sendJson(res, 200, { type, year, month, data });
  } catch (err) {
    return sendJson(res, err.status || 500, { error: err.message, upstream: err.body ?? null });
  }
}
