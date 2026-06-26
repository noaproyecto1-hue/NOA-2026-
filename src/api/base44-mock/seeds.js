// Datos iniciales — solo se cargan la primera vez (si la entidad no existe
// en localStorage). Para resetear: window.__b44Mock.reset() en consola.

import { store } from './store.js';

// Usuario administrador por defecto. Login: cesar / 1234
export const DEMO_USER = {
  id: 'user_cesar_admin',
  username: 'cesar',
  email: 'felipe@local',
  password: '1234',
  full_name: 'Felipe (Administrador)',
  display_name: 'Felipe',
  profile_photo: '',
  role: 'user',     // no 'admin' — admin redirige siempre al SuperadminDashboard
  app_role: 'manager',
  restaurant_ids: ['rest_demo_1'],
  allowed_sections: [
    'Dashboard', 'Inventory', 'Recipes', 'DataManagement', 'Empleados',
    'Clientes', 'Restaurants', 'MyProfile', 'Settings', 'Copilot', 'SII',
  ],
  onboarding_completed: true,
  is_approved: true,
  created_date: new Date().toISOString(),
};

const DEMO_RESTAURANT = {
  id: 'rest_demo_1',
  name: 'Casa Mediterránea',
  slug: 'casa-mediterranea',
  address: 'Av. Diego Portales 750, Puerto Montt',
  phone: '+56 65 2 234 567',
  email: 'contacto@casamediterranea.cl',
  is_active: true,
  created_by: DEMO_USER.email,
  currency: 'CLP',
  timezone: 'America/Santiago',
  cuisine_type: 'mediterranea',
  capacity: 80,
  config: {
    monthly_sales_target: 70000000,
    ideal_stock_percent: 10,
  },
};

const DEMO_SUPPLY_ITEMS = [
  { name: 'Tomate', category: 'verduras', unit: 'kg', stock: 12, min_stock: 5, cost_per_unit: 800, restaurant_id: 'rest_demo_1' },
  { name: 'Pollo', category: 'proteinas', unit: 'kg', stock: 8, min_stock: 3, cost_per_unit: 4500, restaurant_id: 'rest_demo_1' },
  { name: 'Arroz', category: 'abarrotes', unit: 'kg', stock: 25, min_stock: 10, cost_per_unit: 1200, restaurant_id: 'rest_demo_1' },
  { name: 'Aceite', category: 'abarrotes', unit: 'l', stock: 4, min_stock: 5, cost_per_unit: 3200, restaurant_id: 'rest_demo_1' },
];

const DEMO_RECIPES = [
  { name: 'Arroz con Pollo', category: 'plato_principal', sale_price: 7900, restaurant_id: 'rest_demo_1', ingredients: [] },
  { name: 'Ensalada Mixta', category: 'entrada', sale_price: 3500, restaurant_id: 'rest_demo_1', ingredients: [] },
];

const DEMO_SUPPLIERS = [
  { name: 'Distribuidora Central', contact: 'Pedro G.', phone: '+56 2 2000 0000', restaurant_id: 'rest_demo_1' },
];

export async function seedIfEmpty() {
  if (!store.has('User')) {
    await store.bulkCreate('User', [DEMO_USER]);
  } else {
    // Garantizar que cesar existe siempre (para que puedas loguear aunque
    // borres datos a la mitad). Si existe pero le falta password, lo repara.
    const users = await store.list('User');
    const cesar = users.find((u) => u.id === DEMO_USER.id);
    if (!cesar) {
      await store.create('User', DEMO_USER);
    } else {
      // Repara password si falta y fuerza el nombre actual (Felipe) sobre
      // usuarios sembrados antes con el nombre anterior.
      const patch = {};
      if (!cesar.password) { patch.password = DEMO_USER.password; patch.username = DEMO_USER.username; }
      if (cesar.display_name !== DEMO_USER.display_name) { patch.display_name = DEMO_USER.display_name; patch.full_name = DEMO_USER.full_name; }
      if (cesar.email !== DEMO_USER.email) { patch.email = DEMO_USER.email; }
      if (Object.keys(patch).length) await store.update('User', cesar.id, patch);
    }
  }
  if (!store.has('Restaurant')) store.bulkCreate('Restaurant', [DEMO_RESTAURANT]);
  if (!store.has('SupplyItem')) store.bulkCreate('SupplyItem', DEMO_SUPPLY_ITEMS);
  if (!store.has('Recipe')) store.bulkCreate('Recipe', DEMO_RECIPES);
  if (!store.has('Supplier')) store.bulkCreate('Supplier', DEMO_SUPPLIERS);
  // Entidades vacías por default — se llenan al usar la app
  for (const entity of [
    'Alert', 'Customer', 'DailyCountConfig', 'DailyMetrics', 'DeviationConfig',
    'EmployeeMetrics', 'InventoryCount', 'InvitationCode', 'OpEx', 'RecipeSample',
    'RegistroMerma', 'Sale', 'StockMovement', 'SupplyCost', 'SyncLog',
  ]) {
    if (!store.has(entity)) store.bulkCreate(entity, []);
  }
}
