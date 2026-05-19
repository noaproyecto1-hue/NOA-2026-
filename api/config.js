// Endpoint de configuración compartida.
//
// GET  /__config  → devuelve { available, config } leyendo de Vercel KV.
//                   config tiene la forma { sii: {...}, fudo: {...} } con todas
//                   las credenciales que la UI guardó por última vez.
//                   Si KV no está habilitado, available = false y config = {}.
//
// POST /__config  → guarda en KV el body recibido bajo la key 'noa:shared-config'.
//                   Se espera body = { sii: {...}, fudo: {...} }.
//
// SEGURIDAD: Este endpoint NO requiere autenticación de momento. Las
// credenciales SII/Fudo son sensibles — protege el sitio con Vercel
// Authentication (Settings → Deployment Protection) o pon un middleware
// de auth si el sitio será público.

import { sendJson, readJson } from './_utils.js';
import { kvGet, kvSet, kvAvailable } from './_kv.js';

const KEY = 'noa:shared-config';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!kvAvailable()) {
      return sendJson(res, 200, {
        ok: true,
        available: false,
        config: {},
        message: 'Vercel KV no configurado. Las credenciales solo se guardan en cada navegador (localStorage).',
      });
    }
    const config = (await kvGet(KEY)) || {};
    return sendJson(res, 200, { ok: true, available: true, config });
  }

  if (req.method === 'POST') {
    if (!kvAvailable()) {
      return sendJson(res, 503, {
        ok: false,
        available: false,
        message: 'Vercel KV no configurado. Habilita KV en Vercel Dashboard → Storage → KV (es free).',
      });
    }
    const body = await readJson(req);
    if (!body || typeof body !== 'object') {
      return sendJson(res, 400, { error: 'body requerido (JSON)' });
    }
    const saved = await kvSet(KEY, body);
    return sendJson(res, 200, {
      ok: saved,
      available: true,
      message: saved ? 'Configuración guardada en servidor (compartida con todos los usuarios).' : 'Error guardando.',
    });
  }

  return sendJson(res, 405, { error: 'method not allowed' });
}
