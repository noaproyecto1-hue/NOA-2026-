// Centros de costo del sistema — SIEMPRE deben existir, no se pueden eliminar ni renombrar.
// El sistema de alertas, EBITDA, estado de resultados, etc. dependen de estos nombres exactos.

export const SYSTEM_COST_CENTERS = [
  { 
    name: 'FOOD COST', 
    type: 'supply', 
    opex_type: null, 
    description: 'Costo directo de alimentos y bebidas (insumos de producción)', 
    categories: [],
    isSystem: true 
  },
  { 
    name: 'PAYROLL/RRHH', 
    type: 'opex', 
    opex_type: 'payroll', 
    description: 'Sueldos, liquidaciones, bonos y cargas sociales del equipo', 
    categories: ['Gerencia', 'Administradores', 'Cocineros', 'Cajeros', 'Garzones', 'Ayudantes', 'Imposiciones y Seguros', 'Uniforme Personal', 'Provisión de Finiquitos', 'Otros Gastos RRHH'],
    isSystem: true 
  },
];

// Nombres normalizados para comparación rápida
export const SYSTEM_CENTER_NAMES = SYSTEM_COST_CENTERS.map(c => c.name);

// Verifica si un nombre de centro de costo es del sistema
export const isSystemCostCenter = (name) => {
  if (!name) return false;
  const normalized = name.toUpperCase().trim();
  return SYSTEM_CENTER_NAMES.includes(normalized);
};

// Garantiza que los centros del sistema estén presentes en una lista de centros de costo.
// No modifica los existentes si ya están, solo agrega los faltantes.
export const ensureSystemCostCenters = (costCenters = []) => {
  const result = [...costCenters];
  
  for (const sysCenter of SYSTEM_COST_CENTERS) {
    const exists = result.some(c => c.name.toUpperCase().trim() === sysCenter.name);
    if (!exists) {
      // Insertar al inicio para que estén siempre primero
      result.unshift({ ...sysCenter });
    } else {
      // Marcar como sistema si ya existe
      const idx = result.findIndex(c => c.name.toUpperCase().trim() === sysCenter.name);
      if (idx >= 0) {
        result[idx] = { ...result[idx], isSystem: true };
      }
    }
  }
  
  return result;
};