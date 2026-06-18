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

// Lista ventas de Fudo. La API no soporta filtro por fecha en el query
// (solo sort por id/createdAt/closedAt), así que ordenamos por -createdAt y
// filtramos por rango en el servidor. Paginamos hasta cubrir el rango pedido.
export async function fudoListSales(opts = {}) {
  const entry = await getToken(opts);
  const dateFrom = opts.dateFrom ? new Date(opts.dateFrom + 'T00:00:00Z') : null;
  const dateTo = opts.dateTo ? new Date(opts.dateTo + 'T23:59:59Z') : null;

  // Si piden una sola página puntual (sin rango), devolvemos esa página tal cual.
  if (opts.page && !opts.dateFrom && !opts.dateTo) {
    const res = await fetch(`${API_BASE}/sales?sort=-createdAt&page[number]=${opts.page}&page[size]=${opts.pageSize || 500}`, {
      headers: { ...authHeader(entry), Accept: 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `Fudo sales ${res.status}`);
    return data;
  }

  // Modo rango: paginamos desde la más reciente hacia atrás hasta pasar dateFrom.
  const all = [];
  const maxPages = opts.maxPages || 40;
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`${API_BASE}/sales?sort=-createdAt&page[number]=${page}&page[size]=500`, {
      headers: { ...authHeader(entry), Accept: 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `Fudo sales ${res.status}`);
    const items = data.data || [];
    if (items.length === 0) break;

    let reachedOlder = false;
    for (const s of items) {
      const created = new Date(s.attributes?.createdAt || s.attributes?.closedAt || 0);
      if (dateTo && created > dateTo) continue;
      if (dateFrom && created < dateFrom) { reachedOlder = true; continue; }
      all.push(s);
    }
    if (reachedOlder) break;          // ya pasamos el inicio del rango
    if (items.length < 500) break;    // no hay más páginas
  }
  return { data: all };
}

// Stub mantenido por compatibilidad con la UI — la creación de órdenes vía
// Integrations API requiere otro flujo (Client ID/Secret + endpoint
// integrations.fu.do). No lo soportamos en esta versión.
export async function fudoCreateOrder() {
  throw new Error('La creación de órdenes vía Integrations API no está soportada en esta versión. Usa fudoListSales para consultar ventas existentes.');
}
