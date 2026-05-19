// Wrapper de Vercel KV con degradación graceful:
//   - Si las env vars KV_REST_API_URL y KV_REST_API_TOKEN están definidas,
//     usa Vercel KV (Redis serverless) para guardar config compartida.
//   - Si no están definidas, kvAvailable() devuelve false y los endpoints
//     responden con un mensaje claro indicando cómo habilitarlo.
//
// Setup en Vercel (1 vez, ~2 min):
//   1) Vercel Dashboard → Storage → Create Database → KV (Hobby tier: free)
//   2) Connect to project NOA-2026
//   3) Vercel inyecta automáticamente KV_REST_API_URL y KV_REST_API_TOKEN
//      como env vars del proyecto. No hay que copiar nada a mano.
//   4) Redeploy.

let kvClient = null;
let attempted = false;

export function kvAvailable() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getKv() {
  if (kvClient) return kvClient;
  if (attempted) return null;
  attempted = true;
  if (!kvAvailable()) return null;
  try {
    const mod = await import('@vercel/kv');
    kvClient = mod.kv;
    return kvClient;
  } catch (err) {
    console.error('[_kv] error cargando @vercel/kv:', err.message);
    return null;
  }
}

export async function kvGet(key) {
  const k = await getKv();
  if (!k) return null;
  try {
    return await k.get(key);
  } catch (err) {
    console.error(`[_kv] get(${key}) error:`, err.message);
    return null;
  }
}

export async function kvSet(key, value) {
  const k = await getKv();
  if (!k) return false;
  try {
    await k.set(key, value);
    return true;
  } catch (err) {
    console.error(`[_kv] set(${key}) error:`, err.message);
    return false;
  }
}

export async function kvDel(key) {
  const k = await getKv();
  if (!k) return false;
  try {
    await k.del(key);
    return true;
  } catch (err) {
    console.error(`[_kv] del(${key}) error:`, err.message);
    return false;
  }
}
