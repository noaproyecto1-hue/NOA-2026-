// Generador de datos de demostración COHERENTES para Casa Mediterránea.
// Determinista (semilla fija): los números cuadran entre sí y reflejan una
// realidad posible — NO son aleatorios. Período simulado: día 26 de 30 del mes
// en curso, meta mensual $70.000.000.
//
// Cuadre (acumulado a día 26, sobre venta NETA):
//   Venta neta   $61.100.000   100.0%
//   Food cost    $19.552.000    32.0%   (compras netas)
//   OPEX         $16.191.500    26.5%   (sin remuneraciones)
//   Labor        $17.719.000    29.0%   (remuneraciones)
//   Utilidad     $ 7.637.500    12.5%
//
// Uso:
//   - Automático al cargar si no hay datos demo de esta versión.
//   - Manual: window.__b44Mock.loadDemo() / window.__b44Mock.clearDemo()

import { store } from './store.js';

const RID = 'rest_demo_1';
const FLAG = 'noa_demo_loaded_v5';

// ── PRNG determinista (mulberry32) — semilla fija → datos estables y reproducibles ──
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260626);
const rnd = (min, max) => min + rng() * (max - min);
const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

// ── Período de simulación ──
const TODAY = new Date();
const SIM_YEAR = TODAY.getFullYear();
const SIM_MONTH = TODAY.getMonth();        // 0-index
const SIM_DAY = 26;                        // "Día 26 de 30"
const DAYS_IN_MONTH = new Date(SIM_YEAR, SIM_MONTH + 1, 0).getDate();

// ── Objetivos del cuadre (acumulado a día 26) ──
const VENTA_NETA = 61_100_000;
const VENTA_BRUTA = Math.round(VENTA_NETA * 1.19);   // 72.709.000
const FOOD_NET = 19_552_000;                          // 32%
const OPEX_TOTAL = 16_191_500;                        // 26.5% (sin RRHH)
const LABOR_TOTAL = 17_719_000;                       // 29% (RRHH)

const IVA = 1.19;

function iso(year, month, day, hour = 12, min = 0) {
  return new Date(year, month, day, hour, min, 0, 0).toISOString();
}

// Escala una lista de montos para que sumen EXACTAMENTE `target` (absorbe redondeo).
function scaleToTarget(amounts, target) {
  const sum = amounts.reduce((a, b) => a + b, 0) || 1;
  const scaled = amounts.map((a) => Math.round((a * target) / sum));
  const diff = target - scaled.reduce((a, b) => a + b, 0);
  if (scaled.length) scaled[scaled.length - 1] += diff;
  return scaled;
}

// ── Familias e insumos (precio neto referencial por unidad) ──
// Orden y nombres alineados al módulo Compras. Incluye los 4 productos de alerta.
const FAMILIAS = {
  'Proteína animal': [
    ['Lomo vetado', 'kg', 9700], ['Filete de vacuno', 'kg', 9800], ['Asado de tira', 'kg', 7200],
    ['Carne molida', 'kg', 5400], ['Pechuga de pollo', 'kg', 4500], ['Salmón fresco', 'kg', 11200],
    ['Reineta', 'kg', 6900], ['Chorizo parrillero', 'kg', 4200],
  ],
  'Lácteos y huevo': [
    ['Leche entera', 'lt', 1100], ['Crema', 'lt', 2400], ['Mantequilla', 'kg', 7800],
    ['Queso mantecoso', 'kg', 8900], ['Huevos', 'docena', 3200],
  ],
  'Frutas y verduras': [
    ['Tomate rama', 'kg', 4450], ['Lechuga costina', 'und', 750], ['Palta Hass', 'kg', 3800],
    ['Cebolla', 'kg', 690], ['Papa', 'kg', 540], ['Limón', 'kg', 1400], ['Rúcula', 'kg', 5200],
  ],
  'Abarrotes y secos': [
    ['Arroz arborio', 'kg', 2100], ['Fideos', 'kg', 1100], ['Harina', 'kg', 980],
    ['Aceitunas', 'kg', 5600], ['Garbanzos', 'kg', 2300],
  ],
  'Panadería y masas': [
    ['Pan de masa madre', 'und', 2200], ['Focaccia', 'und', 3200], ['Masa hojaldre', 'kg', 4200],
  ],
  'Aceites y mantecas': [
    ['Aceite de oliva virgen', 'lt', 6900], ['Aceite vegetal', 'lt', 2400], ['Manteca', 'kg', 3600],
  ],
  'Bebidas y aguas': [
    ['Agua mineral', 'und', 650], ['Vino tinto reserva', 'und', 6800], ['Cerveza artesanal', 'und', 2800],
    ['Bebida cola', 'lt', 1400], ['Jugo natural', 'lt', 2200],
  ],
};
// Reparto del food cost por familia (suma = 1.0)
const FAM_SHARE = {
  'Proteína animal': 0.40, 'Frutas y verduras': 0.14, 'Lácteos y huevo': 0.10,
  'Abarrotes y secos': 0.08, 'Panadería y masas': 0.06, 'Aceites y mantecas': 0.06,
  'Bebidas y aguas': 0.16,
};
const AREA_POR_FAMILIA = {
  'Proteína animal': 'Cocina', 'Lácteos y huevo': 'Cocina', 'Frutas y verduras': 'Cocina',
  'Abarrotes y secos': 'Cocina', 'Panadería y masas': 'Cocina', 'Aceites y mantecas': 'Cocina',
  'Bebidas y aguas': 'Barra',
};

