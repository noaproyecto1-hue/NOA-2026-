import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { createRcvClient } from './server/simpleapi/rcv.js'
import { invokeLLM } from './server/integrations/llm.js'
import { sendEmail } from './server/integrations/email.js'
import { fudoTest, fudoListSales, fudoListProducts, fudoCreateOrder } from './server/integrations/fudo.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of Object.keys(env)) {
    if (key.startsWith('SIMPLEAPI_') || key.startsWith('SII_') || key.startsWith('FUDO_')) {
      if (process.env[key] === undefined) process.env[key] = env[key]
    }
  }

  return {
    logLevel: 'error',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [
      react(),
      siiRcvProxyPlugin(),
      integrationsProxyPlugin(),
    ],
  }
})

// Proxy SII RCV — POST/GET /__sii/rcv?type=ventas|compras&year=YYYY&month=MM
function siiRcvProxyPlugin() {
  return {
    name: 'sii-rcv-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__sii/rcv', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost')
          const type = url.searchParams.get('type')
          const year = Number(url.searchParams.get('year'))
          const month = Number(url.searchParams.get('month'))
          if (type !== 'ventas' && type !== 'compras') return sendJson(res, 400, { error: "type debe ser 'ventas' o 'compras'" })
          if (!Number.isInteger(year) || !Number.isInteger(month)) return sendJson(res, 400, { error: "year y month requeridos" })
          // Overrides opcionales (desde la UI) via POST body. GET sigue usando .env.
          const overrides = req.method === 'POST' ? await readJson(req) : {}
          const client = createRcvClient(siiOverridesToOpts(overrides))
          const data = type === 'ventas' ? await client.getVentas({ year, month }) : await client.getCompras({ year, month })
          return sendJson(res, 200, { type, year, month, data })
        } catch (err) {
          return sendJson(res, err.status || 500, { error: err.message, upstream: err.body ?? null })
        }
      })

      // Estado del SII — devuelve info pública del .env (sin password ni contenido del .pfx).
      server.middlewares.use('/__sii/status', async (req, res) => {
        try {
          const fs = await import('node:fs')
          const certPath = process.env.SII_CERT_PATH || './certs/sii-cert.pfx'
          let certExists = false, certSize = 0, certMtime = null
          try {
            const st = fs.statSync(certPath)
            certExists = true; certSize = st.size; certMtime = st.mtime.toISOString()
          } catch {}
          return sendJson(res, 200, {
            ambiente: Number(process.env.SII_AMBIENTE || 1),
            rutEmpresa: process.env.SII_RUT_EMPRESA || '',
            rutCertificado: process.env.SII_RUT_CERTIFICADO || '',
            apiKey: process.env.SIMPLEAPI_API_KEY ? maskKey(process.env.SIMPLEAPI_API_KEY) : '',
            passwordSet: Boolean(process.env.SII_PASSWORD),
            certPath,
            certExists,
            certSize,
            certMtime,
          })
        } catch (err) {
          return sendJson(res, 500, { error: err.message })
        }
      })

      // Test de conexión SII — consulta el mes actual para validar credenciales.
      // Acepta overrides opcionales via POST body para probar credenciales nuevas
      // antes de guardarlas como definitivas.
      server.middlewares.use('/__sii/test', async (req, res) => {
        try {
          const overrides = req.method === 'POST' ? await readJson(req) : {}
          const now = new Date()
          const client = createRcvClient(siiOverridesToOpts(overrides))
          await client.getCompras({ year: now.getFullYear(), month: now.getMonth() + 1 })
          return sendJson(res, 200, { ok: true, message: 'Conexión exitosa con SII vía SimpleAPI.' })
        } catch (err) {
          const detail = err.body ? (typeof err.body === 'string' ? err.body : JSON.stringify(err.body)) : ''
          return sendJson(res, 200, { ok: false, message: err.message + (detail ? ` — ${detail}` : '') })
        }
      })

      // Subida del certificado .pfx desde la UI (base64-encoded en JSON).
      // Sobrescribe certs/sii-cert.pfx para que toda llamada subsiguiente lo use.
      server.middlewares.use('/__sii/upload-cert', async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
        try {
          const fs = await import('node:fs')
          const path = await import('node:path')
          const body = await readJson(req)
          if (!body.base64) return sendJson(res, 400, { error: 'falta base64 del certificado' })
          const buf = Buffer.from(body.base64, 'base64')
          if (buf.length < 100) return sendJson(res, 400, { error: 'archivo demasiado pequeño, ¿es un .pfx válido?' })
          const target = process.env.SII_CERT_PATH || './certs/sii-cert.pfx'
          fs.mkdirSync(path.dirname(target), { recursive: true })
          fs.writeFileSync(target, buf)
          const st = fs.statSync(target)
          return sendJson(res, 200, { ok: true, path: target, size: st.size, message: `Certificado guardado en ${target}` })
        } catch (err) {
          return sendJson(res, 500, { error: err.message })
        }
      })
    },
  }
}

