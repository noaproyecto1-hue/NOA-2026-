// Cliente para SimpleAPI RCV (Registro de Compras y Ventas del SII de Chile).
//
// Server-side ÚNICAMENTE. La API key, la clave SII y el certificado digital
// no deben llegar al bundle del frontend; este archivo vive fuera de `src/`
// por esa razón.
//
// Spec verificada contra la colección Postman oficial de SimpleAPI:
//   POST https://servicios.simpleapi.cl/api/RCV/ventas/{MM}/{YYYY}
//   POST https://servicios.simpleapi.cl/api/RCV/compras/{MM}/{YYYY}
//
// Body: multipart/form-data con dos campos:
//   - input (text): JSON con { RutCertificado, RutEmpresa, Ambiente, Password }
//   - files (file): certificado digital .pfx del titular
//
// Header de autenticación: Authorization: <apiKey>

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const DEFAULT_BASE_URL = 'https://servicios.simpleapi.cl';

function readEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta variable de entorno requerida: ${name}. ` +
        `Copia .env.example a .env y completa los valores.`
    );
  }
  return value;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function validatePeriod(year, month) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new RangeError(`year inválido: ${year}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`month inválido (1-12): ${month}`);
  }
}

export function createRcvClient(options = {}) {
  const baseUrl = (options.baseUrl ?? readEnv('SIMPLEAPI_BASE_URL', DEFAULT_BASE_URL)).replace(/\/$/, '');
  const apiKey = options.apiKey ?? requireEnv('SIMPLEAPI_API_KEY');
  const rutEmpresa = options.rutEmpresa ?? requireEnv('SII_RUT_EMPRESA');
  const password = options.password ?? requireEnv('SII_PASSWORD');
  const rutCertificado = options.rutCertificado ?? requireEnv('SII_RUT_CERTIFICADO');
  // El .pfx puede venir por uno de estos canales (en orden de prioridad):
  //   1) options.certBase64  — desde el frontend (UI override), base64 string
  //   2) process.env.SII_CERT_BASE64 — en Vercel/serverless (filesystem read-only)
  //   3) options.certPath / SII_CERT_PATH — en local, lee del filesystem
  const certBase64 = options.certBase64 ?? process.env.SII_CERT_BASE64 ?? null;
  const certPath = options.certPath ?? readEnv('SII_CERT_PATH', '');
  if (!certBase64 && !certPath) {
    throw new Error('Falta certificado: define SII_CERT_BASE64 (recomendado en Vercel) o SII_CERT_PATH (local).');
  }
  const ambiente = Number(options.ambiente ?? readEnv('SII_AMBIENTE', '1'));

  async function loadCertBuffer() {
    if (certBase64) {
      // base64 puede venir con prefijo data:... — limpiarlo si lo trae.
      const clean = String(certBase64).replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
      return Buffer.from(clean, 'base64');
    }
    return await readFile(certPath);
  }

  async function request(kind, year, month) {
    validatePeriod(year, month);
    const url = `${baseUrl}/api/RCV/${kind}/${pad2(month)}/${year}`;

    const certBuffer = await loadCertBuffer();
    const certBlob = new Blob([certBuffer], { type: 'application/x-pkcs12' });

    const input = JSON.stringify({
      RutCertificado: rutCertificado,
      RutEmpresa: rutEmpresa,
      Ambiente: ambiente,
      Password: password,
    });

    const form = new FormData();
    form.append('input', input);
    form.append('files', certBlob, certPath ? basename(certPath) : 'sii-cert.pfx');

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: apiKey },
      body: form,
    });

    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      const err = new Error(
        `SimpleAPI ${response.status} ${response.statusText} en POST ${url}`
      );
      err.status = response.status;
      err.body = payload;
      throw err;
    }

    return payload;
  }

  return {
    getVentas({ year, month }) {
      return request('ventas', year, month);
    },
    getCompras({ year, month }) {
      return request('compras', year, month);
    },
    _internals: { baseUrl, rutEmpresa, rutCertificado, certPath, ambiente },
  };
}