const PROVEEDORES = [
  ['Comercializadora del Sur SPA', '77398882-K', 'Pedro Gálvez'],
  ['Distribuidora Patagonia Ltda.', '76123456-7', 'Ana Muñoz'],
  ['Pesquera Reloncaví S.A.', '83614800-2', 'Luis Soto'],
  ['Frutícola Llanquihue SPA', '76998123-4', 'Carla Vera'],
  ['Lácteos del Lago Ltda.', '77445566-8', 'Jorge Pérez'],
  ['Viñedos & Bebidas Austral', '86520500-7', 'María Lillo'],
];
// Proveedor preferente por familia (coherencia: pescadería vende pescado, etc.)
const PROV_FAMILIA = {
  'Proteína animal': 0, 'Lácteos y huevo': 4, 'Frutas y verduras': 3,
  'Abarrotes y secos': 1, 'Panadería y masas': 1, 'Aceites y mantecas': 1, 'Bebidas y aguas': 5,
};
const PROV_PESCADO = 2; // Pesquera para Salmón/Reineta

const PAYMENTS = ['Efectivo', 'Tarj. Débito', 'Tarj. Crédito', 'Transferencia'];
const DELIVERY_CHANNELS = ['PedidosYa', 'Uber Eats'];

export async function loadDemoData({ force = false } = {}) {
  if (typeof window === 'undefined') return;
  if (!force && localStorage.getItem(FLAG)) return;

  let invoiceCounter = 38560420;
  const supplyItems = [];
  const supplyCosts = [];

  // ════════ 1. INSUMOS + COMPRAS (food cost) ════════
  // Allocación por ítem (peso por precio) → mes actual escalado a FOOD_NET exacto.
  // Historial: 5 meses previos por ítem para los gráficos y columnas mensuales.
  const itemList = []; // {name, unit, basePrice, familia, area, provIdx, monthNet}
  for (const [familia, items] of Object.entries(FAMILIAS)) {
    const famNetMonth = FOOD_NET * (FAM_SHARE[familia] || 0);
    const pesoTotal = items.reduce((a, [, , p]) => a + p, 0);
    for (const [name, unit, basePrice] of items) {
      const provIdx = /salm|reineta/i.test(name) ? PROV_PESCADO : (PROV_FAMILIA[familia] ?? 0);
      const itemNet = famNetMonth * (basePrice / pesoTotal);
      itemList.push({ name, unit, basePrice, familia, area: AREA_POR_FAMILIA[familia] || 'Cocina', provIdx, monthNet: itemNet });
    }
  }

  // SupplyItems (catálogo)
  for (const it of itemList) {
    const [supName, supRut] = PROVEEDORES[it.provIdx];
    const minStock = rndInt(4, 14);
    supplyItems.push({
      restaurant_id: RID, name: it.name, category: it.familia, supply_category: it.familia,
      unit: it.unit, unit_of_measure: it.unit, area: it.area,
      current_stock: rndInt(minStock, minStock + 40), min_stock: minStock, warning_stock: minStock + rndInt(3, 7),
      average_unit_cost: it.basePrice, cost_per_unit: it.basePrice,
      cost_center_name: 'Food Cost', supplier: supName, supplier_tax_id: supRut, is_active: true,
    });
  }

  // Compras del MES ACTUAL — recolectar netos crudos y escalar a FOOD_NET exacto.
  const curMonthRaw = []; // {item, net, day}
  for (const it of itemList) {
    const nInv = it.monthNet > 700000 ? 3 : it.monthNet > 250000 ? 2 : 1;
    for (let k = 0; k < nInv; k++) {
      const day = Math.min(SIM_DAY, 2 + Math.floor((k + rnd(0, 0.8)) * (SIM_DAY / Math.max(1, nInv))));
      curMonthRaw.push({ it, raw: (it.monthNet / nInv) * rnd(0.85, 1.15), day });
    }
  }
  const scaledNets = scaleToTarget(curMonthRaw.map((r) => r.raw), FOOD_NET);
  curMonthRaw.forEach((r, i) => {
    const net = scaledNets[i];
    const qty = Math.max(1, Math.round(net / r.it.basePrice));
    const tax = Math.round(net * (IVA - 1));
    const [pName, pRut] = PROVEEDORES[r.it.provIdx];
    supplyCosts.push({
      restaurant_id: RID, date: iso(SIM_YEAR, SIM_MONTH, r.day, rndInt(8, 17)),
      supply_category: r.it.familia, supply_item_name: r.it.name, supply_type: 'supply',
      quantity_purchased: qty, unit_of_measure: r.it.unit,
      subtotal: net, tax_amount: tax, total_cost: net + tax,
      supplier: pName, supplier_tax_id: pRut,
      invoice_number: String(invoiceCounter++), payment_status: rng() < 0.7 ? 'pagado' : 'pendiente',
      glosa: r.it.name,
    });
  });

  // Historial: 5 meses previos (food cost ~31–33% creciendo) para tendencia y columnas mensuales.
  const prevFoodNet = [18_100_000, 18_640_000, 19_050_000, 19_320_000, 19_460_000]; // meses -5..-1
  prevFoodNet.forEach((monthNet, idx) => {
    const monthsBack = 5 - idx;
    const m = SIM_MONTH - monthsBack, y = SIM_YEAR;
    const raws = itemList.map((it) => it.monthNet * rnd(0.85, 1.12));
    const nets = scaleToTarget(raws, monthNet);
    itemList.forEach((it, i) => {
      const net = nets[i]; if (net <= 0) return;
      const qty = Math.max(1, Math.round(net / it.basePrice));
      const tax = Math.round(net * (IVA - 1));
      const [pName, pRut] = PROVEEDORES[it.provIdx];
      supplyCosts.push({
        restaurant_id: RID, date: iso(y, m, rndInt(3, 25), rndInt(8, 17)),
        supply_category: it.familia, supply_item_name: it.name, supply_type: 'supply',
        quantity_purchased: qty, unit_of_measure: it.unit,
        subtotal: net, tax_amount: tax, total_cost: net + tax,
        supplier: pName, supplier_tax_id: pRut,
        invoice_number: String(invoiceCounter++), payment_status: 'pagado', glosa: it.name,
      });
    });
  });

  // ════════ 2. VENTAS ════════
  // Mes actual: días 1..26, domingos cerrados, suma EXACTA = VENTA_BRUTA. Día 26 = 104 tickets.
  const sales = [];
  let saleId = 1;
  const genMonthSales = (year, month, lastDay, brutoTarget, ticketsPerDay) => {
    const opDays = [];
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(year, month, d).getDay();
      if (dow === 0) continue; // domingo cerrado
      const w = dow === 5 ? 1.35 : dow === 6 ? 1.5 : 1.0; // viernes/sábado más
      opDays.push({ d, w });
    }
    const dayBrutos = scaleToTarget(opDays.map((o) => o.w), brutoTarget);
    opDays.forEach((o, di) => {
      const dayBruto = dayBrutos[di];
      const isLast = o.d === lastDay;
      const count = isLast ? 104 : Math.max(1, Math.round(ticketsPerDay * o.w * rnd(0.9, 1.1)));
      const raws = Array.from({ length: count }, () => rnd(0.55, 1.6));
      const tickets = scaleToTarget(raws, dayBruto);
      tickets.forEach((bruto) => {
        if (bruto <= 0) return;
        const subtotal = Math.round(bruto / IVA);
        const tax = bruto - subtotal;
        const isDelivery = rng() < 0.24;
        const hour = rng() < 0.55 ? rndInt(12, 15) : (rng() < 0.7 ? rndInt(19, 22) : rndInt(9, 23));
        const tip = (!isDelivery && rng() < 0.4) ? Math.round(subtotal * rnd(0.05, 0.1)) : 0;
        sales.push({
          restaurant_id: RID, id: `demo_sale_${saleId++}`, external_source: 'demo',
          date_time: iso(year, month, o.d, hour, rndInt(0, 59)),
          total_amount: bruto, subtotal_amount: subtotal, tax_amount: tax,
          discount_amount: 0, tip_amount: tip,
          payment_method: pick(PAYMENTS), is_delivery: isDelivery,
          origin: isDelivery ? 'Delivery' : 'Mesa',
          delivery: isDelivery ? pick(DELIVERY_CHANNELS) : '',
          table: isDelivery ? '' : `Mesa ${rndInt(1, 22)}`,
          guests: isDelivery ? 0 : rndInt(1, 6), is_cancelled: false,
        });
      });
    });
  };
  genMonthSales(SIM_YEAR, SIM_MONTH, SIM_DAY, VENTA_BRUTA, 80);
  // 5 meses previos (venta neta creciente → tendencia positiva del relato)
  const prevNetaSales = [54_000_000, 56_500_000, 58_200_000, 59_600_000, 60_400_000];
  prevNetaSales.forEach((neta, idx) => {
    const monthsBack = 5 - idx;
    const d = new Date(SIM_YEAR, SIM_MONTH - monthsBack, 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    genMonthSales(d.getFullYear(), d.getMonth(), last, Math.round(neta * IVA), 14);
  });

  // ════════ 3. OPEX + LABOR (acumulado a día 26 = objetivos exactos) ════════
  // OPEX (sin RRHH) = $16.191.500 ; Labor (RRHH) = $17.719.000.
  const OPEX_PLAN = [
    ['rent', 'REAL STATE/RENTA', 'Arriendo local', 6_400_000],
    ['rent', 'REAL STATE/RENTA', 'Gasto común', 520_000],
    ['utilities', 'GASTOS FIJOS', 'Electricidad', 1_950_000],
    ['utilities', 'GASTOS FIJOS', 'Agua', 680_000],
    ['utilities', 'GASTOS FIJOS', 'Gas', 1_240_000],
    ['utilities', 'GASTOS FIJOS', 'Internet y telefonía', 320_000],
    ['marketing', 'MARKETING', 'Marketing digital', 1_350_000],
    ['marketing', 'MARKETING', 'Material gráfico', 480_000],
    ['maintenance', 'ADMINISTRACIÓN', 'Contabilidad', 760_000],
    ['technology', 'ADMINISTRACIÓN', 'Software / sistemas', 620_000],
    ['insurance', 'REAL STATE/RENTA', 'Seguros', 410_000],
    ['maintenance', 'GASTOS FIJOS', 'Mantención y aseo', 990_000],
  ];
  const LABOR_PLAN = [
    ['payroll', 'PAYROLL/RRHH', 'Cocina', 6_900_000],
    ['payroll', 'PAYROLL/RRHH', 'Salón', 4_850_000],
    ['payroll', 'PAYROLL/RRHH', 'Administración', 3_300_000],
    ['payroll', 'PAYROLL/RRHH', 'Gerencia', 2_669_000],
  ];
  const opex = [];
  const pushOpexMonth = (plan, target, year, month, day) => {
    const nets = scaleToTarget(plan.map(([, , , base]) => base), target);
    plan.forEach(([type, center, sub], i) => {
      opex.push({
        restaurant_id: RID, type, cost_center_name: center, subcategoria: sub, amount: nets[i],
        date: iso(year, month, day), payment_status: rng() < 0.8 ? 'pagado' : 'pendiente', description: sub,
      });
    });
  };
  // Mes actual (objetivos exactos)
  pushOpexMonth(OPEX_PLAN, OPEX_TOTAL, SIM_YEAR, SIM_MONTH, 5);
  pushOpexMonth(LABOR_PLAN, LABOR_TOTAL, SIM_YEAR, SIM_MONTH, 5);
  // 5 meses previos (~estables, leve variación)
  for (let mb = 5; mb >= 1; mb--) {
    const d = new Date(SIM_YEAR, SIM_MONTH - mb, 5);
    pushOpexMonth(OPEX_PLAN, Math.round(OPEX_TOTAL * rnd(0.96, 1.03)), d.getFullYear(), d.getMonth(), 5);
    pushOpexMonth(LABOR_PLAN, Math.round(LABOR_TOTAL * rnd(0.98, 1.02)), d.getFullYear(), d.getMonth(), 5);
  }

  // ════════ 4. PROVEEDORES / CLIENTES / EMPLEADOS / RECETAS ════════
  const suppliers = PROVEEDORES.map(([name, rut, contact]) => ({
    restaurant_id: RID, name, tax_id: rut, contact,
    phone: `+56 9 ${rndInt(4000, 8999)} ${rndInt(1000, 9999)}`,
    email: `ventas@${name.split(' ')[0].toLowerCase()}.cl`,
  }));

  const CLIENTES = [
    ['Hotel Cabañas del Lago', 'compras@cabanasdellago.cl', '+56 65 2 200 100', 38, 4_200_000],
    ['Constructora Aysén SPA', 'adm@aysen.cl', '+56 9 8123 4567', 12, 1_850_000],
    ['Familia Pérez (recurrente)', 'juanperez@mail.cl', '+56 9 7234 5678', 22, 740_000],
    ['Eventos Reloncaví', 'eventos@reloncavi.cl', '+56 9 6345 6789', 8, 2_100_000],
    ['María González', 'maria.g@mail.cl', '+56 9 5456 7890', 15, 410_000],
  ];
  const customers = CLIENTES.map(([name, email, phone, orders, spent]) => ({
    restaurant_id: RID, name, email, phone, total_orders: orders, total_spent: spent,
  }));

  // Empleados: las propinas/ventas de garzones cuadran con la venta del mes.
  const EMPLEADOS = [
    ['Camila Rojas', 'Garzona', 4.8, 0.30], ['Diego Muñoz', 'Garzón', 4.5, 0.26],
    ['Fernanda Lagos', 'Garzona', 4.6, 0.24], ['Valentina Díaz', 'Cajera', 4.9, 0.20],
    ['Matías Fuentes', 'Jefe de Cocina', 4.7, 0], ['Rodrigo Paredes', 'Cocinero', 4.4, 0],
  ];
  const periodo = `${SIM_YEAR}-${String(SIM_MONTH + 1).padStart(2, '0')}`;
  const employeeMetrics = EMPLEADOS.map(([name, role, rating, vshare]) => ({
    restaurant_id: RID, employee_name: name, role, rating,
    total_sales: Math.round(VENTA_BRUTA * vshare),
    tips_total: vshare ? Math.round(VENTA_BRUTA * vshare * 0.07) : 0,
    orders_count: vshare ? Math.round(2200 * vshare) : 0, period: periodo,
  }));

  // Recetas principales (precio venta con IVA, costo neto coherente con ~32%)
  const RECETAS = [
    ['Salmón a la mantequilla de limón', 'plato_principal', 14900, 5100],
    ['Risotto de hongos', 'plato_principal', 11900, 3600],
    ['Filete al vino tinto', 'plato_principal', 16900, 6200],
    ['Ensalada mediterránea', 'entrada', 7500, 2100],
    ['Focaccia de la casa', 'entrada', 4900, 1300],
    ['Tabla de quesos', 'entrada', 12900, 4800],
    ['Tiramisú', 'postre', 5400, 1500],
    ['Tarta de limón', 'postre', 4900, 1400],
  ];
  const recipes = RECETAS.map(([name, category, sale_price, cost]) => ({
    restaurant_id: RID, name, dish_name: name, category, sale_price, cost,
    is_elaborado: false, ingredients: [], servings: 1,
  }));

  // ════════ 5. ALERTAS (las 4 del relato, coherentes con el dashboard) ════════
  const alerts = [
    { producto: 'Lomo vetado', tipo: 'Robo', severidad: 82, estado: 'critico',
      compra: 485000, optimo: 323000, fuga: 162000, unidad: 'kg', detectado: iso(SIM_YEAR, SIM_MONTH, 14),
      impacto_acumulado: 2268000, accion: 'Revisar acceso a bodega frigorífica · últimos 4 turnos' },
    { producto: 'Aceite de oliva virgen', tipo: 'Desviación', severidad: 58, estado: 'atencion',
      compra: 124000, optimo: 96000, fuga: 28000, unidad: 'lt', detectado: iso(SIM_YEAR, SIM_MONTH, 18),
      impacto_acumulado: 224000, accion: 'Validar receta con jefe de cocina · implementar medidor (30ml vs 44ml/plato)' },
    { producto: 'Salmón fresco', tipo: 'Merma', severidad: 41, estado: 'atencion',
      compra: 378000, optimo: 336000, fuga: 42000, unidad: 'kg', detectado: iso(SIM_YEAR, SIM_MONTH, 20),
      impacto_acumulado: 42000, accion: 'Revisar cadena de frío · ajustar pedido próxima semana' },
    { producto: 'Tomate rama', tipo: 'Precio', severidad: 35, estado: 'atencion',
      compra: 89000, optimo: 66000, fuga: 23000, unidad: 'kg', detectado: iso(SIM_YEAR, SIM_MONTH, 1),
      impacto_acumulado: 460000, accion: 'Cotizar 2 proveedores alternativos · evaluar tomate pera (+34.8% vs mes anterior)' },
  ].map((a) => ({ restaurant_id: RID, is_resolved: false, ...a }));

  // ── Persistir (solo entidades de negocio) ──
  store.bulkCreate('SupplyItem', supplyItems, { replace: true });
  store.bulkCreate('SupplyCost', supplyCosts, { replace: true });
  store.bulkCreate('Sale', sales, { replace: true });
  store.bulkCreate('Recipe', recipes, { replace: true });
  store.bulkCreate('Supplier', suppliers, { replace: true });
  store.bulkCreate('Customer', customers, { replace: true });
  store.bulkCreate('EmployeeMetrics', employeeMetrics, { replace: true });
  store.bulkCreate('OpEx', opex, { replace: true });
  store.bulkCreate('Alert', alerts, { replace: true });

  // Restaurante → Casa Mediterránea (por si ya existía el genérico)
  try {
    const rests = await store.list('Restaurant');
    const r = rests.find((x) => x.id === RID);
    const patch = {
      name: 'Casa Mediterránea', slug: 'casa-mediterranea',
      address: 'Av. Diego Portales 750, Puerto Montt', phone: '+56 65 2 234 567',
      email: 'contacto@casamediterranea.cl', currency: 'CLP', cuisine_type: 'mediterranea',
      capacity: 80, is_active: true,
      config: { monthly_sales_target: 70000000, ideal_stock_percent: 10 },
    };
    if (r) await store.update('Restaurant', r.id, patch);
    else await store.create('Restaurant', { id: RID, created_by: 'cesar@local', ...patch });
  } catch {}

  // Familias para el gestor de familias de Compras
  try { localStorage.setItem('noa_familias_extra', JSON.stringify(Object.keys(FAMILIAS))); } catch {}

  localStorage.setItem(FLAG, new Date().toISOString());
  const foodNet = supplyCosts.filter((c) => new Date(c.date).getMonth() === SIM_MONTH).reduce((a, c) => a + c.subtotal, 0);
  const ventaBruta = sales.filter((s) => new Date(s.date_time).getMonth() === SIM_MONTH).reduce((a, s) => a + s.total_amount, 0);
  console.info(`[demo] Casa Mediterránea: ${supplyItems.length} insumos · ${supplyCosts.length} compras · ${sales.length} ventas · venta bruta mes $${ventaBruta.toLocaleString('es-CL')} (neta $${Math.round(ventaBruta / IVA).toLocaleString('es-CL')}) · food cost neto mes $${foodNet.toLocaleString('es-CL')}`);
  return { supplyItems: supplyItems.length, supplyCosts: supplyCosts.length, sales: sales.length };
}

export async function clearDemoData() {
  if (typeof window === 'undefined') return;
  for (const e of ['SupplyItem', 'SupplyCost', 'Sale', 'Recipe', 'Supplier', 'Customer', 'EmployeeMetrics', 'OpEx', 'Alert']) {
    store.bulkCreate(e, [], { replace: true });
  }
  localStorage.removeItem(FLAG);
  ['noa_demo_loaded_v1', 'noa_demo_loaded_v2', 'noa_demo_loaded_v3', 'noa_demo_loaded_v4'].forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem('noa_familias_extra');
  console.info('[demo] Datos de demostración borrados.');
}