// Proxies para integraciones (IA / Email / Fudo).
function integrationsProxyPlugin() {
  return {
    name: 'integrations-proxy',
    apply: 'serve',
    configureServer(server) {
      // /__config — solo en dev local responde "no disponible" (KV es solo en deploy).
      // La UI ya degrada graciosamente cuando available=false.
      server.middlewares.use('/__config', async (req, res) => {
        if (req.method === 'GET') {
          return sendJson(res, 200, {
            ok: true,
            available: false,
            config: {},
            message: 'En modo dev local no hay sincronización compartida — solo localStorage.',
          })
        }
        return sendJson(res, 503, { ok: false, available: false, message: 'KV no disponible en dev local' })
      })

      server.middlewares.use('/__llm/invoke', async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
        try {
          const body = await readJson(req)
          const result = await invokeLLM(body)
          return sendJson(res, 200, result)
        } catch (err) {
          return sendJson(res, 500, { error: err.message })
        }
      })

      server.middlewares.use('/__email/send', async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
        try {
          const body = await readJson(req)
          const result = await sendEmail(body)
          return sendJson(res, 200, result)
        } catch (err) {
          return sendJson(res, 500, { error: err.message })
        }
      })

      server.middlewares.use('/__fudo', async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
        try {
          const action = (req.url || '').replace(/^\/+/, '').split('?')[0]
          const body = await readJson(req)
          let result
          if (action === 'test') result = await fudoTest(body)
          else if (action === 'sales') result = await fudoListSales(body)
          else if (action === 'products') result = await fudoListProducts(body)
          else if (action === 'create-order') result = await fudoCreateOrder(body)
          else return sendJson(res, 404, { error: `acción Fudo desconocida: ${action}` })
          return sendJson(res, 200, result)
        } catch (err) {
          return sendJson(res, 500, { error: err.message })
        }
      })
    },
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function maskKey(s) {
  if (!s || s.length < 8) return '••••'
  return `${s.slice(0, 4)}••••${s.slice(-4)}`
}

// Convierte el objeto que viene del browser (claves camelCase) en las opciones
// que espera createRcvClient. Solo incluye campos no-vacíos: cualquier campo
// omitido cae al default del .env.
function siiOverridesToOpts(o = {}) {
  const opts = {}
  if (o.rutEmpresa) opts.rutEmpresa = o.rutEmpresa
  if (o.rutCertificado) opts.rutCertificado = o.rutCertificado
  if (o.password) opts.password = o.password
  if (o.apiKey) opts.apiKey = o.apiKey
  if (o.ambiente) opts.ambiente = Number(o.ambiente)
  if (o.certPath) opts.certPath = o.certPath
  if (o.certBase64) opts.certBase64 = o.certBase64
  return opts
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      if (!data) return resolve({})
      try { resolve(JSON.parse(data)) } catch (e) { reject(new Error('JSON inválido en el body')) }
    })
    req.on('error', reject)
  })
}
