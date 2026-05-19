import { sendJson } from '../_utils.js';

// En Vercel el filesystem es read-only — no podemos persistir un .pfx subido
// por la UI. Devolvemos una respuesta clara explicando cómo configurar el
// certificado en producción (env var SII_CERT_BASE64).
export default async function handler(req, res) {
  return sendJson(res, 400, {
    ok: false,
    message:
      'En el deploy de Vercel no se puede subir el .pfx por la UI (filesystem read-only). ' +
      'Codifica tu .pfx en base64 y guárdalo como la variable de entorno SII_CERT_BASE64 en Vercel ' +
      '(Project Settings → Environment Variables). Luego haz un redeploy.',
  });
}
