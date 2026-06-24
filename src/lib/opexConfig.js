// Configuración de Gastos Fijos mensuales (Prompt 9B del informe).
// Alimenta el cálculo del KPI OPEX del Dashboard.
//
// Persistencia en localStorage. Guarda historial de cambios (valor anterior,
// valor nuevo, fecha y usuario). Editable solo por rol Administrador (la UI
// decide si muestra el editor; aquí solo se persiste).

const KEY = 'noa_opex_fijos';

const DEFAULTS = {
  arriendo: 0,          // valor mensual fijo del arriendo
  recursoHumano: 0,     // total mensual de remuneraciones brutas
  administracion: 0,    // costos fijos administrativos mensuales
  lastModified: null,   // ISO date de última modificación
  history: [],          // [{ date, user, prev:{...}, next:{...} }]
};

export function loadOpexFijos() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...c };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveOpexFijos(values, user = 'Administrador') {
  const prev = loadOpexFijos();
  const next = {
    arriendo: Number(values.arriendo) || 0,
    recursoHumano: Number(values.recursoHumano) || 0,
    administracion: Number(values.administracion) || 0,
  };
  const entry = {
    date: new Date().toISOString(),
    user,
    prev: { arriendo: prev.arriendo, recursoHumano: prev.recursoHumano, administracion: prev.administracion },
    next,
  };
  const merged = {
    ...next,
    lastModified: new Date().toISOString(),
    history: [entry, ...(prev.history || [])].slice(0, 50),
  };
  localStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

export function totalFijos(c) {
  return (Number(c.arriendo) || 0) + (Number(c.recursoHumano) || 0) + (Number(c.administracion) || 0);
}
