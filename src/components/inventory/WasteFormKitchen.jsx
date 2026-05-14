import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Check, Search, X, Package,
  ChefHat, Coffee, UtensilsCrossed, Soup
} from "lucide-react";
import { formatCurrency } from '@/components/utils/currencyHelper';
import { getTodayInUserTz } from '@/components/utils/timezoneHelper';

// Íconos por nombre de área
const AREA_ICONS = {
  'Cocina': ChefHat,
  'Barra': Coffee,
  'Salón': UtensilsCrossed,
  'Pastelería': Soup,
};

const AREA_COLORS = [
  'from-orange-500 to-red-500',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-violet-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-yellow-600',
];

const REASONS = [
  { key: 'vencimiento', label: 'Vencido', emoji: '📅', color: 'from-amber-400 to-amber-600' },
  { key: 'daño', label: 'Dañado', emoji: '💥', color: 'from-red-400 to-red-600' },
  { key: 'contaminacion', label: 'Contaminado', emoji: '☣️', color: 'from-purple-400 to-purple-600' },
  { key: 'preparacion', label: 'Preparación', emoji: '🔪', color: 'from-blue-400 to-blue-600' },
  { key: 'otro', label: 'Otro', emoji: '📋', color: 'from-gray-400 to-gray-600' },
];

const STEP_TITLES = {
  1: '¿En qué área estás?',
  2: '¿Qué categoría?',
  3: 'Selecciona el insumo',
  4: '¿Cuánto se perdió?',
  5: '¿Por qué se perdió?',
  6: 'Confirmar registro',
};

