// Carga los DATOS REALES del negocio (ventas + compras 2026) desde
// public/noa-real-data.json hacia el store del mock. Reemplaza todas las
// entidades transaccionales. El JSON se obtiene en runtime (no infla el bundle);
// las entidades grandes (ventas) viven en memoria si exceden la cuota de
// localStorage y se vuelven a sembrar en cada carga.
//
//   - Automático al cargar.
//   - Manual: window.__b44Mock.loadDemo() / window.__b44Mock.clearDemo()

import { store } from './store.js';

const RID = 'rest_demo_1';
const FLAG = 'noa_real_loaded_v4';
const URL = '/noa-real-data.json';

export async function loadDemoData({ force = false } = {}) {
  if (typeof window === 'undefined') return;

  // ¿ya están los datos presentes (memoria o localStorage)?
  let hasSales = false;
  try { hasSales = (await store.list('Sale')).length > 0; } catch {}
  if (!force && hasSales && localStorage.getItem(FLAG)) return;

  let data;
  try {
    // Versionado + sin caché: evita servir el archivo de datos viejo desde el
    // caché del navegador (antes con force-cache se quedaba pegado al dataset pesado).
    const res = await fetch(`${URL}?v=${FLAG}`, { cache: 'reload' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (e) {
    console.warn('[real-data] no se pudo cargar', URL, e);
    return;
  }

  store.bulkCreate('Sale', data.sales || [], { replace: true });
  store.bulkCreate('SupplyCost', data.supplyCosts || [], { replace: true });
  store.bulkCreate('OpEx', data.opex || [], { replace: true });
  store.bulkCreate('SupplyItem', data.supplyItems || [], { replace: true });
  store.bulkCreate('Supplier', data.suppliers || [], { replace: true });
  store.bulkCreate('EmployeeMetrics', data.employeeMetrics || [], { replace: true });
  // Entidades sin datos reales en los Excel → vacías
  store.bulkCreate('Recipe', [], { replace: true });
  store.bulkCreate('Customer', [], { replace: true });
  store.bulkCreate('Alert', [], { replace: true });

  // Restaurante + metas coherentes con la venta real (~$50M/mes)
  try {
    const rests = await store.list('Restaurant');
    const r = rests.find((x) => x.id === RID);
    const cfg = { ...(r?.config || {}), ...(data.restaurant?.config || {}) };
    if (r) await store.update('Restaurant', r.id, { name: data.restaurant?.name || r.name, config: cfg });
  } catch {}

  // Meta del dashboard alineada a la venta real
  try {
    const target = data.restaurant?.config?.monthly_sales_target || 52000000;
    localStorage.setItem('noa_dash_cfg', JSON.stringify({ utilPct: 15, metaMensual: target, costoDirectoBM: 35 }));
  } catch {}

  // Familias reales (rubros) para el gestor de Compras
  try { localStorage.setItem('noa_familias_extra', JSON.stringify(data.familias || [])); } catch {}

  localStorage.setItem(FLAG, new Date().toISOString());
  console.info(`[real-data] cargado: ${(data.sales || []).length} ventas · ${(data.supplyCosts || []).length} compras · ${(data.opex || []).length} opex · ${(data.suppliers || []).length} proveedores`);
  return { sales: (data.sales || []).length, supplyCosts: (data.supplyCosts || []).length };
}

export async function clearDemoData() {
  if (typeof window === 'undefined') return;
  for (const e of ['Sale', 'SupplyCost', 'OpEx', 'SupplyItem', 'Supplier', 'EmployeeMetrics', 'Recipe', 'Customer', 'Alert']) {
    store.bulkCreate(e, [], { replace: true });
  }
  localStorage.removeItem(FLAG);
  ['noa_demo_loaded_v1', 'noa_demo_loaded_v2', 'noa_demo_loaded_v3', 'noa_demo_loaded_v4', 'noa_demo_loaded_v5'].forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem('noa_familias_extra');
  console.info('[real-data] datos borrados.');
}
