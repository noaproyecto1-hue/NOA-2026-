import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Package, MapPin, Save, Loader2, Search, X, ListChecks } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-8 h-9 text-sm rounded-xl"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function DailyCountConfigDialog({
  open,
  onOpenChange,
  restaurantId,
  supplyItems = []
}) {
  const [mode, setMode] = useState('categories');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [selectedSupplyIds, setSelectedSupplyIds] = useState([]);
  const [allowMultipleDaily, setAllowMultipleDaily] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [supplySearch, setSupplySearch] = useState('');
  const queryClient = useQueryClient();

  const items = useMemo(() => 
    supplyItems.filter(s => s.restaurant_id === restaurantId && s.is_active !== false),
    [supplyItems, restaurantId]
  );

  const categories = useMemo(() => 
    [...new Set(items.map(s => s.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [items]
  );

  const { data: restaurant } = useQuery({
    queryKey: ['restaurantForConfig', restaurantId],
    queryFn: async () => {
      const list = await base44.entities.Restaurant.filter({ id: restaurantId });
      return list[0] || null;
    },
    enabled: !!restaurantId && open
  });

  const preparationZones = restaurant?.config?.preparation_zones || [];

  const availableAreas = useMemo(() => {
    const fromItems = items.map(s => s.area).filter(Boolean);
    return [...new Set([...preparationZones, ...fromItems])].sort((a, b) => a.localeCompare(b, 'es'));
  }, [items, preparationZones]);

  const { data: existingConfig } = useQuery({
    queryKey: ['dailyCountConfig', restaurantId],
    queryFn: async () => {
      const configs = await base44.entities.DailyCountConfig.filter({ restaurant_id: restaurantId });
      return configs[0] || null;
    },
    enabled: !!restaurantId && open
  });

  useEffect(() => {
    if (existingConfig) {
      const m = existingConfig.mode === 'items' ? 'categories' : (existingConfig.mode || 'categories');
      setMode(m);
      setSelectedCategories(existingConfig.selected_categories || []);
      setSelectedAreas(existingConfig.selected_areas || []);
      setSelectedSupplyIds(existingConfig.selected_supply_ids || []);
      setAllowMultipleDaily(existingConfig.allow_multiple_daily || false);
    } else {
      setMode('categories');
      setSelectedCategories([]);
      setSelectedAreas([]);
      setSelectedSupplyIds([]);
      setAllowMultipleDaily(false);
    }
    setCatSearch('');
    setAreaSearch('');
    setSupplySearch('');
  }, [existingConfig, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        restaurant_id: restaurantId,
        mode,
        selected_categories: mode === 'categories' ? selectedCategories : [],
        selected_areas: mode === 'areas' ? selectedAreas : [],
        selected_supply_ids: mode === 'supplies' ? selectedSupplyIds : [],
        allow_multiple_daily: allowMultipleDaily,
        is_active: true
      };
      if (existingConfig?.id) {
        await base44.entities.DailyCountConfig.update(existingConfig.id, data);
      } else {
        await base44.entities.DailyCountConfig.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyCountConfig'] });
      onOpenChange(false);
    }
  });

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleArea = (area) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const toggleSupply = (id) => {
    setSelectedSupplyIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectedCount = mode === 'categories'
    ? items.filter(i => selectedCategories.includes(i.category)).length
    : mode === 'areas'
    ? items.filter(i => selectedAreas.includes(i.area)).length
    : selectedSupplyIds.length;

  // Filtered lists
  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const q = catSearch.toLowerCase();
    return categories.filter(c => c.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const filteredAreas = useMemo(() => {
    if (!areaSearch.trim()) return availableAreas;
    const q = areaSearch.toLowerCase();
    return availableAreas.filter(a => a.toLowerCase().includes(q));
  }, [availableAreas, areaSearch]);

  const filteredSupplies = useMemo(() => {
    if (!supplySearch.trim()) return items;
    const q = supplySearch.toLowerCase();
    return items.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.category || '').toLowerCase().includes(q)
    );
  }, [items, supplySearch]);

  // Group supplies by category for display
  const suppliesByCategory = useMemo(() => {
    const grouped = {};
    filteredSupplies.forEach(s => {
      const cat = s.category || 'Sin categoría';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [filteredSupplies]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Configurar Conteo Diario
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mt-2">
            Selecciona qué insumos se contarán en el conteo diario — por categoría, por área/zona, o por insumos individuales.
          </p>
        </div>

        <div className="flex-1 min-h-0 px-6">
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="categories" className="gap-1.5 text-xs">
                <Package className="w-3.5 h-3.5" /> Categoría
              </TabsTrigger>
              <TabsTrigger value="areas" className="gap-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5" /> Área
              </TabsTrigger>
              <TabsTrigger value="supplies" className="gap-1.5 text-xs">
                <ListChecks className="w-3.5 h-3.5" /> Insumos
              </TabsTrigger>
            </TabsList>

            {/* CATEGORÍAS */}
            <TabsContent value="categories" className="mt-3">
              <SearchInput value={catSearch} onChange={setCatSearch} placeholder="Buscar categoría..." />
              <ScrollArea className="h-[340px] pr-2">
                <div className="space-y-1.5">
                  {filteredCategories.length > 0 ? filteredCategories.map(cat => {
                    const catCount = items.filter(i => i.category === cat).length;
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <div
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-300 bg-blue-50 shadow-sm' 
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} />
                          <span className="font-medium text-gray-800 text-sm">{cat}</span>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">{catCount} insumos</Badge>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-gray-400 text-center py-8">
                      {catSearch ? 'Sin resultados' : 'No hay categorías configuradas'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ÁREAS */}
            <TabsContent value="areas" className="mt-3">
              <SearchInput value={areaSearch} onChange={setAreaSearch} placeholder="Buscar área..." />
              <ScrollArea className="h-[340px] pr-2">
                <div className="space-y-1.5">
                  {filteredAreas.length > 0 ? filteredAreas.map(area => {
                    const areaCount = items.filter(i => i.area === area).length;
                    const isSelected = selectedAreas.includes(area);
                    return (
                      <div
                        key={area}
                        onClick={() => toggleArea(area)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-indigo-300 bg-indigo-50 shadow-sm' 
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} />
                          <span className="font-medium text-gray-800 text-sm">{area}</span>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">{areaCount} insumos</Badge>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8">
                      <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">{areaSearch ? 'Sin resultados' : 'No hay áreas disponibles'}</p>
                      {!areaSearch && <p className="text-xs text-gray-400 mt-1">Configura Zonas de Preparación en Restaurantes y asigna áreas a tus insumos</p>}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* INSUMOS INDIVIDUALES */}
            <TabsContent value="supplies" className="mt-3">
              <SearchInput value={supplySearch} onChange={setSupplySearch} placeholder="Buscar insumo por nombre o categoría..." />
              <ScrollArea className="h-[340px] pr-2">
                <div className="space-y-3">
                  {suppliesByCategory.length > 0 ? suppliesByCategory.map(([cat, supplies]) => {
                    const allSelected = supplies.every(s => selectedSupplyIds.includes(s.id));
                    const someSelected = supplies.some(s => selectedSupplyIds.includes(s.id));
                    
                    const toggleCatSupplies = () => {
                      if (allSelected) {
                        setSelectedSupplyIds(prev => prev.filter(id => !supplies.find(s => s.id === id)));
                      } else {
                        const newIds = supplies.map(s => s.id).filter(id => !selectedSupplyIds.includes(id));
                        setSelectedSupplyIds(prev => [...prev, ...newIds]);
                      }
                    };

                    return (
                      <div key={cat}>
                        <button 
                          onClick={toggleCatSupplies}
                          className="flex items-center gap-2 mb-1 px-1 hover:opacity-70 transition-opacity w-full text-left"
                        >
                          <Checkbox checked={allSelected} className={someSelected && !allSelected ? 'opacity-50' : ''} />
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{cat}</span>
                          <Badge variant="secondary" className="text-[10px] ml-auto">{supplies.length}</Badge>
                        </button>
                        <div className="space-y-1 ml-1">
                          {supplies.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es')).map(supply => {
                            const isSelected = selectedSupplyIds.includes(supply.id);
                            return (
                              <div
                                key={supply.id}
                                onClick={() => toggleSupply(supply.id)}
                                className={`flex items-center justify-between py-2 px-3 rounded-lg border cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'border-emerald-300 bg-emerald-50' 
                                    : 'border-gray-100 bg-white hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Checkbox checked={isSelected} />
                                  <span className="text-sm text-gray-800">{supply.name}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">{supply.unit_of_measure}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-gray-400 text-center py-8">
                      {supplySearch ? 'Sin resultados' : 'No hay insumos disponibles'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <div className="px-6 pb-5 pt-3 space-y-3 border-t border-gray-100 mt-3">
          {/* Opción: permitir múltiples conteos al día */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">Permitir varios conteos al día</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {allowMultipleDaily 
                  ? 'El staff puede realizar conteos varias veces al día' 
                  : 'Solo se permite un conteo diario por local'}
              </p>
            </div>
            <Switch
              checked={allowMultipleDaily}
              onCheckedChange={setAllowMultipleDaily}
            />
          </div>

          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-sm text-blue-700 font-medium">
              {selectedCount > 0 
                ? `✓ ${selectedCount} insumos serán contados en el conteo diario`
                : 'Selecciona al menos una categoría, área o insumo'
              }
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={selectedCount === 0 || saveMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Configuración
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}