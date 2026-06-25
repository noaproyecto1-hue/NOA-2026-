// Almacén CRUD respaldado por localStorage. Cada entidad vive en su propia
// key: `mock_<EntityName>`. Las operaciones son síncronas pero los métodos
// del SDK son async; los wrappers retornan promesas.

const PREFIX = 'mock_b44_';

// Fallback en memoria: las entidades grandes (p. ej. Sale con miles de tickets
// reales) pueden exceder la cuota de localStorage (~5MB). Cuando setItem falla,
// los datos viven en memoria y se vuelven a sembrar desde el JSON en cada carga.
const MEM = {};
// Caché en memoria del JSON ya parseado. Sin esto, cada lectura volvía a parsear
// hasta ~3MB de ventas desde localStorage → la UI se congelaba al navegar.
const CACHE = {};

function readAll(entity) {
  if (MEM[entity]) return MEM[entity];
  if (CACHE[entity]) return CACHE[entity];
  try {
    const raw = localStorage.getItem(PREFIX + entity);
    const data = raw ? JSON.parse(raw) : [];
    CACHE[entity] = data;
    return data;
  } catch {
    return [];
  }
}

function writeAll(entity, items) {
  try {
    localStorage.setItem(PREFIX + entity, JSON.stringify(items));
    CACHE[entity] = items;      // mantener la caché al día
    delete MEM[entity];
  } catch (e) {
    // Cuota excedida → mantener en memoria y limpiar la clave persistida.
    MEM[entity] = items;
    delete CACHE[entity];
    try { localStorage.removeItem(PREFIX + entity); } catch {}
  }
}

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function matches(item, query) {
  if (!query || typeof query !== 'object') return true;
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) {
      if (!v.includes(item[k])) return false;
    } else if (item[k] !== v) {
      return false;
    }
  }
  return true;
}

export const store = {
  list(entity) {
    return Promise.resolve([...readAll(entity)]);
  },
  filter(entity, query) {
    return Promise.resolve(readAll(entity).filter((it) => matches(it, query)));
  },
  get(entity, id) {
    return Promise.resolve(readAll(entity).find((it) => it.id === id) || null);
  },
  create(entity, data) {
    const items = readAll(entity);
    const now = new Date().toISOString();
    const item = { id: genId(), created_date: now, updated_date: now, ...data };
    items.push(item);
    writeAll(entity, items);
    return Promise.resolve(item);
  },
  bulkCreate(entity, dataArray, options = {}) {
    const items = options.replace ? [] : readAll(entity);
    const now = new Date().toISOString();
    const created = dataArray.map((d) => ({
      id: genId(),
      created_date: now,
      updated_date: now,
      ...d,
    }));
    writeAll(entity, items.concat(created));
    return Promise.resolve(created);
  },
  update(entity, id, data) {
    const items = readAll(entity);
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return Promise.reject(new Error(`${entity} ${id} no encontrado`));
    items[idx] = { ...items[idx], ...data, id, updated_date: new Date().toISOString() };
    writeAll(entity, items);
    return Promise.resolve(items[idx]);
  },
  delete(entity, id) {
    const items = readAll(entity);
    const next = items.filter((it) => it.id !== id);
    writeAll(entity, next);
    return Promise.resolve({ success: true });
  },
  reset(entity) {
    if (entity) localStorage.removeItem(PREFIX + entity);
    else {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(PREFIX)) localStorage.removeItem(key);
      }
    }
  },
  has(entity) {
    return (entity in MEM) || localStorage.getItem(PREFIX + entity) !== null;
  },
};
