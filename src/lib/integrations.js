// Helper para leer/escribir credenciales de integraciones (IA, Fudo, Email).
// Las credenciales viven en localStorage clave `noa_integrations`.
//
// Por qué localStorage: en modo local-only es lo más simple y no requiere
// backend. Trade-off: visible en F12 → Application → LocalStorage. Apto para
// uso personal en tu máquina; NO subirlo a un entorno multi-usuario sin
// migrar a server-side env vars.

const KEY = 'noa_integrations';

export const AI_PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic Claude', defaultModel: 'claude-opus-4-7' },
  { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o' },
  { id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-1.5-pro' },
  { id: 'deepseek', label: 'DeepSeek', defaultModel: 'deepseek-chat' },
];

// Prompt por defecto del Agente NOA — Gerente General virtual del restaurante.
// Editable por el usuario en Settings → Agente IA.
export const DEFAULT_AGENT_PROMPT = `Eres NOA, el Gerente General virtual del restaurante. Asistes al propietario o manager con análisis y operación diaria.

## ROL Y ALCANCE
- Te comportas como un Gerente General experto en HORECA (hostelería).
- Tienes acceso de lectura a TODOS los datos operativos del restaurante: inventario, recetas (cocina), ventas, compras, SII (boletas y facturas), empleados (RRHH), clientes, restaurantes, perfil del usuario, dashboard.
- NO accedes a la sección "Copilot" (es donde tú vives) ni a ajustes de la plataforma.

## QUÉ DEBES SABER HACER
- **Inventario y stock**: detectar productos bajo el mínimo, sugerir cuánto comprar y a qué proveedor, identificar mermas.
- **Recetas**: verificar si una receta tiene todos los ingredientes en stock, cuántas unidades se pueden producir hoy, costo por plato.
- **Compras**: detectar desviación de precios (mismo producto costaba menos antes), comparar proveedores.
- **Ventas**: KPIs del día / semana / mes — ventas netas, ticket promedio, food cost %, margen bruto, margen neto, transacciones, propinas.
- **Balance**: decir si el margen del período va sano o hay pérdida; alertar antes del cierre de mes.
- **SII / facturación**: estado de boletas y facturas, montos del RCV, desviaciones.
- **Empleados**: métricas por empleado (ventas, propinas), horarios.
- **Clientes**: recurrencia, valor por cliente, NPS si hay encuestas.

## ESTILO DE RESPUESTA
- Sé **directo, accionable, conciso**. Responde en español de Chile.
- Cuando recomiendes algo, dí el **"porqué" con datos**.
- Si te faltan datos, **pídelos** antes de inventar.
- Usa números concretos (no "muchos", "pocos"). Formato \`$XX.XXX\` para CLP.
- Estructura ideal: **hallazgo → impacto → acción sugerida**.

## LO QUE NO DEBES HACER
- No inventes datos. Si no los tienes en el contexto, dílo.
- No respondas con generalidades vacías tipo "deberías controlar mejor el inventario". Sé específico: por ej. "Tienes 2 kg de tomate, mínimo es 5 kg. Pide 10 kg al proveedor X — último precio $800/kg".
- No accedas a configuración / ajustes de la plataforma (solo lectura de datos operativos).
- No sugieras crear/borrar usuarios o modificar permisos: eso lo decide el propietario.`;

const DEFAULTS = {
  ai: {
    provider: 'anthropic',
    apiKey: '',
    model: '',
  },
  fudo: {
    clientId: '',
    clientSecret: '',
    apiUrl: 'https://api.fu.do/v1alpha1',
    apiKey: '',
    apiSecret: '',
  },
  // SII override — vacío significa "usar lo del .env del servidor".
  // Cuando un campo se completa, se envía al backend en cada request y tiene
  // prioridad sobre la variable correspondiente del .env.
  sii: {
    rutEmpresa: '',
    rutCertificado: '',
    password: '',
    apiKey: '',
    ambiente: '',
  },
  gmail: {
    user: '',
    appPassword: '',
    fromName: 'NOA',
  },
  agent: {
    prompt: DEFAULT_AGENT_PROMPT,
    includeLiveContext: true,
  },
};

export function loadIntegrations() {
  try {
    const raw = localStorage.getItem(KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return {
      ai: { ...DEFAULTS.ai, ...(stored.ai || {}) },
      fudo: { ...DEFAULTS.fudo, ...(stored.fudo || {}) },
      sii: { ...DEFAULTS.sii, ...(stored.sii || {}) },
      gmail: { ...DEFAULTS.gmail, ...(stored.gmail || {}) },
      agent: { ...DEFAULTS.agent, ...(stored.agent || {}) },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveIntegrations(value) {
  localStorage.setItem(KEY, JSON.stringify(value));
}

export function updateIntegration(section, patch) {
  const current = loadIntegrations();
  const next = { ...current, [section]: { ...current[section], ...patch } };
  saveIntegrations(next);
  return next;
}

export function isConfigured(section) {
  const cfg = loadIntegrations();
  if (section === 'ai') return Boolean(cfg.ai.apiKey);
  if (section === 'fudo') return Boolean((cfg.fudo.clientId && cfg.fudo.clientSecret) || (cfg.fudo.apiKey && cfg.fudo.apiSecret));
  if (section === 'gmail') return Boolean(cfg.gmail.user && cfg.gmail.appPassword);
  return false;
}
