// Helpers compartidos por las serverless functions de Vercel.
// Cada archivo bajo `api/` exporta un handler `(req, res) => ...` que Vercel
// invoca cuando llega un request a la ruta correspondiente.

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function maskKey(s) {
  if (!s || s.length < 8) return '••••';
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

// Vercel parsea automáticamente JSON cuando Content-Type es application/json
// y lo entrega en req.body. Para máxima compatibilidad, este helper acepta
// tanto req.body parseado como cuerpo crudo en stream.
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON inválido en el body')); }
    });
    req.on('error', reject);
  });
}

// Convierte overrides camelCase (UI) en las opts que espera createRcvClient.
// Incluye certBase64 para que el .pfx pueda viajar como override desde el UI
// (necesario en Vercel donde no se puede escribir al filesystem).
export function siiOverridesToOpts(o = {}) {
  const opts = {};
  if (o.rutEmpresa) opts.rutEmpresa = o.rutEmpresa;
  if (o.rutCertificado) opts.rutCertificado = o.rutCertificado;
  if (o.password) opts.password = o.password;
  if (o.apiKey) opts.apiKey = o.apiKey;
  if (o.ambiente) opts.ambiente = Number(o.ambiente);
  if (o.certPath) opts.certPath = o.certPath;
  if (o.certBase64) opts.certBase64 = o.certBase64;
  return opts;
}
