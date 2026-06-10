// Mock local del SDK de Base44. Permite navegar la app sin backend.
// Reemplaza el `base44` exportado por @base44/sdk.
//
// Convenciones:
//   - Datos persisten en localStorage (clave `mock_b44_<Entity>`).
//   - Usuario fijo: demo@local con rol admin/manager.
//   - Cloud functions, agents, integrations: stubs que loguean en consola.
//   - Para limpiar: window.__b44Mock.reset()

import { store } from './store.js';
import { seedIfEmpty, DEMO_USER } from './seeds.js';
import { invokeFunction } from './functions-local.js';
import { loadIntegrations } from '@/lib/integrations';
import { getSession, setSession, clearSession } from './session.js';
import { loadDemoData, clearDemoData } from './demo-data.js';

if (typeof window !== 'undefined') {
  seedIfEmpty();
  // Carga datos de demostración (ficticios) la primera vez. No toca SII ni Fudo.
  loadDemoData().catch((e) => console.warn('[demo] error:', e));
  window.__b44Mock = {
    store,
    reset: () => store.reset(),
    seed: seedIfEmpty,
    loadDemo: (opts) => loadDemoData({ force: true, ...opts }),
    clearDemo: clearDemoData,
  };
}

const ENTITY_NAMES = [
  'Alert', 'Conversation', 'Customer', 'DailyCountConfig', 'DailyMetrics',
  'DeviationConfig', 'EmployeeMetrics', 'InventoryCount', 'InvitationCode',
  'OpEx', 'Recipe', 'RecipeSample', 'RegistroMerma', 'Restaurant', 'Sale',
  'StockMovement', 'Supplier', 'SupplyCost', 'SupplyItem', 'SyncLog', 'User',
];

function makeEntity(name) {
  return {
    list: () => store.list(name),
    filter: (query) => store.filter(name, query),
    get: (id) => store.get(name, id),
    create: (data) => store.create(name, data),
    bulkCreate: (arr) => store.bulkCreate(name, arr),
    update: (id, data) => store.update(name, id, data),
    delete: (id) => store.delete(name, id),
  };
}

const entities = Object.fromEntries(
  ENTITY_NAMES.map((n) => [n, makeEntity(n)])
);

// Auth: sesión real basada en localStorage. Login con email/password contra
// la entidad User. La password se guarda en el campo `password` del User
// (texto plano — apto para uso local, NO para producción).
const auth = {
  async me() {
    const session = getSession();
    if (!session?.userId) {
      const err = new Error('No hay sesión activa');
      err.status = 401;
      throw err;
    }
    const user = await store.get('User', session.userId);
    if (!user) {
      clearSession();
      const err = new Error('Usuario de la sesión no encontrado');
      err.status = 401;
      throw err;
    }
    return user;
  },
  async updateMe(data) {
    const session = getSession();
    if (!session?.userId) throw new Error('No hay sesión activa');
    return store.update('User', session.userId, data);
  },
  async loginViaEmailPassword({ email, password } = {}) {
    if (!email || !password) throw new Error('Email y contraseña requeridos');
    const users = await store.list('User');
    const user = users.find((u) => {
      const matchEmail = (u.email || '').toLowerCase() === String(email).toLowerCase();
      const matchUsername = (u.username || '').toLowerCase() === String(email).toLowerCase();
      return (matchEmail || matchUsername) && (u.password === password);
    });
    if (!user) {
      const err = new Error('Credenciales incorrectas');
      err.status = 401;
      throw err;
    }
    if (user.is_approved === false) {
      const err = new Error('Tu cuenta aún no fue aprobada por el administrador');
      err.status = 403;
      throw err;
    }
    setSession(user.id);
    return { access_token: user.id, user };
  },
  logout(redirectUrl) {
    clearSession();
    if (typeof window !== 'undefined') {
      window.location.href = redirectUrl || '/';
    }
  },
  redirectToLogin(nextUrl) {
    if (typeof window !== 'undefined') {
      window.location.href = nextUrl || '/';
    }
  },
};

// Functions: dispatch a las implementaciones locales en functions-local.js.
const functions = {
  invoke(name, args) {
    return invokeFunction(name, args);
  },
};

// Helper: llama al proxy LLM con las creds de Settings.
async function callLLM({ system, messages, max_tokens } = {}) {
  const cfg = loadIntegrations().ai;
  if (!cfg.apiKey) {
    return {
      text: '⚠️ Sin API key de IA configurada. Ve a Configuración → Integraciones para agregar tu key (Anthropic, OpenAI, Gemini o DeepSeek).',
      _notConfigured: true,
    };
  }
  const res = await fetch('/__llm/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      model: cfg.model,
      system,
      messages,
      max_tokens,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `LLM ${res.status}`);
  return data;
}

