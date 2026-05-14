// Cliente para Fudo POS (Argentina). Flujo de autenticación verificado contra
// la integración real de Base44 (mayo 2026):
//
//   POST https://auth.fu.do/api
//   Headers: Content-Type: application/json, Accept: application/json
//   Body:    {"apiKey": "...", "apiSecret": "..."}
//   Resp:    {"token": "..."}
//
// Luego, requests a la API:
//   GET https://api.fu.do/v1alpha1/<recurso>
//   Header: Authorization: Bearer <token>
//
// IMPORTANTE: Fudo tiene dos sistemas distintos de credenciales que se ven
// parecidos pero NO son intercambiables:
//
//   1) "Aplicación Externa" (panel web → External Apps): genera Client ID
//      y Client Secret. Estas credenciales son SOLO para crear órdenes vía
//      Integrations API (https://integrations.fu.do/fudo/v1). NO funcionan
//      con auth.fu.do/api.
//
//   2) "API General": apiKey y apiSecret se solicitan por separado escribiendo
//      a soporte@fu.do. ESTAS son las que funcionan con auth.fu.do/api y dan
//      acceso a /sales, /products, /customers, etc.
//
// Si recibes 401 con apiKey/apiSecret aparentemente correctos, lo más probable
// es que estés usando Client ID/Secret de una External App, no las credenciales
// de la API General. Escribe a soporte@fu.do pidiendo apiKey/apiSecret.

const AUTH_URL = 'https://auth.fu.do/api';
const API_BASE = 'https://api.fu.do/v1alpha1';

const TOKEN_CACHE = new Map(); // apiKey|apiSecret → { token, expiresAt }

function resolveCreds(opts = {}) {
  // Aceptamos varios alias por compatibilidad con UIs antiguas/nuevas.
  // Prioridad: opts (UI) → env. Cualquier valor llega como apiKey/apiSecret.
  const apiKey = (opts.apiKey || opts.clientId || process.env.FUDO_API_KEY || process.env.FUDO_CLIENT_ID || '').trim();
  const apiSecret = (opts.apiSecret || opts.clientSecret || process.env.FUDO_API_SECRET || process.env.FUDO_CLIENT_SECRET || '').trim();
  return { apiKey, apiSecret };
}

async function authFudo(apiKey, apiSecret) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function getToken(opts = {}) {
  const { apiKey, apiSecret } = resolveCreds(opts);
  if (!apiKey || !apiSecret) {
    throw new Error('Faltan credenciales Fudo. Agrega API Key y API Secret en Settings → Integraciones → Fudo POS.');
  }

  const cacheKey = `${apiKey}|${apiSecret}`;
  const cached = TOKEN_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached;

  const r = await authFudo(apiKey, apiSecret);
  if (r.ok && r.body?.token) {
    const entry = { token: r.body.token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
    TOKEN_CACHE.set(cacheKey, entry);
    return entry;
  }

  const detail = typeof r.body === 'string'
    ? r.body
    : r.body?.errors?.[0]?.detail || r.body?.errors?.[0]?.code || JSON.stringify(r.body);

  if (r.status === 401) {
    throw new Error(
      `Fudo rechazó las credenciales (401 ${detail}). Asegúrate de estar usando las credenciales de la "API General" (apiKey/apiSecret), no las de "Aplicación Externa" (Client ID/Secret) — son sistemas distintos. Las apiKey/apiSecret de la API General se solicitan a soporte@fu.do.`
    );
  }
  throw new Error(`Fudo auth ${r.status}: ${detail}`);
}

function authHeader(entry) {
  return { Authorization: `Bearer ${entry.token}` };
}

export async function fudoTest(opts = {}) {
  const entry = await getToken(opts);
  return { ok: true, message: `Conexión exitosa con Fudo. Token válido por 23 horas.` };
}

export async function fudoListProducts(opts = {}) {
  const entry = await getToken(opts);
  const res = await fetch(`${API_BASE}/products?page[size]=200`, {
    headers: { ...authHeader(entry), Accept: 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `Fudo products ${res.status}`);
  return data;
}

export async function fudoListSales(opts = {}) {
  const entry = await getToken(opts);
  const params = new URLSearchParams();
  if (opts.dateFrom) params.set('filter[date_from]', opts.dateFrom);
  if (opts.dateTo) params.set('filter[date_to]', opts.dateTo);
  params.set('page[number]', String(opts.page || 1));
  params.set('page[size]', String(opts.pageSize || 500));
  const res = await fetch(`${API_BASE}/sales?${params}`, {
    headers: { ...authHeader(entry), Accept: 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `Fudo sales ${res.status}`);
  return data;
}

// Stub mantenido por compatibilidad con la UI — la creación de órdenes vía
// Integrations API requiere otro flujo (Client ID/Secret + endpoint
// integrations.fu.do). No lo soportamos en esta versión.
export async function fudoCreateOrder() {
  throw new Error('La creación de órdenes vía Integrations API no está soportada en esta versión. Usa fudoListSales para consultar ventas existentes.');
}
