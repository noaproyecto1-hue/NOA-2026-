import { sendJson, maskKey } from '../_utils.js';

export default async function handler(req, res) {
  try {
    const certPath = process.env.SII_CERT_PATH || '';
    const certBase64 = process.env.SII_CERT_BASE64 || '';

    let certExists = false, certSize = 0, certMtime = null, certSource = null;

    if (certBase64) {
      certSource = 'base64-env';
      certExists = true;
      // Tamaño aproximado del binario decodificado
      certSize = Math.floor((certBase64.replace(/\s+/g, '').length * 3) / 4);
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

    return sendJson(res, 200, {
      ambiente: Number(process.env.SII_AMBIENTE || 1),
      rutEmpresa: process.env.SII_RUT_EMPRESA || '',
      rutCertificado: process.env.SII_RUT_CERTIFICADO || '',
      apiKey: process.env.SIMPLEAPI_API_KEY ? maskKey(process.env.SIMPLEAPI_API_KEY) : '',
      passwordSet: Boolean(process.env.SII_PASSWORD),
      certPath: certPath || (certBase64 ? '(desde env SII_CERT_BASE64)' : ''),
      certSource,
      certExists,
      certSize,
      certMtime,
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
