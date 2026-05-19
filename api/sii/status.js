import { sendJson, maskKey } from '../_utils.js';
import { kvGet, kvAvailable } from '../_kv.js';

export default async function handler(req, res) {
  try {
    // Config compartida (Vercel KV) — si está, sobrescribe el .env como
    // "valor efectivo" del servidor.
    const shared = (await kvGet('noa:shared-config')) || {};
    const siiShared = shared.sii || {};

    const certPath = siiShared.certPath || process.env.SII_CERT_PATH || '';
    const certBase64Shared = siiShared.certBase64 || '';
    const certBase64Env = process.env.SII_CERT_BASE64 || '';

    let certExists = false, certSize = 0, certMtime = null, certSource = null;

    if (certBase64Shared) {
      certSource = 'shared-kv';
      certExists = true;
      certSize = Math.floor((certBase64Shared.replace(/\s+/g, '').length * 3) / 4);
    } else if (certBase64Env) {
      certSource = 'base64-env';
      certExists = true;
      certSize = Math.floor((certBase64Env.replace(/\s+/g, '').length * 3) / 4);
    } else if (certPath) {
      certSource = 'filesystem';
      try {
        const fs = await import('node:fs');
        const st = fs.statSync(certPath);
        certExists = true;
        certSize = st.size;
        certMtime = st.mtime.toISOString();
      } catch {}
    }

    const effectiveApiKey = siiShared.apiKey || process.env.SIMPLEAPI_API_KEY || '';

    return sendJson(res, 200, {
      ambiente: Number(siiShared.ambiente || process.env.SII_AMBIENTE || 1),
      rutEmpresa: siiShared.rutEmpresa || process.env.SII_RUT_EMPRESA || '',
      rutCertificado: siiShared.rutCertificado || process.env.SII_RUT_CERTIFICADO || '',
      apiKey: effectiveApiKey ? maskKey(effectiveApiKey) : '',
      passwordSet: Boolean(siiShared.password || process.env.SII_PASSWORD),
      certPath: certPath || (certBase64Shared ? '(desde KV compartido)' : certBase64Env ? '(desde env SII_CERT_BASE64)' : ''),
      certSource,
      certExists,
      certSize,
      certMtime,
      kvAvailable: kvAvailable(),
      sharedConfigUsed: Object.keys(siiShared).length > 0,
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
