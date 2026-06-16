// Generador de datos de demostración (ficticios) para ver la plataforma con
// contenido. NO toca SII (datos en vivo de SimpleAPI) ni la sincronización
// Fudo (vive en Vercel KV). Solo puebla las entidades locales del mock.
//
// Uso:
//   - Automático: se ejecuta al cargar si no hay datos demo y no se borraron.
//   - Manual: window.__b44Mock.loadDemo()  /  window.__b44Mock.clearDemo()
//   - Botón en Settings → Integraciones (o donde se exponga).

import { store } from './store.js';

const RID = 'rest_demo_1';
const FLAG = 'noa_demo_loaded_v3';

const rnd = (min, max) => min + Math.random() * (max - min);
const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Familias e insumos ──
const FAMILIAS = {
  'Proteína animal': [
    ['Filete de vacuno', 'kg', 9800], ['Asado de tira', 'kg', 7200], ['Posta negra', 'kg', 6800],
    ['Carne molida', 'kg', 5400], ['Lomo de cerdo', 'kg', 5200], ['Costilla de cerdo', 'kg', 4800],
    ['Pechuga de pollo', 'kg', 4500], ['Salmón fresco', 'kg', 11200], ['Reineta', 'kg', 6900],
    ['Camarones', 'kg', 9500], ['Chorizo', 'kg', 4200], ['Longaniza', 'kg', 3900], ['Pavo molido', 'kg', 5100],
  ],
  'Lácteos y huevo': [
    ['Leche entera', 'lt', 1100], ['Crema', 'lt', 2400], ['Mantequilla', 'kg', 7800],
    ['Queso mantecoso', 'kg', 8900], ['Queso crema', 'kg', 6500], ['Huevos', 'docena', 3200], ['Yogurt natural', 'lt', 1800],
  ],
  'Frutas y verduras': [
    ['Tomate', 'kg', 980], ['Lechuga', 'und', 750], ['Palta Hass', 'kg', 3800], ['Cebolla', 'kg', 690],
    ['Papa', 'kg', 540], ['Zanahoria', 'kg', 620], ['Limón', 'kg', 1400], ['Pimentón', 'kg', 1900],
  ],
  'Abarrotes y secos': [
    ['Arroz', 'kg', 1250], ['Fideos', 'kg', 1100], ['Harina', 'kg', 980], ['Azúcar', 'kg', 1050],
    ['Sal', 'kg', 480], ['Lentejas', 'kg', 2100], ['Garbanzos', 'kg', 2300],
  ],
  'Panadería y masas': [
    ['Pan de molde', 'und', 1900], ['Marraqueta', 'kg', 1800], ['Masa hojaldre', 'kg', 4200],
    ['Strudel', 'und', 16000], ['Pie de limón', 'und', 12000],
  ],
  'Aceites y mantecas': [
    ['Aceite vegetal', 'lt', 2400], ['Aceite oliva', 'lt', 8900], ['Manteca', 'kg', 3600],
  ],
  'Bebidas y aguas': [
    ['Agua mineral', 'und', 650], ['Bebida cola', 'lt', 1400], ['Jugo natural', 'lt', 2200], ['Cerveza artesanal', 'und', 2800],
  ],
};

const PROVEEDORES = [
  ['Comercial Quillaico Verde SPA', '77398882-K'],
  ['Distribuidora Central Ltda.', '76123456-7'],
  ['Ariztia Comercial Ltda.', '83614800-2'],
  ['Repostería Marcia Vera E.I.R.L.', '77398871-4'],
  ['José Rivero Llamazales y Cía.', '86520500-7'],
  ['Frutícola del Sur SPA', '76998123-4'],
  ['Lácteos Llanquihue Ltda.', '77445566-8'],
];

const PAYMENTS = ['Efectivo', 'Tarj. Débito', 'Tarj. Crédito', 'Transferencia'];
const DELIVERY_CHANNELS = ['PedidosYa', 'Uber Eats', 'Justo'];

const RECETAS = [
  { name: 'Salsa de tomate casera', unit: 'lt', yield: 5, sale_price: 0, cost: 4200, tags: ['base', 'salsa'] },
  { name: 'Mayonesa de la casa', unit: 'lt', yield: 3, sale_price: 0, cost: 3100, tags: ['base', 'salsa'] },
  { name: 'Hamburguesa clásica', unit: 'und', yield: 1, sale_price: 7900, cost: 2900, tags: ['fondo'] },
  { name: 'Ensalada César', unit: 'und', yield: 1, sale_price: 6500, cost: 2100, tags: ['entrada'] },
  { name: 'Salmón grillado', unit: 'und', yield: 1, sale_price: 12900, cost: 5400, tags: ['fondo'] },
  { name: 'Tiramisú', unit: 'und', yield: 1, sale_price: 4900, cost: 1600, tags: ['postre'] },
];

