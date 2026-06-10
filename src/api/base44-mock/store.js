// Almacén CRUD respaldado por localStorage. Cada entidad vive en su propia
// key: `mock_<EntityName>`. Las operaciones son síncronas pero los métodos
// del SDK son async; los wrappers retornan promesas.

const PREFIX = 'mock_b44_';

function readAll(entity) {
  try {
    const raw = localStorage.getItem(PREFIX + entity);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(entity, items) {
  localStorage.setItem(PREFIX + entity, JSON.stringify(items));
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
    return localStorage.getItem(PREFIX + entity) !== null;
  },
};