function NumPad({ value, unit, onValueChange, onConfirm }) {
  const handleKey = (key) => {
    if (key === 'del') {
      onValueChange(value.slice(0, -1));
    } else if (key === '.' && value.includes('.')) {
      return;
    } else {
      onValueChange(value + key);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-gray-900 rounded-2xl p-4 text-center">
        <p className="text-5xl font-black text-white tracking-tight">
          {value || '0'}
        </p>
        <p className="text-gray-400 text-sm mt-1">{unit}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1','2','3','4','5','6','7','8','9','.','0','del'].map((key) => (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => handleKey(key)}
            className={`h-14 rounded-xl text-xl font-bold transition-all active:scale-95 ${
              key === 'del'
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {key === 'del' ? '⌫' : key}
          </motion.button>
        ))}
      </div>
      <Button
        type="button"
        onClick={onConfirm}
        disabled={!value || parseFloat(value) <= 0}
        className="w-full h-14 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-lg font-bold shadow-lg"
      >
        <Check className="w-5 h-5 mr-2" /> Confirmar
      </Button>
    </div>
  );
}

export default function WasteFormKitchen({
  open,
  onOpenChange,
  supplyItems = [],
  currency = 'CLP',
  selectedRestaurant = '',
  restaurants = [],
  user,
  onSubmit,
  isLoading = false
}) {
  const [step, setStep] = useState(1);
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSupply, setSelectedSupply] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const TOTAL_STEPS = 6;

  // Get areas from the selected restaurant's config.preparation_zones
  const areas = useMemo(() => {
    const rest = restaurants.find(r => r.id === selectedRestaurant);
    return rest?.config?.preparation_zones || [];
  }, [restaurants, selectedRestaurant]);

  // Items in selected area
  const itemsInArea = useMemo(() => {
    if (!selectedArea) return [];
    return supplyItems.filter(s => s.area === selectedArea);
  }, [supplyItems, selectedArea]);

  // Categories within selected area (unique, sorted)
  const categoriesInArea = useMemo(() => {
    const cats = {};
    itemsInArea.forEach(s => {
      const cat = s.category || 'Otros';
      if (!cats[cat]) cats[cat] = 0;
      cats[cat]++;
    });
    return Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [itemsInArea]);

  // Items in selected category, sorted alphabetically
  const itemsInCategory = useMemo(() => {
    let items = itemsInArea.filter(s => (s.category || 'Otros') === selectedCategory);
    if (searchFilter) {
      items = items.filter(s => s.name?.toLowerCase().includes(searchFilter.toLowerCase()));
    }
    return items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [itemsInArea, selectedCategory, searchFilter]);

  const reset = () => {
    setStep(1);
    setSelectedArea(null);
    setSelectedCategory(null);
    setSelectedSupply(null);
    setQuantity('');
    setReason('');
    setSearchFilter('');
    setShowSuccess(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleSubmit = () => {
    const todayStr = getTodayInUserTz(user);
    const qty = parseFloat(quantity) || 0;
    onSubmit({
      restaurant_id: selectedSupply.restaurant_id || selectedRestaurant,
      date: todayStr,
      supply_name: selectedSupply.name,
      supply_id: selectedSupply.id,
      quantity: qty,
      unit: selectedSupply.unit_of_measure || 'kg',
      reason,
      notes: '',
      estimated_value: qty * (selectedSupply.average_unit_cost || 0),
    });
    setShowSuccess(true);
    setTimeout(() => handleClose(), 1500);
  };

  const estimatedValue = selectedSupply && quantity
    ? (parseFloat(quantity) || 0) * (selectedSupply.average_unit_cost || 0)
    : 0;

  const stepAnim = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
    transition: { duration: 0.2 }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[95vh] gap-0">
        {/* Success overlay */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-gradient-to-br from-green-500 to-emerald-600 flex flex-col items-center justify-center"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-12 h-12 text-white" />
                </div>
              </motion.div>
              <p className="text-2xl font-bold text-white">¡Merma registrada!</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step > 1 && !showSuccess && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  type="button"
                  onClick={() => {
                    if (step === 3) setSearchFilter('');
                    setStep(s => s - 1);
                  }}
                  className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </motion.button>
              )}
              <div>
                <h3 className="text-lg font-bold text-white">Registrar Merma</h3>
                <p className="text-orange-100 text-xs">{STEP_TITLES[step]}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${i + 1 <= step ? 'bg-white' : 'bg-white/30'}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 80px)' }}>
          <AnimatePresence mode="wait">

            {/* STEP 1: Area */}
            {step === 1 && (
              <motion.div key="step1" {...stepAnim} className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {areas.map((area, idx) => {
                    const Icon = AREA_ICONS[area] || Package;
                    const colorClass = AREA_COLORS[idx % AREA_COLORS.length];
                    const count = supplyItems.filter(s => s.area === area).length;
                    return (
                      <motion.button
                        key={area}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => { setSelectedArea(area); setStep(2); }}
                        className={`flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r ${colorClass} text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.98]`}
                      >
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-xl font-bold">{area}</p>
                          <p className="text-white/70 text-sm">{count} insumos</p>
                        </div>
                      </motion.button>
                    );
                  })}
                  {areas.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No hay áreas configuradas</p>
                      <p className="text-xs mt-1">Configura zonas de preparación en tu restaurante</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Category */}
            {step === 2 && (
              <motion.div key="step2" {...stepAnim} className="space-y-3">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                  <span className="font-semibold text-gray-600">{selectedArea}</span>
                  <span>→</span>
                  <span>Categoría</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {categoriesInArea.map(([cat, count]) => (
                    <motion.button
                      key={cat}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setStep(3); }}
                      className="p-4 bg-white border-2 border-gray-100 rounded-2xl text-left hover:border-orange-300 hover:shadow-lg transition-all active:bg-orange-50"
                    >
                      <p className="font-bold text-sm text-gray-900">{cat}</p>
                      <p className="text-xs text-gray-400 mt-1">{count} insumos</p>
                    </motion.button>
                  ))}
                  {categoriesInArea.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-gray-400">
                      <p className="text-sm">No hay insumos en esta área</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: Select supply (alphabetical) */}
            {step === 3 && (
              <motion.div key="step3" {...stepAnim} className="space-y-3">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                  <span className="font-semibold text-gray-600">{selectedArea}</span>
                  <span>→</span>
                  <span className="font-semibold text-gray-600">{selectedCategory}</span>
                  <span>→</span>
                  <span>Insumo</span>
                </div>

                {/* Search */}
                {itemsInCategory.length > 8 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      inputMode="search"
                      placeholder="Buscar..."
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      className="w-full pl-10 pr-10 h-11 rounded-xl bg-gray-100 border-0 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
                    />
                    {searchFilter && (
                      <button onClick={() => setSearchFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pb-2">
                  {itemsInCategory.map((supply) => (
                    <motion.button
                      key={supply.id}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={() => { setSelectedSupply(supply); setStep(4); }}
                      className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl text-left hover:border-orange-300 hover:shadow-md transition-all active:bg-orange-50"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{supply.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Stock: {supply.current_stock ?? 0} {supply.unit_of_measure}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs border-gray-200 text-gray-500 shrink-0">
                        {supply.unit_of_measure}
                      </Badge>
                    </motion.button>
                  ))}
                  {itemsInCategory.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No se encontraron insumos</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 4: Quantity */}
            {step === 4 && (
              <motion.div key="step4" {...stepAnim}>
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-gray-400 px-1 mb-3 flex-wrap">
                  <span className="text-gray-500">{selectedArea}</span>
                  <span>→</span>
                  <span className="text-gray-500">{selectedCategory}</span>
                  <span>→</span>
                  <span className="font-bold text-gray-700">{selectedSupply?.name}</span>
                </div>
                <NumPad
                  value={quantity}
                  unit={selectedSupply?.unit_of_measure || 'kg'}
                  onValueChange={setQuantity}
                  onConfirm={() => setStep(5)}
                />
              </motion.div>
            )}

            {/* STEP 5: Reason */}
            {step === 5 && (
              <motion.div key="step5" {...stepAnim} className="space-y-3">
                <p className="text-center text-sm text-gray-500 font-medium">¿Por qué se perdió?</p>
                <div className="grid grid-cols-1 gap-3">
                  {REASONS.map((r) => (
                    <motion.button
                      key={r.key}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => { setReason(r.key); setStep(6); }}
                      className={`flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r ${r.color} text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.98]`}
                    >
                      <span className="text-3xl">{r.emoji}</span>
                      <span className="text-lg font-bold">{r.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 6: Confirm */}
            {step === 6 && (
              <motion.div key="step6" {...stepAnim} className="space-y-4">
                <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase">Área</span>
                    <span className="font-bold text-gray-900">{selectedArea}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase">Insumo</span>
                    <span className="font-bold text-gray-900">{selectedSupply?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase">Cantidad</span>
                    <span className="font-bold text-gray-900">{quantity} {selectedSupply?.unit_of_measure}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase">Motivo</span>
                    <Badge className={`bg-gradient-to-r ${REASONS.find(r => r.key === reason)?.color} text-white border-0 text-sm px-3 py-1`}>
                      {REASONS.find(r => r.key === reason)?.emoji} {REASONS.find(r => r.key === reason)?.label}
                    </Badge>
                  </div>
                  {estimatedValue > 0 && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="text-xs font-bold text-red-400 uppercase">Pérdida estimada</span>
                      <span className="text-xl font-black text-red-600">{formatCurrency(estimatedValue, currency)}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-14 rounded-xl text-base">
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="flex-1 h-14 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-base font-bold shadow-lg"
                  >
                    {isLoading ? 'Guardando...' : <><Check className="w-5 h-5 mr-2" /> Registrar</>}
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}