const CLIENTES = [
  ['Juan Pérez', 'juan.perez@mail.cl', '+56 9 8123 4567'],
  ['María González', 'maria.g@mail.cl', '+56 9 7234 5678'],
  ['Empresa ACME SPA', 'compras@acme.cl', '+56 2 2345 6789'],
  ['Catering Eventos Ltda.', 'eventos@catering.cl', '+56 9 6345 6789'],
  ['Pedro Soto', 'pedro.soto@mail.cl', '+56 9 5456 7890'],
];

const EMPLEADOS = [
  ['Camila Rojas', 'Garzona', 4.8], ['Diego Muñoz', 'Garzón', 4.5], ['Valentina Díaz', 'Cajera', 4.9],
  ['Matías Fuentes', 'Cocinero', 4.6], ['Fernanda Lagos', 'Garzona', 4.3],
];

function isoDaysAgo(days, hour = 12, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

export async function loadDemoData({ force = false } = {}) {
  if (typeof window === 'undefined') return;
  if (!force && localStorage.getItem(FLAG)) return; // ya cargado

  // ── Insumos ──
  const supplyItems = [];
  let invoiceCounter = 38560000;
  const supplyCosts = [];

  // Área de conteo según familia (Barra / Cocina / Salón)
  const AREA_POR_FAMILIA = {
    'Proteína animal': 'Cocina', 'Lácteos y huevo': 'Cocina', 'Frutas y verduras': 'Cocina',
    'Abarrotes y secos': 'Cocina', 'Panadería y masas': 'Cocina', 'Aceites y mantecas': 'Cocina',
    'Bebidas y aguas': 'Barra',
  };
  for (const [familia, items] of Object.entries(FAMILIAS)) {
    for (const [name, unit, basePrice] of items) {
      const [supName, supRut] = pick(PROVEEDORES);
      const minStock = rndInt(3, 15);
      const curStock = rndInt(0, 60);
      const area = AREA_POR_FAMILIA[familia] || 'Sin clasificación';
      supplyItems.push({
        restaurant_id: RID, name, category: familia, supply_category: familia,
        unit, unit_of_measure: unit, area,
        // Campos que usa la página de Inventario:
        current_stock: curStock, min_stock: minStock, warning_stock: minStock + rndInt(2, 6),
        average_unit_cost: Math.round(basePrice), cost_per_unit: Math.round(basePrice),
        cost_center_name: 'Food Cost', supplier: supName, is_active: true,
      });

      // Historial de compras: 12 meses, 1-3 compras por mes, con deriva de precio
      let price = basePrice;
      for (let monthsBack = 11; monthsBack >= 0; monthsBack--) {
        const purchases = rndInt(1, 3);
        for (let p = 0; p < purchases; p++) {
          price = Math.max(basePrice * 0.7, price * rnd(0.96, 1.06)); // deriva ±
          const qty = Math.round(rnd(2, 40));
          const subtotal = Math.round(price * qty);
          const tax = Math.round(subtotal * 0.19);
          const dayInMonth = rndInt(1, 27);
          const daysAgo = monthsBack * 30 + (27 - dayInMonth);
          const [pName, pRut] = pick(PROVEEDORES);
          supplyCosts.push({
            restaurant_id: RID, date: isoDaysAgo(daysAgo), supply_category: familia,
            supply_item_name: name, supply_type: 'supply',
            quantity_purchased: qty, unit_of_measure: unit,
            subtotal, tax_amount: tax, total_cost: subtotal + tax,
            supplier: pName, supplier_tax_id: pRut,
            invoice_number: String(invoiceCounter++),
            payment_status: pick(['pagado', 'pendiente']),
          });
        }
      }
    }
  }

  // ── Ventas: últimos 60 días ──
  const sales = [];
  let saleId = 1;
  for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
    const dow = new Date(Date.now() - daysAgo * 86400000).getDay();
    const base = (dow === 5 || dow === 6) ? rndInt(28, 45) : rndInt(12, 30); // más fin de semana
    for (let i = 0; i < base; i++) {
      // Horas pico: almuerzo 12-15, cena 19-22
      const hour = Math.random() < 0.55 ? rndInt(12, 15) : (Math.random() < 0.7 ? rndInt(19, 22) : rndInt(9, 23));
      const min = rndInt(0, 59);
      const isDelivery = Math.random() < 0.28;
      const subtotal = rndInt(4000, 38000);
      const tax = Math.round(subtotal * 0.19);
      const discount = Math.random() < 0.15 ? rndInt(500, 3000) : 0;
      const tip = (!isDelivery && Math.random() < 0.4) ? Math.round(subtotal * rnd(0.05, 0.12)) : 0;
      sales.push({
        restaurant_id: RID, id: `demo_sale_${saleId++}`,
        external_source: 'demo',
        date_time: isoDaysAgo(daysAgo, hour, min),
        total_amount: subtotal + tax - discount,
        subtotal_amount: subtotal, tax_amount: tax, discount_amount: discount, tip_amount: tip,
        payment_method: pick(PAYMENTS),
        is_delivery: isDelivery,
        origin: isDelivery ? 'Delivery' : 'Mesa',
        delivery: isDelivery ? pick(DELIVERY_CHANNELS) : '',
        table: isDelivery ? '' : `Mesa ${rndInt(1, 18)}`,
        guests: isDelivery ? 0 : rndInt(1, 6),
        is_cancelled: false,
      });
    }
  }

  // ── Recetas / elaborados ──
  const recipes = RECETAS.map((r) => ({ restaurant_id: RID, is_elaborado: true, ingredients: [], ...r }));

  // ── Proveedores ──
  const suppliers = PROVEEDORES.map(([name, rut]) => ({
    restaurant_id: RID, name, tax_id: rut, contact: pick(['Pedro G.', 'Ana M.', 'Luis R.', 'Carla S.']),
    phone: `+56 9 ${rndInt(4000, 8999)} ${rndInt(1000, 9999)}`, email: `ventas@${name.split(' ')[0].toLowerCase()}.cl`,
  }));

  // ── Clientes ──
  const customers = CLIENTES.map(([name, email, phone]) => ({
    restaurant_id: RID, name, email, phone, total_orders: rndInt(1, 40), total_spent: rndInt(15000, 900000),
  }));

  // ── Empleados (métricas) ──
  const employeeMetrics = EMPLEADOS.map(([name, role, rating]) => ({
    restaurant_id: RID, employee_name: name, role,
    rating, total_sales: rndInt(800000, 4500000), tips_total: rndInt(50000, 350000),
    orders_count: rndInt(80, 600), period: new Date().toISOString().slice(0, 7),
  }));

  // ── OpEx (gastos operacionales) — alimenta los donuts del Dashboard ──
  // Tipos: payroll (RRHH), rent (Renta), utilities/insurance (Gastos fijos),
  //        marketing, maintenance (Administración).
  const OPEX_PLAN = [
    ['payroll', 'PAYROLL/RRHH', 15200000],
    ['rent', 'REAL STATE/RENTA', 1825000],
    ['utilities', 'GASTOS FIJOS', 720000],
    ['insurance', 'GASTOS FIJOS', 280000],
    ['maintenance', 'ADMINISTRACIÓN', 410000],
    ['marketing', 'MARKETING', 608000],
  ];
  const opex = [];
  for (let monthsBack = 2; monthsBack >= 0; monthsBack--) {
    for (const [type, center, base] of OPEX_PLAN) {
      const amount = Math.round(base * rnd(0.95, 1.05));
      opex.push({
        restaurant_id: RID, type, cost_center_name: center, amount,
        date: isoDaysAgo(monthsBack * 30 + 5), payment_status: 'pagado',
        description: `${center} — mensual`,
      });
    }
  }

  // Reemplaza solo las entidades de negocio (NO User/Restaurant/SyncLog/SII/Fudo)
  store.bulkCreate('SupplyItem', supplyItems, { replace: true });
  store.bulkCreate('SupplyCost', supplyCosts, { replace: true });
  store.bulkCreate('Sale', sales, { replace: true });
  store.bulkCreate('Recipe', recipes, { replace: true });
  store.bulkCreate('Supplier', suppliers, { replace: true });
  store.bulkCreate('Customer', customers, { replace: true });
  store.bulkCreate('EmployeeMetrics', employeeMetrics, { replace: true });
  store.bulkCreate('OpEx', opex, { replace: true });

  // Familias extra para el gestor de familias
  try { localStorage.setItem('noa_familias_extra', JSON.stringify(Object.keys(FAMILIAS))); } catch {}

  localStorage.setItem(FLAG, new Date().toISOString());
  console.info(`[demo] Cargados: ${supplyItems.length} insumos, ${supplyCosts.length} compras, ${sales.length} ventas, ${recipes.length} recetas.`);
  return { supplyItems: supplyItems.length, supplyCosts: supplyCosts.length, sales: sales.length };
}

export async function clearDemoData() {
  if (typeof window === 'undefined') return;
  for (const e of ['SupplyItem', 'SupplyCost', 'Sale', 'Recipe', 'Supplier', 'Customer', 'EmployeeMetrics', 'OpEx']) {
    store.bulkCreate(e, [], { replace: true });
  }
  localStorage.removeItem(FLAG);
  localStorage.removeItem('noa_demo_loaded_v1');
  localStorage.removeItem('noa_demo_loaded_v2');
  localStorage.removeItem('noa_familias_extra');
  console.info('[demo] Datos de demostración borrados.');
}
