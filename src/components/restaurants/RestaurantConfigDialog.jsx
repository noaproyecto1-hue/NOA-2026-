import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Plus, 
  X, 
  Loader2,
  Tag,
  MapPin,
  ChefHat,
  Package,
  Users,
  UserPlus,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Truck,
  Link2,
  CreditCard,
  Lock
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from 'framer-motion';
import SupplierTab from '@/components/suppliers/SupplierTab';
import SupplierImportDialog from '@/components/suppliers/SupplierImportDialog';
import FudoConfigSection from '@/components/integrations/FudoConfigSection';
import EbillConfigSection from '@/components/integrations/EbillConfigSection';
import { SYSTEM_COST_CENTERS, isSystemCostCenter, ensureSystemCostCenters } from '@/components/utils/systemCostCenters';
import { normalizeSupplyCategories, serializeSupplyCategories } from '@/components/utils/supplyCategoryHelper';
import SupplyCategoryClassifier from '@/components/restaurants/SupplyCategoryClassifier';
import EmployeeManager from '@/components/restaurants/EmployeeManager';

// Tipos de OpEx disponibles (se mantiene internamente para mapping)
const opexTypes = [
  { value: 'rent', label: 'Arriendo' },
  { value: 'utilities', label: 'Servicios (Agua, Luz, Gas)' },
  { value: 'payroll', label: 'Nómina / Sueldos' },
  { value: 'insurance', label: 'Seguros' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'marketing', label: 'Marketing / Publicidad' },
  { value: 'licenses', label: 'Licencias y Permisos' },
  { value: 'technology', label: 'Tecnología' },
  { value: 'other', label: 'Otros' }
];

const defaultCostCenters = [
  ...SYSTEM_COST_CENTERS,
  { name: 'REAL STATE/RENTA', type: 'opex', opex_type: 'rent', description: 'Arriendo o alquiler del local comercial', categories: ['Renta Mensual', 'Gasto Común', 'Seguridad', 'Otros Gastos de Renta'] },
  { name: 'GASTOS FIJOS', type: 'opex', opex_type: 'insurance', description: 'Servicios básicos, seguros, licencias, permisos y otros gastos recurrentes', categories: ['Electricidad', 'Agua', 'Gas', 'Internet', 'Seguros', 'Licencias y Permisos', 'Otros'] },
  { name: 'MARKETING', type: 'opex', opex_type: 'marketing', description: 'Publicidad, redes sociales, campañas y promociones', categories: [] },
  { name: 'ADMINISTRACIÓN', type: 'opex', opex_type: 'other', description: 'Contabilidad, legal, software administrativo y oficina', categories: [] },
  { name: 'HIGIENE E INOCUIDAD', type: 'opex', opex_type: 'other', description: 'Productos de limpieza, sanitización y control de plagas', categories: [] },
  { name: 'COMUNICACIÓN', type: 'opex', opex_type: 'marketing', description: 'Diseño, branding, relaciones públicas y eventos', categories: [] },
  { name: 'LOGÍSTICA', type: 'opex', opex_type: 'other', description: 'Transporte, delivery, envíos y distribución', categories: [] },
  { name: 'INVERSIONES', type: 'opex', opex_type: 'other', description: 'Compra de equipos, remodelaciones y mejoras al local', categories: [] },
];

const defaultConfig = {
  preparation_zones: ['Cocina', 'Barra', 'Pastelería'],
  rooms: ['Sala Principal', 'Terraza'],
  tables_count: 20,
  cost_centers: defaultCostCenters,
  cost_center_items: ['ALIMENTOS', 'BEBIDAS', 'LIMPIEZA', 'PACKAGING', 'INTERNET', 'ARRIENDO', 'LIQUIDACIÓN', 'EQUIPOS', 'PUBLICIDAD'],
  supply_categories: [
    { name: 'Verduras', cost_type: 'food_cost' },
    { name: 'Carnes', cost_type: 'food_cost' },
    { name: 'Lácteos', cost_type: 'food_cost' },
    { name: 'Pescados', cost_type: 'food_cost' },
    { name: 'Granos', cost_type: 'food_cost' },
    { name: 'Desechables', cost_type: 'food_cost' },
    { name: 'Limpieza', cost_type: 'food_cost' },
  ],
  recipe_categories: ['Entradas', 'Platos Fuertes', 'Postres', 'Bebidas', 'Ensaladas', 'Sopas'],
  payment_methods: ['efectivo', 'tarjeta', 'transferencia'],
  default_tax_rate: 19,
  employees: [],
};