// integrations.Core — APIs auxiliares (LLM, file upload, email, OCR).
const integrations = {
  Core: {
    async InvokeLLM(args = {}) {
      // Acepta { prompt }, { messages }, o { system, messages }
      const messages = args.messages || (args.prompt ? [{ role: 'user', content: args.prompt }] : []);
      const result = await callLLM({
        system: args.system,
        messages,
        max_tokens: args.max_tokens,
      });
      return { text: result.text, usage: result.usage };
    },
    async UploadFile({ file }) {
      if (!file) return { file_url: '' };
      const blobUrl = URL.createObjectURL(file);
      console.warn('[b44-mock] UploadFile — devolviendo blob URL local', file.name);
      return { file_url: blobUrl, file_name: file.name };
    },
    async SendEmail({ to, subject, html, text } = {}) {
      const cfg = loadIntegrations().gmail;
      if (!cfg.user || !cfg.appPassword) {
        return { ok: false, message: 'Gmail no configurado (Settings → Integraciones)' };
      }
      const res = await fetch('/__email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, to, subject, html, text }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.error };
      return data;
    },
    async ExtractDataFromUploadedFile(args) {
      console.warn('[b44-mock] ExtractDataFromUploadedFile — no implementado en local', args);
      return { ok: false, message: 'Extracción de datos de archivos no disponible en modo local', data: [], rows: [] };
    },
  },
};

// Agents (NOA Copilot) — conversaciones persistidas en localStorage + pub/sub
// para que la UI vea actualizaciones via subscribeToConversation.
//
// Persistencia: usamos la entidad mock `Conversation` para que sobrevivan
// recargas. Las suscripciones son en memoria (se pierden al recargar pero la
// UI las re-arma).

const conversationSubs = new Map(); // conversationId → Set<callback>

// Arma un snapshot del estado actual del restaurante para inyectar como
// contexto del agente. Solo se llama si el usuario lo tiene activado en
// Settings → Agente IA → "Contexto en vivo".
async function buildLiveContext() {
  try {
    // Restaurante del usuario actual
    const session = getSession();
    let user = null;
    if (session?.userId) user = await store.get('User', session.userId);
    const rid = user?.restaurant_ids?.[0];
    if (!rid) return '';

    const restaurant = await store.get('Restaurant', rid);
    const [supplies, recipes, sales, suppliers, alerts, supplyCosts, opex] = await Promise.all([
      store.filter('SupplyItem', { restaurant_id: rid }),
      store.filter('Recipe', { restaurant_id: rid }),
      store.filter('Sale', { restaurant_id: rid }),
      store.filter('Supplier', { restaurant_id: rid }),
      store.filter('Alert', { restaurant_id: rid, is_resolved: false }),
      store.filter('SupplyCost', { restaurant_id: rid }),
      store.filter('OpEx', { restaurant_id: rid }),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const todaySales = sales.filter((s) => (s.date_time || '').slice(0, 10) === today && !s.is_cancelled);
    const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const lowStock = supplies.filter((s) => (s.stock || 0) < (s.min_stock || 0));

    // Detecta posibles desviaciones de precio (mismo supply, precios distintos)
    const pricesBySupply = {};
    for (const cost of supplyCosts) {
      const key = cost.supply_item_id || cost.supply_name;
      if (!key) continue;
      const price = cost.unit_price ?? (cost.quantity ? (cost.total_cost || 0) / cost.quantity : null);
      if (price == null) continue;
      if (!pricesBySupply[key]) pricesBySupply[key] = [];
      pricesBySupply[key].push({ date: cost.date, price });
    }
    const deviations = [];
    for (const [key, entries] of Object.entries(pricesBySupply)) {
      if (entries.length < 2) continue;
      entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const first = entries[0].price;
      const last = entries[entries.length - 1].price;
      if (first > 0 && Math.abs(last - first) / first > 0.05) {
        const supply = supplies.find((s) => s.id === key);
        deviations.push({
          name: supply?.name || key,
          desde: first,
          hasta: last,
          variacion_pct: Math.round(((last - first) / first) * 1000) / 10,
        });
      }
    }

    const context = {
      restaurante: restaurant ? {
        nombre: restaurant.name,
        moneda: restaurant.currency,
        timezone: restaurant.timezone,
      } : null,
      usuario_actual: user ? { nombre: user.full_name, rol: user.app_role } : null,
      hoy: {
        fecha: today,
        ventas_count: todaySales.length,
        ingreso_total: todayRevenue,
      },
      conteos: {
        insumos: supplies.length,
        recetas: recipes.length,
        proveedores: suppliers.length,
        alertas_activas: alerts.length,
        items_bajo_minimo: lowStock.length,
      },
      stock_bajo: lowStock.slice(0, 15).map((s) => ({
        nombre: s.name,
        stock: s.stock,
        min: s.min_stock,
        unidad: s.unit,
        costo_unit: s.cost_per_unit,
      })),
      alertas_activas: alerts.slice(0, 10).map((a) => ({
        titulo: a.title,
        severidad: a.severity,
        creada: a.created_at,
      })),
      desviaciones_precio_compra: deviations.slice(0, 10),
      ultimos_gastos_opex: opex.slice(-5).map((o) => ({
        tipo: o.type,
        monto: o.amount,
        fecha: o.date,
        estado_pago: o.payment_status,
      })),
    };

    return `\n\n## CONTEXTO EN VIVO DEL RESTAURANTE (${today})\nDatos actuales del sistema. Úsalos para responder con precisión.\n\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``;
  } catch (err) {
    console.warn('[b44-mock] buildLiveContext error:', err);
    return '';
  }
}

function notifyConversation(convId, conv) {
  const subs = conversationSubs.get(convId);
  if (!subs) return;
  for (const cb of subs) {
    try { cb(conv); } catch (e) { console.error('[b44-mock] sub callback error:', e); }
  }
}

const agents = {
  async createConversation({ agent_id, agent_name, metadata } = {}) {
    const conv = await store.create('Conversation', {
      agent_name: agent_name || agent_id || 'restaurant_copilot',
      metadata: metadata || {},
      messages: [],
    });
    return conv;
  },
  async getConversation(idOrConv) {
    const id = typeof idOrConv === 'string' ? idOrConv : idOrConv?.id;
    if (!id) return null;
    const conv = await store.get('Conversation', id);
    if (!conv) return { id, messages: [] };
    return { ...conv, messages: conv.messages || [] };
  },
  async listConversations({ agent_name } = {}) {
    const all = await store.list('Conversation');
    return agent_name ? all.filter((c) => c.agent_name === agent_name) : all;
  },
  async addMessage(idOrConv, message) {
    const id = typeof idOrConv === 'string' ? idOrConv : idOrConv?.id;
    if (!id) throw new Error('addMessage: conversation id requerido');

    let conv = await store.get('Conversation', id);
    if (!conv) {
      conv = await store.create('Conversation', { id, messages: [] });
    }
    conv.messages = conv.messages || [];

    const userContent = message?.content ?? message;
    const userMsg = {
      id: 'm_' + Date.now(),
      role: 'user',
      content: userContent,
      created_at: new Date().toISOString(),
    };
    conv.messages.push(userMsg);
    conv = await store.update('Conversation', id, { messages: conv.messages });
    notifyConversation(id, conv);  // muestra el mensaje del usuario inmediatamente

    // Llama al LLM. Combina:
    //   1) Prompt configurado en Settings → Agente IA (o el default si nunca lo tocaron).
    //   2) Snapshot de datos actuales del restaurante (si "contexto en vivo" está ON).
    let botContent;
    try {
      const agentCfg = loadIntegrations().agent;
      let systemPrompt = agentCfg.prompt;
      if (agentCfg.includeLiveContext) {
        const ctx = await buildLiveContext();
        if (ctx) systemPrompt += ctx;
      }
      const llm = await callLLM({
        system: systemPrompt,
        messages: conv.messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || ''),
        })),
        max_tokens: 1500,
      });
      botContent = llm.text;
    } catch (err) {
      botContent = `⚠️ Error llamando al LLM: ${err.message}`;
    }

    const botMsg = {
      id: 'm_' + (Date.now() + 1),
      role: 'assistant',
      content: botContent,
      created_at: new Date().toISOString(),
    };
    conv.messages.push(botMsg);
    conv = await store.update('Conversation', id, { messages: conv.messages });
    notifyConversation(id, conv);
    return botMsg;
  },
  subscribeToConversation(convId, callback) {
    if (!convId) return () => {};
    if (!conversationSubs.has(convId)) conversationSubs.set(convId, new Set());
    conversationSubs.get(convId).add(callback);

    // Disparo inicial con el estado actual.
    store.get('Conversation', convId).then((conv) => {
      if (conv) callback({ ...conv, messages: conv.messages || [] });
    }).catch(() => {});

    return () => {
      const subs = conversationSubs.get(convId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) conversationSubs.delete(convId);
      }
    };
  },
};

const appLogs = {
  async logUserInApp(event) {
    console.debug('[b44-mock] logUserInApp', event);
    return { ok: true };
  },
};

export const base44 = {
  entities,
  auth,
  functions,
  integrations,
  agents,
  appLogs,
};