// Roles eliminados — ahora solo se clasifica por áreas

// Componente reutilizable para agregar items a una lista
const ListConfigSection = ({ items, onAdd, onRemove, placeholder, color, emptyText }) => {
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (newValue.trim() && !items.includes(newValue.trim())) {
      onAdd(newValue.trim());
      setNewValue('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Badge 
                variant="secondary"
                className={`pl-3 pr-1 py-1.5 flex items-center gap-2 ${color} border-0`}
              >
                <span className="text-sm">{item}</span>
                <button
                  onClick={() => onRemove(item)}
                  className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </Badge>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <span className="text-sm text-gray-400 italic">{emptyText}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-10"
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} size="sm" className="h-10 px-4 bg-gray-900 hover:bg-gray-800">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default function RestaurantConfigDialog({ 
  open, 
  onOpenChange, 
  restaurant,
  suppliers = [],
  sales = [],
  onSave,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onBulkCreateSuppliers,
  isSaving = false
}) {
  const [config, setConfig] = useState(restaurant?.config || defaultConfig);
  const [taxId, setTaxId] = useState(restaurant?.tax_id || '');
  const [activeTab, setActiveTab] = useState('operations');
  const [newEmployee, setNewEmployee] = useState({ name: '', area: '' });
  const [newCostCenter, setNewCostCenter] = useState({ name: '', type: 'opex', opex_type: 'other' });
  const [editingCenterCategories, setEditingCenterCategories] = useState(null);
  const [newCategoryValue, setNewCategoryValue] = useState('');
  // fixed_expenses removed — "gastos fijos" are now regular opex cost centers
  const [supplierImportOpen, setSupplierImportOpen] = useState(false);

  React.useEffect(() => {
    if (open) {
      setTaxId(restaurant?.tax_id || '');
    }
    if (open && restaurant?.config) {
      let costCenters = restaurant.config.cost_centers || defaultCostCenters;
      if (costCenters.length > 0 && typeof costCenters[0] === 'string') {
        costCenters = costCenters.map(name => {
          const normalized = name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (normalized === 'EXPLOTACION') {
            return { name, type: 'supply', opex_type: null };
          }
          return { name, type: 'opex', opex_type: 'other' };
        });
      }
      const employees = restaurant.config.employees || [];
      
      setConfig({ 
        ...defaultConfig, 
        ...restaurant.config, 
        cost_centers: ensureSystemCostCenters(costCenters),
        employees: employees
      });
    } else if (open && !restaurant?.config) {
      setConfig(defaultConfig);
    }
  }, [open, restaurant]);

  const handleSave = () => {
    // Asegurar que todos los campos se incluyan en el guardado
    const configToSave = {
      ...config,
      employees: config.employees || [],
      cost_centers: ensureSystemCostCenters(config.cost_centers || defaultCostCenters),
      payment_methods: config.payment_methods || [],
      preparation_zones: config.preparation_zones || [],
      rooms: config.rooms || [],
      supply_categories: serializeSupplyCategories(normalizeSupplyCategories(config.supply_categories || [])),
      recipe_categories: config.recipe_categories || [],
      cost_center_items: config.cost_center_items || [],
      tables_count: config.tables_count || 0,
      default_tax_rate: config.default_tax_rate || 19,
      employee_classification_mode: 'areas',
      employee_areas: config.employee_areas || []
    };
    onSave(configToSave, { tax_id: taxId });
  };

  const handleLoadDefaults = () => {
    setConfig({ ...defaultConfig, cost_centers: ensureSystemCostCenters(defaultConfig.cost_centers) });
  };

  // Funciones para listas simples
  const addToList = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), value]
    }));
  };

  const removeFromList = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(i => i !== value)
    }));
  };

  // Funciones para empleados
  const handleAddEmployee = () => {
    if (!newEmployee.name.trim()) return;
    const employee = {
      id: Date.now().toString(),
      name: newEmployee.name.trim(),
      role: 'other',
      area: newEmployee.area || '',
      is_active: true
    };
    setConfig(prev => ({
      ...prev,
      employees: [...(prev.employees || []), employee]
    }));
    setNewEmployee({ name: '', area: '' });
  };

  const handleRemoveEmployee = (employeeId) => {
    setConfig(prev => ({
      ...prev,
      employees: (prev.employees || []).filter(e => e.id !== employeeId)
    }));
  };

  const handleToggleEmployee = (employeeId) => {
    setConfig(prev => ({
      ...prev,
      employees: (prev.employees || []).map(e => 
        e.id === employeeId ? { ...e, is_active: !e.is_active } : e
      )
    }));
  };



  // Funciones para Cost Centers
  const handleAddCostCenter = () => {
    if (!newCostCenter.name.trim()) return;
    const costCenter = {
      name: newCostCenter.name.trim().toUpperCase(),
      type: 'opex',
      opex_type: 'other',
      categories: []
    };
    const currentCenters = config.cost_centers || [];
    if (!currentCenters.find(c => c.name === costCenter.name)) {
      setConfig(prev => ({
        ...prev,
        cost_centers: [...currentCenters, costCenter]
      }));
    }
    setNewCostCenter({ name: '', type: 'opex', opex_type: 'other' });
  };

  const handleRemoveCostCenter = (centerName) => {
    // No permitir eliminar centros del sistema
    if (isSystemCostCenter(centerName)) return;
    setConfig(prev => ({
      ...prev,
      cost_centers: (prev.cost_centers || []).filter(c => c.name !== centerName)
    }));
  };

  const handleUpdateCostCenterType = (centerName, newType, newOpexType) => {
    setConfig(prev => ({
      ...prev,
      cost_centers: (prev.cost_centers || []).map(c => 
        c.name === centerName 
          ? { ...c, type: newType, opex_type: newType === 'opex' ? (newOpexType || c.opex_type || 'other') : null }
          : c
      )
    }));
  };

  const getOpexTypeLabel = (opexType) => opexTypes.find(t => t.value === opexType)?.label || opexType;

  // Funciones para categorías dentro de un centro de costo
  const handleAddCenterCategory = (centerName) => {
    if (!newCategoryValue.trim()) return;
    setConfig(prev => ({
      ...prev,
      cost_centers: (prev.cost_centers || []).map(c => 
        c.name === centerName
          ? { ...c, categories: [...(c.categories || []), newCategoryValue.trim()] }
          : c
      )
    }));
    setNewCategoryValue('');
  };

  const handleRemoveCenterCategory = (centerName, category) => {
    setConfig(prev => ({
      ...prev,
      cost_centers: (prev.cost_centers || []).map(c => 
        c.name === centerName
          ? { ...c, categories: (c.categories || []).filter(cat => cat !== category) }
          : c
      )
    }));
  };

  const tabConfig = [
    { id: 'operations', label: 'Operación', icon: ChefHat },
    { id: 'costs', label: 'Costos', icon: Package },
    { id: 'supplies', label: 'Insumos', icon: Tag },
    { id: 'suppliers', label: 'Proveedores', icon: Truck },
    { id: 'team', label: 'Equipo', icon: Users },
    { id: 'integrations', label: 'Integraciones', icon: Link2 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        {/* Header Premium */}
        <div className="bg-gradient-to-r from-slate-900 via-gray-900 to-zinc-900 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="block text-xl font-bold">Configuración</span>
                <span className="text-sm font-normal text-white/60">{restaurant?.name}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <div className="border-b bg-gray-50/50 px-4 sm:px-6">
            <TabsList className="bg-transparent h-14 gap-0.5 w-full justify-start">
              {tabConfig.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger 
                    key={tab.id} 
                    value={tab.id}
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-lg px-3 sm:px-4 py-2.5 gap-2 text-xs sm:text-sm"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* TAB: OPERACIÓN (incluye datos generales del local) */}
            <TabsContent value="operations" className="mt-0 space-y-6">
              {/* RUT del restaurante */}
              <Card className="p-5 bg-gradient-to-br from-slate-50 to-gray-50 border-0 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-900 font-semibold">Datos Fiscales</Label>
                    <p className="text-xs text-gray-500">RUT y tasa de impuesto para cálculos fiscales en ventas y compras</p>
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">RUT del Restaurante</Label>
                    <Input
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="Ej: 77.918.459-5"
                      className="h-10 w-48"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Tasa de Impuesto (%)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={config.default_tax_rate ?? 19}
                        onChange={(e) => setConfig(prev => ({ ...prev, default_tax_rate: parseFloat(e.target.value) || 0 }))}
                        className="h-10 w-28 pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  Esta tasa se usa como valor por defecto en formularios de ventas y compras (IVA).
                </p>
              </Card>

              <Card className="p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-0 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                    <ChefHat className="w-5 h-5 text-white" />
                  </div>
                  <div>
                   <Label className="text-gray-900 font-semibold">Zonas de Preparación</Label>
                   <p className="text-xs text-gray-500">Dónde se preparan los productos</p>
                  </div>
                  </div>
                  <div className="mb-3 p-2.5 bg-amber-100/60 rounded-lg border border-amber-200/80">
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                   <span className="font-semibold">💡 Estas zonas también se usan como áreas de inventario.</span> Cada insumo se asigna a una zona de preparación para organizar los conteos de stock, las mermas y el control diario por área. Asegúrate de que reflejen las áreas reales donde almacenas y usas tus insumos.
                  </p>
                  </div>
                  <ListConfigSection
                  items={config.preparation_zones || []}
                  onAdd={(v) => addToList('preparation_zones', v)}
                  onRemove={(v) => removeFromList('preparation_zones', v)}
                  placeholder="Nueva zona..."
                  color="bg-amber-100 text-amber-700"
                  emptyText="Sin zonas"
                />
              </Card>

              <Card className="p-5 bg-gradient-to-br from-emerald-50 to-green-50 border-0 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-900 font-semibold">Salas del Local</Label>
                    <p className="text-xs text-gray-500">Áreas de atención al cliente</p>
                  </div>
                </div>
                {/* Sugerir salas encontradas en ventas */}
                {(() => {
                  const currentRooms = config.rooms || [];
                  const salesRooms = [...new Set(
                    sales
                      .filter(s => s.restaurant_id === restaurant?.id && s.room)
                      .map(s => s.room.trim())
                      .filter(r => r && !currentRooms.some(cr => cr.toLowerCase() === r.toLowerCase()))
                  )];
                  if (salesRooms.length === 0) return null;
                  return (
                    <div className="mb-3 p-2.5 bg-emerald-100/50 rounded-lg border border-emerald-200">
                      <p className="text-[10px] text-emerald-600 font-medium mb-1.5">Salas detectadas en tus ventas:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {salesRooms.map(r => (
                          <button
                            key={r}
                            onClick={() => addToList('rooms', r)}
                            className="text-xs bg-white border border-emerald-200 text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-50 transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <ListConfigSection
                  items={config.rooms || []}
                  onAdd={(v) => addToList('rooms', v)}
                  onRemove={(v) => removeFromList('rooms', v)}
                  placeholder="Nueva sala..."
                  color="bg-emerald-100 text-emerald-700"
                  emptyText="Sin salas"
                />
              </Card>

              <Card className="p-5 bg-gradient-to-br from-violet-50 to-purple-50 border-0 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-900 font-semibold">Métodos de Pago</Label>
                    <p className="text-xs text-gray-500">Medios de pago aceptados en tu local</p>
                  </div>
                </div>
                {/* Sugerir métodos encontrados en ventas */}
                {(() => {
                  const currentMethods = config.payment_methods || [];
                  const salesMethods = [...new Set(
                    sales
                      .filter(s => s.restaurant_id === restaurant?.id && s.payment_method)
                      .map(s => s.payment_method.trim())
                      .filter(m => m && m !== 'otro' && !currentMethods.some(cm => cm.toLowerCase() === m.toLowerCase()))
                  )];
                  if (salesMethods.length === 0) return null;
                  return (
                    <div className="mb-3 p-2.5 bg-violet-100/50 rounded-lg border border-violet-200">
                      <p className="text-[10px] text-violet-600 font-medium mb-1.5">Métodos detectados en tus ventas:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {salesMethods.map(m => (
                          <button
                            key={m}
                            onClick={() => addToList('payment_methods', m)}
                            className="text-xs bg-white border border-violet-200 text-violet-700 px-2 py-1 rounded-md hover:bg-violet-50 transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <ListConfigSection
                  items={config.payment_methods || []}
                  onAdd={(v) => addToList('payment_methods', v)}
                  onRemove={(v) => removeFromList('payment_methods', v)}
                  placeholder="Nuevo método de pago..."
                  color="bg-violet-100 text-violet-700"
                  emptyText="Sin métodos de pago"
                />
              </Card>

              <Card className="p-5 bg-gradient-to-br from-rose-50 to-pink-50 border-0 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-900 font-semibold">Categorías de Recetas</Label>
                    <p className="text-xs text-gray-500">Clasificación para tus platos y recetas</p>
                  </div>
                </div>
                <ListConfigSection
                  items={config.recipe_categories || []}
                  onAdd={(v) => addToList('recipe_categories', v)}
                  onRemove={(v) => removeFromList('recipe_categories', v)}
                  placeholder="Nueva categoría de receta..."
                  color="bg-rose-100 text-rose-700"
                  emptyText="Sin categorías"
                />
              </Card>

            </TabsContent>

            {/* TAB: INSUMOS */}
            <TabsContent value="supplies" className="mt-0 space-y-6">
              <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-900 font-semibold">Categorías de Insumos</Label>
                    <p className="text-xs text-gray-500">Clasifica cada categoría: Food Cost o Centro de Costo</p>
                  </div>
                </div>
                <div className="mb-3 p-2.5 bg-green-100/60 rounded-lg border border-green-200/80">
                  <p className="text-[11px] text-green-800 leading-relaxed">
                    <span className="font-semibold">💡 Destino contable por categoría.</span> Las categorías marcadas como "Food Cost" van al Costo de Ventas. Las que se asignan a un Centro de Costo van como gasto operativo (OPEX) en el Estado de Resultados.
                  </p>
                </div>
                <SupplyCategoryClassifier
                  categories={config.supply_categories || []}
                  costCenters={(config.cost_centers || []).filter(c => c.type === 'opex')}
                  onUpdate={(updated) => setConfig(prev => ({ ...prev, supply_categories: updated }))}
                />
              </Card>
            </TabsContent>

            {/* TAB: COSTOS */}
            <TabsContent value="costs" className="mt-0 space-y-6">
              {/* Centros de Costo */}
              <Card className="p-5 bg-gradient-to-br from-purple-50 to-violet-50 border-0 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <Label className="text-gray-900 font-semibold">Centros de Costo</Label>
                      <p className="text-xs text-gray-500">Gastos operativos (OPEX) de tu restaurante</p>
                    </div>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700">
                    {(config.cost_centers || []).length}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto pr-1">
                  {(config.cost_centers || []).map((center) => {
                    const isSysCenter = isSystemCostCenter(center.name);
                    const isEditing = editingCenterCategories === center.name;
                    const centerCategories = center.categories || [];
                    
                    let bgColor, borderColor, badgeColor, typeBadge;
                    if (center.type === 'supply') {
                      bgColor = 'bg-emerald-50';
                      borderColor = 'border-emerald-200';
                      badgeColor = 'bg-emerald-500';
                      typeBadge = { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Food Cost' };
                    } else {
                      bgColor = 'bg-amber-50';
                      borderColor = 'border-amber-200';
                      badgeColor = 'bg-amber-500';
                      typeBadge = { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Gasto Operativo' };
                    }
                    
                    return (
                      <div 
                        key={center.name} 
                        className={`p-3 rounded-xl border ${bgColor} ${borderColor}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${badgeColor} text-white`}>
                              {center.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 text-sm">{center.name}</p>
                                <Badge className={`${typeBadge.bg} ${typeBadge.text} text-[10px] px-1.5 py-0 border-0`}>
                                  {typeBadge.label}
                                </Badge>
                                {isSysCenter && (
                                  <Badge className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0 border-0 flex items-center gap-0.5">
                                    <Lock className="w-2.5 h-2.5" /> Sistema
                                  </Badge>
                                )}
                              </div>
                              {center.description && (
                                <p className="text-xs text-gray-500">{center.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {center.type === 'opex' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingCenterCategories(isEditing ? null : center.name)}
                                className="text-xs h-7 px-2 text-purple-600 hover:bg-purple-50"
                              >
                                <Tag className="w-3 h-3 mr-1" />
                                {centerCategories.length > 0 ? `${centerCategories.length} categ.` : 'Categorías'}
                              </Button>
                            )}
                            {!isSysCenter && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveCostCenter(center.name)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Subcategorías del centro de costo */}
                        {centerCategories.length > 0 && !isEditing && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {centerCategories.map((cat) => (
                              <Badge key={cat} variant="outline" className="text-[10px] bg-white/80 border-gray-200 text-gray-600">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Editor de categorías expandido */}
                        {isEditing && (
                          <div className="mt-3 pt-3 border-t border-gray-200/50 space-y-2">
                            <p className="text-xs font-medium text-purple-700">Categorías de {center.name}:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {centerCategories.map((cat) => (
                                <Badge key={cat} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 bg-purple-100 text-purple-700 border-0">
                                  <span className="text-xs">{cat}</span>
                                  <button
                                    onClick={() => handleRemoveCenterCategory(center.name, cat)}
                                    className="hover:bg-purple-200 rounded-full p-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Input
                                value={newCategoryValue}
                                onChange={(e) => setNewCategoryValue(e.target.value)}
                                placeholder="Nueva categoría..."
                                className="flex-1 h-8 text-xs"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddCenterCategory(center.name)}
                              />
                              <Button onClick={() => handleAddCenterCategory(center.name)} size="sm" className="h-8 px-3 bg-purple-600 hover:bg-purple-700">
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 pt-3 border-t border-purple-200">
                  <p className="text-xs text-gray-500">Agregar nuevo centro de costo (Gasto Operativo):</p>
                  <div className="flex gap-2">
                    <Input
                      value={newCostCenter.name}
                      onChange={(e) => setNewCostCenter(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nombre del centro (ej: LOGÍSTICA)"
                      className="flex-1 h-10"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCostCenter()}
                    />
                    <Button onClick={handleAddCostCenter} className="h-10 bg-purple-600 hover:bg-purple-700">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Después de agregar, haz clic en "Categorías" para definir las subcategorías del centro.
                  </p>
                </div>
              </Card>
            </TabsContent>

            {/* TAB: PROVEEDORES */}
            <TabsContent value="suppliers" className="mt-0">
              <SupplierTab
                suppliers={suppliers}
                supplyCategories={config.supply_categories || []}
                costCenters={config.cost_centers || []}
                onAdd={(data) => onAddSupplier?.({ ...data, restaurant_id: restaurant?.id })}
                onUpdate={(id, data) => onUpdateSupplier?.(id, data)}
                onDelete={(id) => onDeleteSupplier?.(id)}
                onImport={() => setSupplierImportOpen(true)}
                isLoading={isSaving}
              />
              <SupplierImportDialog
                open={supplierImportOpen}
                onOpenChange={setSupplierImportOpen}
                restaurantId={restaurant?.id}
                rawSupplyCategories={config.supply_categories || []}
                costCenters={config.cost_centers || []}
                onSuccess={(suppliersData) => onBulkCreateSuppliers?.(suppliersData)}
              />
            </TabsContent>

            {/* TAB: INTEGRACIONES */}
            <TabsContent value="integrations" className="mt-0 space-y-6">
              <FudoConfigSection restaurant={restaurant} onUpdate={() => {}} />
              <EbillConfigSection restaurant={restaurant} onUpdate={() => {}} />
            </TabsContent>

            {/* TAB: EQUIPO */}
            <TabsContent value="team" className="mt-0 space-y-6">
              {/* Áreas del equipo */}
              <Card className="p-5 bg-gradient-to-br from-teal-50 to-cyan-50 border-0 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-900 font-semibold">Áreas del Equipo</Label>
                    <p className="text-xs text-gray-500">Define las áreas de tu restaurante para clasificar empleados</p>
                  </div>
                </div>
                <ListConfigSection
                  items={config.employee_areas || []}
                  onAdd={(v) => addToList('employee_areas', v)}
                  onRemove={(v) => removeFromList('employee_areas', v)}
                  placeholder="Nueva área (ej: Cocina, Garzones, Admin...)"
                  color="bg-teal-100 text-teal-700"
                  emptyText="Agrega al menos un área"
                />
              </Card>

              {/* Lista de empleados */}
              <EmployeeManager
                employees={config.employees || []}
                areas={config.employee_areas || []}
                onChange={(updated) => setConfig(prev => ({ ...prev, employees: updated }))}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-gray-50/50">
          <Button 
            variant="ghost" 
            onClick={handleLoadDefaults}
            className="text-gray-500 mr-auto"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gray-900 hover:bg-gray-800"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Guardar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}