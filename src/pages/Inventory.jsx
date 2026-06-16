import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
// xlsx import removed — not used directly in this file
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Package,
  AlertTriangle,
  Plus,
  ClipboardCheck,
  Search,
  Edit,
  Trash2,
  TrendingDown,
  History,
  Carrot,
  DollarSign,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Truck,
  Download,
  Settings
} from "lucide-react";
import {
  Select as SelectUI,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RestaurantSelector from '../components/dashboard/RestaurantSelector';
import RefreshButton from '@/components/ui/RefreshButton';
import SupplyItemForm from '../components/inventory/SupplyItemForm';

import SupplyImportDialog from '../components/import/SupplyImportDialog';
import SelectRestaurantDialog from '../components/dialogs/SelectRestaurantDialog';

import { getSelectedCurrency, formatCurrency } from '../components/utils/currencyHelper';
import { getCostTypeLabel, normalizeSupplyCategories, getCategoryNames } from '../components/utils/supplyCategoryHelper';
import { formatDateInUserTz } from '../components/utils/timezoneHelper';
import SuccessOverlay from '../components/ui/SuccessOverlay';
// StockAlertGenerator removed — stock alerts are now generated exclusively by the backend (runScheduledAlertAnalysis every 3h)
import SupplierSearchInput from '@/components/suppliers/SupplierSearchInput';
import WarehouseTransferDialog from '@/components/inventory/WarehouseTransferDialog';
import SupplierHistoryTab from '@/components/inventory/SupplierHistoryTab';
import LossesPanel from '@/components/inventory/LossesPanel';
import WastePanel from '@/components/inventory/WastePanel';
import DeviationPanel from '@/components/inventory/DeviationPanel';
import PriceIncreasePanel from '@/components/inventory/PriceIncreasePanel';
import LossDiagnosticPanel from '@/components/inventory/LossDiagnosticPanel';
import InventoryCountsPanel from '@/components/inventory/InventoryCountsPanel';
import RestaurantPickerOnEntry from '@/components/dialogs/RestaurantPickerOnEntry';
import StockExportDialog from '@/components/inventory/StockExportDialog';
import IdealStockConfigModal from '@/components/inventory/IdealStockConfigModal';
import BulkDeleteBar from '@/components/data/BulkDeleteBar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DailyCountConfigDialog from '@/components/inventory/DailyCountConfigDialog';
import CountTypeSelector from '@/components/inventory/CountTypeSelector';
import InventoryCountWizard from '@/components/inventory/InventoryCountWizard';
import MovementDateFilter, { getDateRangeFromFilter } from '@/components/inventory/MovementDateFilter';

const unitLabels = {
  kg: 'Kilogramos',
  g: 'Gramos',
  L: 'Litros',
  ml: 'Mililitros',
  unidad: 'Unidades',
  docena: 'Docenas',
  lb: 'Libras',
  oz: 'Onzas',
  paquete: 'Paquetes',
  caja: 'Cajas'
};

// Función para determinar el estado de stock
const getStockStatus = (current, min, warning) => {
  if (current <= 0) return 'critical'; // Stock 0 o negativo siempre es crítico
  if (min > 0 && current <= min) return 'critical'; // Rojo
  if (warning > 0 && current <= warning) return 'warning'; // Naranja
  return 'ok'; // Verde
};

export default function Inventory() {
  const [selectedRestaurant, setSelectedRestaurant] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');


  const [showImportDialog, setShowImportDialog] = useState(false);


  const [selectRestaurantDialog, setSelectRestaurantDialog] = useState({ open: false, action: null });
  const [targetRestaurantId, setTargetRestaurantId] = useState(null);
  const [showSupplyDialog, setShowSupplyDialog] = useState(false);
  const [editingSupply, setEditingSupply] = useState(null);
  const [supplySearchTerm, setSupplySearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterArea, setFilterArea] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');

  const [supplySortConfig, setSupplySortConfig] = useState({ key: 'name', direction: 'asc' });

  const [supplyPage, setSupplyPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [successOverlay, setSuccessOverlay] = useState({ open: false, title: '', message: '' });
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [controlSubTab, setControlSubTab] = useState('diagnostic');
  const [showStockExportDialog, setShowStockExportDialog] = useState(false);
  const [showIdealStockConfig, setShowIdealStockConfig] = useState(false);
  const [showDailyCountConfig, setShowDailyCountConfig] = useState(false);
  const [showCountTypeSelector, setShowCountTypeSelector] = useState(false);
  const [showCountWizard, setShowCountWizard] = useState(false);
  const [movementFilter, setMovementFilter] = useState('all');
  const [movementDateFilter, setMovementDateFilter] = useState({ preset: 'week' });
  const [movementPage, setMovementPage] = useState(0);
  const movementPageSize = 20;
  const [countWizardType, setCountWizardType] = useState(null);
  const [idealStockPercent, setIdealStockPercent] = useState(null);
  const [selectedSupplyIds, setSelectedSupplyIds] = useState([]);
  const [confirmDeleteState, setConfirmDeleteState] = useState({ open: false, ids: [], count: 0 });
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const isStaff = user?.app_role === 'staff';
  const isManager = user?.role === 'admin' || user?.app_role === 'manager';

  // Filtrar restaurantes por usuario
  // Managers: traer los que crearon
  // Staff: traer todos y filtrar por restaurant_ids asignados
  const { data: restaurants = [] } = useQuery({
    queryKey: ['myRestaurants', user?.email, user?.app_role, user?.restaurant_ids],
    queryFn: async () => {
      // Si tiene restaurant_ids asignados, usar SOLO esos
      if (user?.restaurant_ids?.length > 0) {
        const allRestaurants = await base44.entities.Restaurant.filter({ is_active: true });
        return allRestaurants.filter(r => user.restaurant_ids.includes(r.id));
      }
      // Si no, buscar por created_by (propietario)
      return base44.entities.Restaurant.filter({ is_active: true, created_by: user?.email });
    },
    enabled: !!user?.email
  });

  // Los restaurantes ya vienen filtrados correctamente
  const accessibleRestaurants = restaurants;

  // IDs de restaurantes accesibles
  const accessibleRestaurantIds = useMemo(() => {
    return accessibleRestaurants.map(r => r.id);
  }, [accessibleRestaurants]);

  // Helper: fetch per-restaurant and merge (avoids fetching ALL records and filtering in frontend)
  const fetchByRestaurant = async (entity, sortOrFilter, limit) => {
    if (accessibleRestaurantIds.length === 0) return [];
    const results = await Promise.all(
      accessibleRestaurantIds.map(id => {
        if (typeof sortOrFilter === 'string') {
          // sort string provided
          return entity.filter({ restaurant_id: id }, sortOrFilter, limit);
        }
        // filter object provided
        return entity.filter({ restaurant_id: id, ...sortOrFilter });
      })
    );
    return results.flat();
  };

  const { data: inventoryCounts = [] } = useQuery({
    queryKey: ['inventoryCounts', accessibleRestaurantIds],
    queryFn: () => fetchByRestaurant(base44.entities.InventoryCount, '-date', 500),
    enabled: accessibleRestaurantIds.length > 0
  });

  const { data: supplyItems = [] } = useQuery({
    queryKey: ['supplyItems', accessibleRestaurantIds],
    queryFn: () => fetchByRestaurant(base44.entities.SupplyItem, { is_active: true }),
    enabled: accessibleRestaurantIds.length > 0
  });

  // Proveedores
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', accessibleRestaurantIds],
    queryFn: () => fetchByRestaurant(base44.entities.Supplier, { is_active: true }),
    enabled: accessibleRestaurantIds.length > 0
  });

  const { data: stockMovements = [] } = useQuery({
    queryKey: ['stockMovements', accessibleRestaurantIds],
    queryFn: () => fetchByRestaurant(base44.entities.StockMovement, '-created_date', 200),
    enabled: accessibleRestaurantIds.length > 0
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', accessibleRestaurantIds],
    queryFn: () => fetchByRestaurant(base44.entities.Alert, { is_resolved: false }),
    enabled: accessibleRestaurantIds.length > 0
  });

  // Supply costs para análisis de precios y pérdidas
  const { data: supplyCostsData = [] } = useQuery({
    queryKey: ['supplyCostsInventory', accessibleRestaurantIds],
    queryFn: () => fetchByRestaurant(base44.entities.SupplyCost, '-date', 500),
    enabled: accessibleRestaurantIds.length > 0
  });

  // Recetas para análisis de desviación
  const { data: recipesData = [] } = useQuery({
    queryKey: ['recipesInventory', accessibleRestaurantIds],
    queryFn: () => fetchByRestaurant(base44.entities.Recipe, { is_active: true }),
    enabled: accessibleRestaurantIds.length > 0
  });

  // Registros de merma
  const { data: wasteRecords = [] } = useQuery({
    queryKey: ['wasteRecords', accessibleRestaurantIds],
    queryFn: () => fetchByRestaurant(base44.entities.RegistroMerma, '-date', 200),
    enabled: accessibleRestaurantIds.length > 0
  });

  // Muestreos de recetas para diagnóstico de desviación
  const { data: recipeSamplesData = [] } = useQuery({
    queryKey: ['recipeSamplesInventory', accessibleRestaurantIds],
    queryFn: () => fetchByRestaurant(base44.entities.RecipeSample, '-date', 500),
    enabled: accessibleRestaurantIds.length > 0
  });

  const userRestaurants = accessibleRestaurants;

  // Total de ventas acumuladas — usa getDashboardMetrics cache or simple Entity sum
  // Avoiding a direct BQ call from frontend to keep it simple — use cached dashboard data if available
  const { data: totalSalesFromBQ = 0 } = useQuery({
    queryKey: ['totalSalesForStock', accessibleRestaurantIds, selectedRestaurant],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return 0;
      // Simple approach: sum from entity with limit (good enough for stock ideal estimation)
      // For 2 restaurants this is ~5000 records max, which is acceptable
      const targetIds = selectedRestaurant !== 'all' ? [selectedRestaurant] : accessibleRestaurantIds;
      const results = await Promise.all(
        targetIds.map(id => base44.entities.Sale.filter({ restaurant_id: id, is_cancelled: false }, '-date_time', 2500))
      );
      return results.flat().reduce((sum, s) => sum + (s.total_amount || 0), 0);
    },
    enabled: accessibleRestaurantIds.length > 0,
    staleTime: 10 * 60 * 1000, // Cache 10 min — stock ideal doesn't change often
  });

  // Cargar el porcentaje ideal de stock desde la config del restaurante seleccionado
  // Usamos una ref para evitar que el useEffect sobreescriba el valor recién guardado
  const justSavedRef = React.useRef(false);
  
  useEffect(() => {
    if (justSavedRef.current) {
      justSavedRef.current = false;
      return;
    }
    if (userRestaurants.length > 0) {
      if (selectedRestaurant !== 'all') {
        const rest = userRestaurants.find(r => r.id === selectedRestaurant);
        setIdealStockPercent(rest?.config?.ideal_stock_percent || 10);
      } else {
        const percents = userRestaurants.map(r => r.config?.ideal_stock_percent || 10);
        const avg = percents.reduce((a, b) => a + b, 0) / percents.length;
        setIdealStockPercent(Math.round(avg * 10) / 10);
      }
    }
  }, [userRestaurants, selectedRestaurant]);

  const selectedCurrency = getSelectedCurrency(selectedRestaurant, userRestaurants);

  // Obtener configuración dinámica del restaurante seleccionado
  const getRestaurantConfig = () => {
    if (selectedRestaurant !== 'all') {
      const restaurant = userRestaurants.find(r => r.id === selectedRestaurant);
      return restaurant?.config || {};
    }
    // Si es "todos", combinar configuraciones únicas
    const allConfigs = userRestaurants.map(r => r.config).filter(Boolean);
    const allCats = allConfigs.flatMap(c => normalizeSupplyCategories(c.supply_categories || []));
    const uniqueCats = [];
    const seen = new Set();
    for (const cat of allCats) { if (!seen.has(cat.name)) { seen.add(cat.name); uniqueCats.push(cat); } }
    return {
      supply_categories: uniqueCats
    };
  };
  
  const restaurantConfig = getRestaurantConfig();
  
  // Categorías de suministros desde config (compatible con strings legacy y objetos nuevos)
  const rawSupplyCategories = restaurantConfig.supply_categories || [];
  const supplyCategories = getCategoryNames(rawSupplyCategories).length > 0
    ? getCategoryNames(rawSupplyCategories)
    : ['Verduras', 'Carnes', 'Lácteos', 'Pescados', 'Granos', 'Desechables', 'Limpieza'];

  // Filtrar conteos por restaurante
  const filteredCounts = useMemo(() => {
    return inventoryCounts.filter(count => 
      selectedRestaurant === 'all' || count.restaurant_id === selectedRestaurant
    );
  }, [inventoryCounts, selectedRestaurant]);

  // Categorías únicas de los insumos filtrados por restaurante
  const availableCategories = useMemo(() => {
    const items = supplyItems.filter(item => selectedRestaurant === 'all' || item.restaurant_id === selectedRestaurant);
    return [...new Set(items.map(s => s.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }, [supplyItems, selectedRestaurant]);

  // Áreas/Zonas únicas de los insumos filtrados por restaurante
  const availableAreas = useMemo(() => {
    const items = supplyItems.filter(item => selectedRestaurant === 'all' || item.restaurant_id === selectedRestaurant);
    return [...new Set(items.map(s => s.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }, [supplyItems, selectedRestaurant]);

  // Proveedores únicos de los insumos filtrados por restaurante
  const availableSuppliers = useMemo(() => {
    const items = supplyItems.filter(item => selectedRestaurant === 'all' || item.restaurant_id === selectedRestaurant);
    return [...new Set(items.map(s => s.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }, [supplyItems, selectedRestaurant]);

  // Filtrar insumos por restaurante, búsqueda, categoría y estado
  const filteredSupplyItems = useMemo(() => {
    let filtered = supplyItems.filter(item => {
      const matchRestaurant = selectedRestaurant === 'all' || item.restaurant_id === selectedRestaurant;
      const matchSearch = !supplySearchTerm || 
        item.name?.toLowerCase().includes(supplySearchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(supplySearchTerm.toLowerCase());
      const matchCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchArea = filterArea === 'all' || item.area === filterArea;
      const matchSupplier = filterSupplier === 'all' || item.supplier === filterSupplier;
      const matchStatus = filterStatus === 'all' || (() => {
        const status = getStockStatus(item.current_stock, item.min_stock, item.warning_stock);
        if (filterStatus === 'low') return status === 'critical' || status === 'warning';
        if (filterStatus === 'critical') return status === 'critical';
        if (filterStatus === 'warning') return status === 'warning';
        if (filterStatus === 'ok') return status === 'ok';
        return true;
      })();
      return matchRestaurant && matchSearch && matchCategory && matchArea && matchSupplier && matchStatus;
    });
    
    // Ordenar
    filtered.sort((a, b) => {
      const key = supplySortConfig.key;
      let aVal = a[key];
      let bVal = b[key];
      
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return supplySortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const comparison = String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' });
      return supplySortConfig.direction === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [supplyItems, selectedRestaurant, supplySearchTerm, supplySortConfig, filterCategory, filterArea, filterStatus, filterSupplier]);

  const lowStockSupplies = filteredSupplyItems.filter(item => 
    (item.min_stock > 0 && item.current_stock <= item.min_stock) ||
    (item.warning_stock > 0 && item.current_stock <= item.warning_stock)
  );

  const criticalStockSupplies = filteredSupplyItems.filter(item => 
    item.min_stock > 0 && item.current_stock <= item.min_stock
  );

  // Cálculos de stock ideal y desviación — ventas totales vienen de BigQuery
  const totalStockValue = filteredSupplyItems.reduce((sum, s) => sum + (s.average_unit_cost * (s.current_stock || 0)), 0);
  const totalAccumulatedSales = totalSalesFromBQ;

  const idealStockValue = totalAccumulatedSales > 0 ? totalAccumulatedSales * ((idealStockPercent || 10) / 100) : 0;
  const stockDeviation = idealStockValue > 0 ? totalStockValue - idealStockValue : 0;
  const stockDeviationPercent = idealStockValue > 0 ? ((stockDeviation / idealStockValue) * 100) : 0;

  const handleSaveIdealStock = async (percent) => {
    justSavedRef.current = true;
    setIdealStockPercent(percent);
    
    const restaurantsToUpdate = selectedRestaurant !== 'all' 
      ? [selectedRestaurant] 
      : userRestaurants.map(r => r.id);

    for (const restId of restaurantsToUpdate) {
      const [freshRest] = await base44.entities.Restaurant.filter({ id: restId });
      if (freshRest) {
        const freshConfig = freshRest.config || {};
        await base44.entities.Restaurant.update(restId, {
          config: { ...freshConfig, ideal_stock_percent: percent }
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
  };

  // Filtrar movimientos de stock por restaurante y rango de fechas
  const filteredMovements = useMemo(() => {
    const dateRange = getDateRangeFromFilter(movementDateFilter);
    return stockMovements.filter(m => {
      const matchRestaurant = selectedRestaurant === 'all' || m.restaurant_id === selectedRestaurant;
      if (!matchRestaurant) return false;
      if (dateRange) {
        const d = m.transaction_date || m.created_date || '';
        const localDate = user ? formatDateInUserTz(d, 'yyyy-MM-dd', user) : d.slice(0, 10);
        if (localDate < dateRange.from || localDate > dateRange.to) return false;
      }
      return true;
    });
  }, [stockMovements, selectedRestaurant, movementDateFilter, user]);

  // Mutations para SupplyItem
  const createSupplyMutation = useMutation({
    mutationFn: (data) => base44.entities.SupplyItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      setShowSupplyDialog(false);
      setEditingSupply(null);
    }
  });

  const updateSupplyMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SupplyItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      setShowSupplyDialog(false);
      setEditingSupply(null);
    }
  });

  const deleteSupplyMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.SupplyItem.delete(id)));
      return ids;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      setSelectedSupplyIds(prev => prev.filter(id => !ids.includes(id)));
      setConfirmDeleteState({ open: false, ids: [], count: 0 });
    }
  });

  // Mutation para traspaso entre bodegas/restaurantes
  const transferMutation = useMutation({
    mutationFn: async ({ fromRestaurantId, toRestaurantId, items }) => {
      const now = new Date().toISOString();
      const fromName = userRestaurants.find(r => r.id === fromRestaurantId)?.name || 'Origen';
      const toName = userRestaurants.find(r => r.id === toRestaurantId)?.name || 'Destino';

      for (const item of items) {
        // 1. Descontar stock en origen
        const sourceSupply = supplyItems.find(s => s.id === item.supplyId);
        if (!sourceSupply) continue;

        const newSourceStock = Math.max(0, (sourceSupply.current_stock || 0) - item.quantity);
        await base44.entities.SupplyItem.update(sourceSupply.id, { current_stock: newSourceStock });

        // 2. Movimiento de salida en origen
        await base44.entities.StockMovement.create({
          restaurant_id: fromRestaurantId,
          product_name: item.name,
          product_id: sourceSupply.id,
          item_type: 'supply',
          movement_type: 'transfer_out',
          quantity: -item.quantity,
          previous_stock: sourceSupply.current_stock || 0,
          new_stock: newSourceStock,
          transaction_date: now,
          transfer_to_restaurant_id: toRestaurantId,
          reference_name: `Traspaso → ${toName}`,
          notes: `Traspaso de ${item.quantity} ${item.unit} hacia ${toName}`
        });

        // 3. Buscar o crear insumo en destino
        const allDestItems = supplyItems.filter(s => s.restaurant_id === toRestaurantId);
        let destSupply = allDestItems.find(s => s.name?.toLowerCase() === item.name?.toLowerCase());

        if (destSupply) {
          // Existe: sumar stock
          const newDestStock = (destSupply.current_stock || 0) + item.quantity;
          await base44.entities.SupplyItem.update(destSupply.id, { current_stock: newDestStock });

          await base44.entities.StockMovement.create({
            restaurant_id: toRestaurantId,
            product_name: item.name,
            product_id: destSupply.id,
            item_type: 'supply',
            movement_type: 'transfer_in',
            quantity: item.quantity,
            previous_stock: destSupply.current_stock || 0,
            new_stock: newDestStock,
            transaction_date: now,
            transfer_from_restaurant_id: fromRestaurantId,
            reference_name: `Traspaso ← ${fromName}`,
            notes: `Recibido ${item.quantity} ${item.unit} desde ${fromName}`
          });
        } else {
          // No existe: crear nuevo insumo en destino
          const newSupply = await base44.entities.SupplyItem.create({
            restaurant_id: toRestaurantId,
            name: sourceSupply.name,
            category: sourceSupply.category,
            unit_of_measure: sourceSupply.unit_of_measure,
            average_unit_cost: sourceSupply.average_unit_cost || 0,
            current_stock: item.quantity,
            min_stock: sourceSupply.min_stock || 0,
            warning_stock: sourceSupply.warning_stock || 0,
            supplier: sourceSupply.supplier || '',
            is_active: true
          });

          await base44.entities.StockMovement.create({
            restaurant_id: toRestaurantId,
            product_name: item.name,
            product_id: newSupply.id,
            item_type: 'supply',
            movement_type: 'transfer_in',
            quantity: item.quantity,
            previous_stock: 0,
            new_stock: item.quantity,
            transaction_date: now,
            transfer_from_restaurant_id: fromRestaurantId,
            reference_name: `Traspaso ← ${fromName}`,
            notes: `Recibido ${item.quantity} ${item.unit} desde ${fromName} (insumo creado)`
          });
        }
      }
      return items.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      setShowTransferDialog(false);
      setSuccessOverlay({
        open: true,
        title: '¡Traspaso realizado!',
        message: `Se traspasaron ${count} insumo${count !== 1 ? 's' : ''} correctamente entre bodegas.`
      });
    }
  });



  const handleSupplySubmit = (data) => {
    if (editingSupply) {
      updateSupplyMutation.mutate({ id: editingSupply.id, data });
    } else {
      createSupplyMutation.mutate(data);
    }
  };

  const handleEditSupply = (supply) => {
    setEditingSupply(supply);
    setShowSupplyDialog(true);
  };

  const handleDeleteSupply = (id) => {
    setConfirmDeleteState({ open: true, ids: [id], count: 1 });
  };

  const handleNewSupply = () => {
    if (selectedRestaurant === 'all') {
      setSelectRestaurantDialog({ open: true, action: 'add_supply' });
    } else {
      setTargetRestaurantId(selectedRestaurant);
      setEditingSupply(null);
      setShowSupplyDialog(true);
    }
  };

  // Función para cambiar el ordenamiento de insumos
  const handleSupplySort = (key) => {
    setSupplySortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Componente para el ícono de ordenamiento
  const SortIcon = ({ columnKey, sortConfig }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  const restaurantOptions = userRestaurants.map(r => ({ value: r.id, label: r.name }));

  const exportInventoryToXlsx = () => {
    const headers = [
      'nombre_insumo',
      'categoria_insumo',
      'area',
      'proveedor',
      'stock',
      'unidad',
      'costo_unitario',
      'stock_ideal',
      'stock_advertencia',
      'stock_critico',
      'rendimiento'
    ];

    const rows = filteredSupplyItems.map(item => ([
      item.name || '',
      item.category || '',
      item.area || '',
      item.supplier || '',
      item.current_stock || 0,
      item.unit_of_measure || '',
      item.average_unit_cost || 0,
      item.ideal_stock || 0,
      item.warning_stock || 0,
      item.min_stock || 0,
      item.yield_percentage || 100,
    ]));

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = headers.map((header, index) => {
      const maxLen = Math.max(header.length, ...rows.map(row => String(row[index] || '').length));
      return { wch: Math.min(maxLen + 2, 30) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');
    XLSX.writeFile(workbook, `plantilla_inventory.xlsx`);
  };

  const toggleSupplySelection = (supplyId) => {
    setSelectedSupplyIds(prev => prev.includes(supplyId) ? prev.filter(id => id !== supplyId) : [...prev, supplyId]);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredSupplyItems.slice(supplyPage * pageSize, (supplyPage + 1) * pageSize).map(item => item.id);
    const allSelected = visibleIds.every(id => selectedSupplyIds.includes(id));
    setSelectedSupplyIds(prev => allSelected ? prev.filter(id => !visibleIds.includes(id)) : [...new Set([...prev, ...visibleIds])]);
  };

  const handleBulkDeleteSupplies = () => {
    if (selectedSupplyIds.length === 0) return;
    setConfirmDeleteState({ open: true, ids: selectedSupplyIds, count: selectedSupplyIds.length });
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      {/* Header con imagen */}
      <div className="relative overflow-hidden py-12">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=1920&q=80)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/90 via-teal-900/80 to-slate-900/70" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white rounded-full animate-pulse" />
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white rounded-full animate-pulse delay-100" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 lg:w-16 lg:h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
                <Package className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-4xl font-bold text-white tracking-tight">Inventario</h1>
                <p className="text-white/70 mt-1">Gestiona tus insumos y stock</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <RestaurantSelector
                restaurants={userRestaurants}
                selectedId={selectedRestaurant}
                onChange={setSelectedRestaurant}
                className="bg-white/95 backdrop-blur-sm border-white/50 text-gray-800 shadow-lg hover:shadow-xl transition-all rounded-xl"
              />
              <RefreshButton
                queryKeys={['supplyItems', 'inventoryCounts', 'stockMovements', 'alerts', 'myRestaurants']}
                label="Actualizar"
                className="bg-white/95 backdrop-blur-sm text-gray-800 hover:bg-white shadow-lg border-0 rounded-xl"
              />

              {!isStaff && (
              <Button 
                onClick={() => {
                  if (selectedRestaurant === 'all') {
                    setSelectRestaurantDialog({ open: true, action: 'import_xlsx' });
                  } else {
                    setTargetRestaurantId(selectedRestaurant);
                    setShowImportDialog(true);
                  }
                }} 
                className="bg-white/95 backdrop-blur-sm text-gray-800 hover:bg-white shadow-lg hover:shadow-xl border-0 rounded-xl transition-all duration-300"
              >
                <Package className="w-4 h-4 mr-2" /> Importar XLSX
              </Button>
              )}
              {userRestaurants.length >= 2 && !isStaff && (
                <Button 
                  onClick={() => setShowTransferDialog(true)}
                  className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl border-0 rounded-xl transition-all duration-300"
                >
                  <Truck className="w-4 h-4 mr-2" /> Traspaso
                </Button>
              )}
              {/* Botón Conteo — visible para managers y staff */}
              {(
              <Button 
                onClick={() => {
                  if (selectedRestaurant === 'all') {
                    setSelectRestaurantDialog({ open: true, action: 'count_app' });
                  } else {
                    setTargetRestaurantId(selectedRestaurant);
                    setShowCountTypeSelector(true);
                  }
                }} 
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl border-0 rounded-xl transition-all duration-300"
              >
                <ClipboardCheck className="w-4 h-4 mr-2" /> Conteo
              </Button>
              )}
              {/* Configurar Conteo Diario — solo manager */}
              {isManager && selectedRestaurant !== 'all' && (
                <Button 
                  onClick={() => {
                    setTargetRestaurantId(selectedRestaurant);
                    setShowDailyCountConfig(true);
                  }}
                  variant="outline"
                  className="bg-white/95 backdrop-blur-sm text-gray-800 hover:bg-white shadow-lg border-0 rounded-xl transition-all duration-300"
                >
                  <Settings className="w-4 h-4 mr-2" /> Config. Diario
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-50 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Tabs defaultValue="supplies" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm shadow-lg border-0 p-1.5 rounded-2xl flex-wrap">
            <TabsTrigger value="supplies" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Carrot className="w-4 h-4" /> Insumos
            </TabsTrigger>
            {!isStaff && (
            <TabsTrigger value="movements" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <History className="w-4 h-4" /> <span className="hidden sm:inline">Movimientos</span>
            </TabsTrigger>
            )}
            {!isStaff && (
            <TabsTrigger value="losses" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-rose-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <TrendingDown className="w-4 h-4" /> <span className="hidden sm:inline">Control</span>
            </TabsTrigger>
            )}
            {!isStaff && (
            <TabsTrigger value="suppliers" className="gap-1.5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-700 data-[state=active]:to-gray-800 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Truck className="w-4 h-4" /> <span className="hidden sm:inline">Proveedores</span>
            </TabsTrigger>
            )}
          </TabsList>

          {/* TAB: Insumos */}
          <TabsContent value="supplies" className="space-y-6">
            {/* Stats de Insumos — solo manager */}
            {!isStaff && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 1. Valor en Stock */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300 h-[160px]">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-5 relative h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm font-medium">Valor en Stock</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {formatCurrency(totalStockValue, selectedCurrency, { compact: true })}
                        </p>
                      </div>
                      <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                        <DollarSign className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-blue-200 text-xs">
                      <span>💰 Inversión actual</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* 2. Stock Ideal (cliqueable → config modal) */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card 
                  className="bg-gradient-to-br from-emerald-500 to-teal-600 border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300 cursor-pointer h-[160px]"
                  onClick={() => {
                    if (selectedRestaurant === 'all') {
                      setSelectRestaurantDialog({ open: true, action: 'ideal_stock' });
                    } else {
                      setShowIdealStockConfig(true);
                    }
                  }}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-5 relative h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-emerald-100 text-sm font-medium">Stock Ideal</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {idealStockValue > 0 ? formatCurrency(idealStockValue, selectedCurrency, { compact: true }) : '—'}
                        </p>
                      </div>
                      <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                        <Settings className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-200 text-xs">
                      <Badge className="bg-white/20 text-white border-0 text-[10px] px-2 py-0">{idealStockPercent || 10}% de ventas</Badge>
                      <span className="opacity-70">Click para configurar</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* 3. Desviación */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                {(() => {
                  const isOver = stockDeviation > 0;
                  const isOk = stockDeviation <= 0;
                  const noData = totalAccumulatedSales === 0;
                  return (
                    <Card className={`border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300 h-[160px] ${
                      noData ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                      isOk ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'
                    }`}>
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CardContent className="p-5 relative h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-sm font-medium ${noData ? 'text-gray-200' : isOk ? 'text-green-100' : 'text-red-100'}`}>Desviación</p>
                            <p className="text-2xl font-bold text-white mt-1">
                              {noData ? '—' : `${isOver ? '+' : ''}${formatCurrency(stockDeviation, selectedCurrency, { compact: true })}`}
                            </p>
                          </div>
                          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                            {noData ? <TrendingDown className="w-7 h-7 text-white" /> : isOk ? <Sparkles className="w-7 h-7 text-white" /> : <AlertTriangle className="w-7 h-7 text-white" />}
                          </div>
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${noData ? 'text-gray-300' : isOk ? 'text-green-200' : 'text-red-200'}`}>
                          {noData ? (
                            <span>Sin ventas registradas</span>
                          ) : isOk ? (
                            <span>✓ Stock dentro del rango ideal ({Math.abs(stockDeviationPercent).toFixed(0)}% bajo)</span>
                          ) : (
                            <span>⚠️ Sobreestockeado (+{stockDeviationPercent.toFixed(0)}% sobre ideal)</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </motion.div>

              {/* 4. SKUs + botón stock bajo */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card 
                  className={`border-0 shadow-xl overflow-hidden relative group hover:shadow-2xl transition-all duration-300 cursor-pointer bg-gradient-to-br from-green-500 to-emerald-600 h-[160px] ${filterStatus === 'all' && filterCategory === 'all' ? 'ring-2 ring-white/50' : ''}`}
                  onClick={() => { setFilterStatus('all'); setFilterCategory('all'); setSupplyPage(0); }}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-5 relative h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm font-medium">Total Insumos</p>
                        <p className="text-3xl font-bold text-white mt-1">{filteredSupplyItems.length}</p>
                      </div>
                      <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                        <Carrot className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-green-200 text-xs">SKUs en inventario</span>
                      {criticalStockSupplies.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterStatus(filterStatus === 'critical' ? 'all' : 'critical');
                            setSupplyPage(0);
                          }}
                          className={`flex items-center gap-1.5 text-xs backdrop-blur-sm px-2.5 py-1.5 rounded-lg transition-all font-semibold ${
                            filterStatus === 'critical'
                              ? 'bg-white text-red-600 shadow-md'
                              : 'bg-red-600/90 hover:bg-red-600 text-white'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {criticalStockSupplies.length} crítico
                          {filterStatus === 'critical' && (
                            <span className="ml-1 bg-red-100 text-red-600 rounded-full w-4 h-4 flex items-center justify-center text-[9px]">✕</span>
                          )}
                        </button>
                      )}
                      {lowStockSupplies.length - criticalStockSupplies.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterStatus(filterStatus === 'warning' ? 'all' : 'warning');
                            setSupplyPage(0);
                          }}
                          className={`flex items-center gap-1.5 text-xs backdrop-blur-sm px-2.5 py-1.5 rounded-lg transition-all font-semibold ${
                            filterStatus === 'warning'
                              ? 'bg-white text-amber-600 shadow-md'
                              : 'bg-amber-500/90 hover:bg-amber-500 text-white'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {lowStockSupplies.length - criticalStockSupplies.length} bajo
                          {filterStatus === 'warning' && (
                            <span className="ml-1 bg-amber-100 text-amber-600 rounded-full w-4 h-4 flex items-center justify-center text-[9px]">✕</span>
                          )}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowStockExportDialog(true); }}
                        className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 backdrop-blur-sm px-2 py-1.5 rounded-lg transition-all text-white font-medium"
                        title="Exportar lista de compras PDF"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            )}

            {/* Header de Insumos Modernizado */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Carrot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-gray-900">Catálogo de Insumos</CardTitle>
                      <p className="text-sm text-gray-500">{filteredSupplyItems.length} insumos registrados</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Buscar insumo..."
                        value={supplySearchTerm}
                        onChange={(e) => { setSupplySearchTerm(e.target.value); setSupplyPage(0); }}
                        className="pl-11 h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                      />
                    </div>
                    <SelectUI value={filterCategory} onValueChange={(val) => { setFilterCategory(val); setSupplyPage(0); }}>
                      <SelectTrigger className="h-11 w-full sm:w-[160px] rounded-xl border-gray-200 bg-white shadow-sm">
                        <SelectValue placeholder="Categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {availableCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </SelectUI>
                    <SelectUI value={filterArea} onValueChange={(val) => { setFilterArea(val); setSupplyPage(0); }}>
                      <SelectTrigger className="h-11 w-full sm:w-[140px] rounded-xl border-gray-200 bg-white shadow-sm">
                        <SelectValue placeholder="Área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las áreas</SelectItem>
                        {availableAreas.map(area => (
                          <SelectItem key={area} value={area}>{area}</SelectItem>
                        ))}
                      </SelectContent>
                    </SelectUI>
                    <SelectUI value={filterSupplier} onValueChange={(val) => { setFilterSupplier(val); setSupplyPage(0); }}>
                      <SelectTrigger className="h-11 w-full sm:w-[160px] rounded-xl border-gray-200 bg-white shadow-sm">
                        <SelectValue placeholder="Proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los proveedores</SelectItem>
                        {availableSuppliers.map(sup => (
                          <SelectItem key={sup} value={sup}>{sup}</SelectItem>
                        ))}
                      </SelectContent>
                    </SelectUI>
                    {!isStaff && (
                    <>
                      <Button onClick={exportInventoryToXlsx} variant="outline" className="h-11 rounded-xl border-gray-200 bg-white shadow-sm hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200">
                        <Download className="w-4 h-4 mr-2" /> Descargar XLSX
                      </Button>
                      <Button onClick={handleNewSupply} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl h-11 px-5">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Insumo
                      </Button>
                    </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!isStaff && (
                  <div className="p-4 pb-0">
                    <BulkDeleteBar
                      selectedCount={selectedSupplyIds.length}
                      onDelete={handleBulkDeleteSupplies}
                      onClearSelection={() => setSelectedSupplyIds([])}
                      isDeleting={deleteSupplyMutation.isPending}
                    />
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    {/* Columnas alineadas con plantilla XLSX: nombre_insumo, item_compra, categoria_insumo, costo_unitario, unidad, stock */}
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                        {!isStaff && (
                          <th className="text-center py-4 px-3 font-semibold text-gray-700">
                            <input
                              type="checkbox"
                              checked={filteredSupplyItems.slice(supplyPage * pageSize, (supplyPage + 1) * pageSize).length > 0 && filteredSupplyItems.slice(supplyPage * pageSize, (supplyPage + 1) * pageSize).every(item => selectedSupplyIds.includes(item.id))}
                              onChange={toggleSelectAllVisible}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </th>
                        )}
                        <th 
                          className="text-left py-4 px-5 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100/50 select-none transition-colors"
                          onClick={() => handleSupplySort('name')}
                        >
                          <div className="flex items-center gap-1">
                            Insumo
                            <SortIcon columnKey="name" sortConfig={supplySortConfig} />
                          </div>
                        </th>
                        <th 
                          className="text-left py-4 px-5 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100/50 select-none transition-colors"
                          onClick={() => handleSupplySort('category')}
                        >
                          <div className="flex items-center gap-1">
                            Clasificación Familia
                            <SortIcon columnKey="category" sortConfig={supplySortConfig} />
                          </div>
                        </th>
                        <th className="text-left py-4 px-5 font-semibold text-gray-700">
                          <div className="flex items-center gap-1">
                            Centro de Costo
                          </div>
                        </th>
                        <th 
                          className="text-left py-4 px-5 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100/50 select-none transition-colors"
                          onClick={() => handleSupplySort('area')}
                        >
                          <div className="flex items-center gap-1">
                            Área
                            <SortIcon columnKey="area" sortConfig={supplySortConfig} />
                          </div>
                        </th>
                        <th 
                          className="text-center py-4 px-5 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100/50 select-none transition-colors"
                          onClick={() => handleSupplySort('unit_of_measure')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Unidad
                            <SortIcon columnKey="unit_of_measure" sortConfig={supplySortConfig} />
                          </div>
                        </th>
                        <th 
                          className="text-right py-4 px-5 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100/50 select-none transition-colors"
                          onClick={() => handleSupplySort('average_unit_cost')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Costo Unit.
                            <SortIcon columnKey="average_unit_cost" sortConfig={supplySortConfig} />
                          </div>
                        </th>
                        {!isStaff && (
                        <th
                          className="text-right py-4 px-5 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100/50 select-none transition-colors"
                          onClick={() => handleSupplySort('current_stock')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Stock
                            <SortIcon columnKey="current_stock" sortConfig={supplySortConfig} />
                          </div>
                        </th>
                        )}
                        {!isStaff && (
                        <th
                          className="text-right py-4 px-5 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100/50 select-none transition-colors"
                          onClick={() => handleSupplySort('min_stock')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Stock Mínimo
                            <SortIcon columnKey="min_stock" sortConfig={supplySortConfig} />
                          </div>
                        </th>
                        )}

                        {!isStaff && <th className="text-center py-4 px-5 font-semibold text-gray-700">Análisis de compra</th>}
                        {!isStaff && <th className="text-center py-4 px-5 font-semibold text-gray-700">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSupplyItems.slice(supplyPage * pageSize, (supplyPage + 1) * pageSize).map((item, idx) => {
                        return (
                          <motion.tr 
                            key={item.id} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className="hover:bg-gradient-to-r hover:from-green-50/50 hover:to-transparent transition-all duration-200 group"
                          >
                            {!isStaff && (
                              <td className="py-4 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedSupplyIds.includes(item.id)}
                                  onChange={() => toggleSupplySelection(item.id)}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                              </td>
                            )}
                            <td className="py-4 px-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                                  <Carrot className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-900">{item.name}</span>
                                  {item.supplier && <p className="text-xs text-gray-400">{item.supplier}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-5">
                              <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-0 font-medium px-3 py-1">
                                {item.category}
                              </Badge>
                            </td>
                            <td className="py-4 px-5">
                              {(() => {
                                const restId = item.restaurant_id;
                                const rest = userRestaurants.find(r => r.id === restId);
                                const cats = rest?.config?.supply_categories || [];
                                const label = getCostTypeLabel(item.category, cats);
                                const isFC = label === 'Food Cost';
                                return (
                                  <Badge className={`${isFC ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-0 text-[10px] px-2 py-0.5 whitespace-nowrap`}>
                                    {isFC ? '🍽️ Food Cost' : `💼 ${label}`}
                                  </Badge>
                                );
                              })()}
                            </td>
                            <td className="py-4 px-5">
                              {item.area ? (
                                <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border-0 font-medium px-3 py-1">
                                  {item.area}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-4 px-5 text-center">
                              <Badge variant="outline" className="border-gray-200 text-gray-600 font-medium">
                                {unitLabels[item.unit_of_measure] || item.unit_of_measure}
                              </Badge>
                            </td>
                            <td className="py-4 px-5 text-right">
                              <span className="font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg">
                                {formatCurrency(item.average_unit_cost || 0, selectedCurrency)}
                              </span>
                            </td>
                            {!isStaff && (
                            <td className="py-4 px-5 text-right">
                              {(() => {
                                const status = getStockStatus(item.current_stock, item.min_stock, item.warning_stock);
                                const colorClass = status === 'critical' ? 'bg-red-100 text-red-700' : 
                                                  status === 'warning' ? 'bg-amber-100 text-amber-700' : 
                                                  'bg-gray-100 text-gray-900';
                                return (
                                  <span className={`font-bold px-3 py-1.5 rounded-lg ${colorClass}`}>
                                    {item.current_stock || 0}
                                  </span>
                                );
                              })()}
                            </td>
                            )}
                            {!isStaff && (
                            <td className="py-4 px-5 text-right">
                              <span className="text-gray-600 font-medium">{item.min_stock || 0}</span>
                            </td>
                            )}

                            {!isStaff && (
                            <td className="py-4 px-5 text-center">
                                  {(() => {
                                    const status = getStockStatus(item.current_stock, item.min_stock, item.warning_stock);
                                    if (status === 'critical') {
                                      return (
                                        <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white border-0 shadow-sm font-medium px-3 py-1">
                                          🔴 Crítico
                                        </Badge>
                                      );
                                    } else if (status === 'warning') {
                                      return (
                                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm font-medium px-3 py-1">
                                          🟠 Revisión
                                        </Badge>
                                      );
                                    } else {
                                      return (
                                        <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 shadow-sm font-medium px-3 py-1">
                                          ✓ Normal
                                        </Badge>
                                      );
                                    }
                                  })()}
                                </td>
                            )}
                            {!isStaff && (
                            <td className="py-4 px-5 text-center">
                              <div className="flex justify-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleEditSupply(item)}
                                  className="h-9 w-9 p-0 hover:bg-green-100 hover:text-green-600 rounded-xl transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDeleteSupply(item.id)}
                                  className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                            )}
                          </motion.tr>
                        );
                      })}
                      {filteredSupplyItems.length === 0 && (
                        <tr>
                          <td colSpan={isStaff ? 7 : 10} className="py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
                                <Carrot className="w-8 h-8 text-green-400" />
                              </div>
                              <p className="text-gray-500 font-medium">No hay insumos registrados</p>
                              <Button onClick={handleNewSupply} className="mt-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl shadow-lg">
                                <Plus className="w-4 h-4 mr-2" /> Agregar primer insumo
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Paginación Insumos Modernizada */}
                {filteredSupplyItems.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100">
                    <div className="flex items-center gap-4">
                      <p className="text-sm text-gray-600 font-medium">
                        Mostrando <span className="text-green-600 font-bold">{supplyPage * pageSize + 1} - {Math.min((supplyPage + 1) * pageSize, filteredSupplyItems.length)}</span> de {filteredSupplyItems.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Filas:</span>
                        <SelectUI value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setSupplyPage(0); }}>
                          <SelectTrigger className="w-[70px] h-9 rounded-xl border-gray-200 bg-white shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </SelectUI>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSupplyPage(0)} disabled={supplyPage === 0} className="hidden sm:flex rounded-xl border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors">Primera</Button>
                      <Button variant="outline" size="sm" onClick={() => setSupplyPage(p => p - 1)} disabled={supplyPage === 0} className="rounded-xl border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-700 font-semibold min-w-[100px] text-center bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                        {supplyPage + 1} / {Math.ceil(filteredSupplyItems.length / pageSize) || 1}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setSupplyPage(p => p + 1)} disabled={(supplyPage + 1) * pageSize >= filteredSupplyItems.length} className="rounded-xl border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSupplyPage(Math.ceil(filteredSupplyItems.length / pageSize) - 1)} disabled={(supplyPage + 1) * pageSize >= filteredSupplyItems.length} className="hidden sm:flex rounded-xl border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors">Última</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </motion.div>
          </TabsContent>

          {/* TAB: Movimientos de Stock */}
          <TabsContent value="movements" className="space-y-6">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-500" />
                    Historial de Movimientos de Stock
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <MovementDateFilter
                      value={movementDateFilter}
                      onChange={(val) => { setMovementDateFilter(val); setMovementPage(0); }}
                    />
                    <SelectUI value={movementFilter} onValueChange={(val) => { setMovementFilter(val); setMovementPage(0); }}>
                      <SelectTrigger className="w-[160px] h-9 rounded-xl border-gray-200 bg-white shadow-sm text-sm">
                        <SelectValue placeholder="Filtrar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="sale">Ventas</SelectItem>
                        <SelectItem value="purchase">Compras</SelectItem>
                        <SelectItem value="count">Conteos</SelectItem>
                        <SelectItem value="loss">Mermas</SelectItem>
                        <SelectItem value="adjustment">Ajustes</SelectItem>
                        <SelectItem value="sampling">Muestreos</SelectItem>
                        <SelectItem value="transfer_out">Envíos</SelectItem>
                        <SelectItem value="transfer_in">Recepciones</SelectItem>
                      </SelectContent>
                    </SelectUI>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const displayedMovements = movementFilter === 'all' 
                    ? filteredMovements 
                    : filteredMovements.filter(m => m.movement_type === movementFilter);
                  return displayedMovements;
                })().length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const allDisplayed = movementFilter === 'all' ? filteredMovements : filteredMovements.filter(m => m.movement_type === movementFilter);
                      const totalMovementPages = Math.ceil(allDisplayed.length / movementPageSize) || 1;
                      const paginatedMovements = allDisplayed.slice(movementPage * movementPageSize, (movementPage + 1) * movementPageSize);
                      return paginatedMovements;
                    })().map((movement) => {
                      const isPositive = movement.quantity > 0;
                      const typeLabels = {
                        sale: 'Venta',
                        recipe_sale: 'Venta (receta)',
                        purchase: 'Compra',
                        adjustment: 'Ajuste',
                        count: 'Conteo',
                        sampling: 'Muestreo',
                        loss: 'Merma',
                        transfer_out: 'Envío',
                        transfer_in: 'Recepción'
                      };
                      const typeColors = {
                        sale: 'bg-orange-500 text-white',
                        recipe_sale: 'bg-orange-400 text-white',
                        purchase: 'bg-emerald-500 text-white',
                        adjustment: 'bg-blue-500 text-white',
                        count: 'bg-purple-500 text-white',
                        sampling: 'bg-indigo-500 text-white',
                        loss: 'bg-rose-500 text-white',
                        transfer_out: 'bg-indigo-500 text-white',
                        transfer_in: 'bg-cyan-500 text-white'
                      };
                      // Usar transaction_date (fecha de pago de la compra o fecha de venta)
                      const displayDate = movement.transaction_date || movement.created_date;
                      // Formatear fecha en la zona horaria del usuario
                      const formatDateOnly = (dateStr) => {
                        if (!dateStr) return '—';
                        if (user) {
                          const formatted = formatDateInUserTz(dateStr, 'dd-MM-yyyy', user);
                          if (formatted) return formatted;
                        }
                        // Fallback sin timezone
                        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                        if (match) return `${match[3]}-${match[2]}-${match[1]}`;
                        return '—';
                      };
                      return (
                        <div key={movement.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <Badge className={typeColors[movement.movement_type] || 'bg-gray-100'}>
                              {typeLabels[movement.movement_type] || movement.movement_type}
                            </Badge>
                            <div>
                              <p className="font-medium text-gray-900">{movement.product_name}</p>
                              <p className="text-xs text-gray-500">
                                {formatDateOnly(displayDate)}
                                {movement.notes && ` • ${movement.notes}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isPositive ? '+' : ''}{movement.quantity}
                            </p>
                            <p className="text-xs text-gray-500">
                              {movement.previous_stock ?? '?'} → {movement.new_stock ?? '?'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {/* Paginación Movimientos */}
                    {(() => {
                    const allDisplayed = movementFilter === 'all' ? filteredMovements : filteredMovements.filter(m => m.movement_type === movementFilter);
                    const totalMovementPages = Math.ceil(allDisplayed.length / movementPageSize) || 1;
                    return allDisplayed.length > movementPageSize ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100 mt-4">
                        <p className="text-sm text-gray-600 font-medium">
                          Mostrando <span className="text-blue-600 font-bold">{movementPage * movementPageSize + 1} - {Math.min((movementPage + 1) * movementPageSize, allDisplayed.length)}</span> de {allDisplayed.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setMovementPage(0)} disabled={movementPage === 0} className="hidden sm:flex rounded-xl border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">Primera</Button>
                          <Button variant="outline" size="sm" onClick={() => setMovementPage(p => p - 1)} disabled={movementPage === 0} className="rounded-xl border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm text-gray-700 font-semibold min-w-[100px] text-center bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                            {movementPage + 1} / {totalMovementPages}
                          </span>
                          <Button variant="outline" size="sm" onClick={() => setMovementPage(p => p + 1)} disabled={(movementPage + 1) * movementPageSize >= allDisplayed.length} className="rounded-xl border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setMovementPage(totalMovementPages - 1)} disabled={(movementPage + 1) * movementPageSize >= allDisplayed.length} className="hidden sm:flex rounded-xl border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">Última</Button>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No hay movimientos de stock registrados</p>
                    <p className="text-sm mt-1">Los movimientos se registran automáticamente al importar ventas</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Control de Inventario */}
          <TabsContent value="losses" className="space-y-6">
            {/* Sub-pestañas: Pérdidas, Merma, Desviación, Alza de Precio */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'diagnostic', label: 'Diagnóstico', icon: '🔍', gradient: 'from-slate-700 to-slate-900' },
                { key: 'counts', label: 'Conteos', icon: '📋', gradient: 'from-purple-500 to-violet-500' },
                { key: 'losses', label: 'Pérdidas', icon: '📉', gradient: 'from-red-500 to-rose-500' },
                { key: 'waste', label: 'Merma', icon: '🗑️', gradient: 'from-orange-500 to-amber-500' },
                { key: 'deviation', label: 'Desviación', icon: '⚖️', gradient: 'from-indigo-500 to-violet-500' },
                { key: 'price', label: 'Alza de Precio', icon: '📈', gradient: 'from-blue-500 to-cyan-500' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setControlSubTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-300 shadow-sm ${
                    controlSubTab === tab.key
                      ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg scale-[1.02]`
                      : 'bg-white text-gray-600 hover:bg-gray-50 hover:shadow-md border border-gray-100'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {controlSubTab === 'diagnostic' && (
              <LossDiagnosticPanel
                inventoryCounts={inventoryCounts}
                wasteRecords={wasteRecords}
                supplyItems={supplyItems}
                supplyCosts={supplyCostsData}
                stockMovements={stockMovements}
                recipes={recipesData}
                recipeSamples={recipeSamplesData}
                selectedRestaurant={selectedRestaurant}
                currency={selectedCurrency}
              />
            )}

            {controlSubTab === 'counts' && (
              <InventoryCountsPanel
                inventoryCounts={inventoryCounts}
                supplyItems={supplyItems}
                selectedRestaurant={selectedRestaurant}
                currency={selectedCurrency}
              />
            )}

            {controlSubTab === 'losses' && (
              <LossesPanel
                inventoryCounts={inventoryCounts}
                supplyItems={supplyItems}
                supplyCosts={supplyCostsData}
                stockMovements={stockMovements}
                wasteRecords={wasteRecords}
                selectedRestaurant={selectedRestaurant}
                currency={selectedCurrency}
              />
            )}

            {controlSubTab === 'waste' && (
              <WastePanel
                supplyItems={supplyItems}
                selectedRestaurant={selectedRestaurant}
                accessibleRestaurantIds={accessibleRestaurantIds}
                currency={selectedCurrency}
                restaurants={userRestaurants}
              />
            )}

            {controlSubTab === 'deviation' && (
              <DeviationPanel
                inventoryCounts={inventoryCounts}
                wasteRecords={wasteRecords}
                supplyItems={supplyItems}
                supplyCosts={supplyCostsData}
                stockMovements={stockMovements}
                recipes={recipesData}
                recipeSamples={recipeSamplesData}
                selectedRestaurant={selectedRestaurant}
                currency={selectedCurrency}
              />
            )}

            {controlSubTab === 'price' && (
              <PriceIncreasePanel
                supplyCosts={supplyCostsData}
                selectedRestaurant={selectedRestaurant}
                currency={selectedCurrency}
                alertThresholds={(() => {
                  if (selectedRestaurant !== 'all') {
                    const r = userRestaurants.find(r => r.id === selectedRestaurant);
                    return r?.alert_thresholds?.supply_price_change || {};
                  }
                  return {};
                })()}
              />
            )}
          </TabsContent>

          {/* TAB: Proveedores — solo manager */}
          {!isStaff && (
          <TabsContent value="suppliers" className="space-y-6">
            <SupplierHistoryTab
              selectedRestaurant={selectedRestaurant}
              accessibleRestaurantIds={accessibleRestaurantIds}
              restaurants={userRestaurants}
              suppliers={suppliers}
              currency={selectedCurrency}
            />
          </TabsContent>
          )}
        </Tabs>
      </div>
    </div>

      {/* Select Restaurant Dialog */}
      <SelectRestaurantDialog
        open={selectRestaurantDialog.open}
        onOpenChange={(open) => setSelectRestaurantDialog({ ...selectRestaurantDialog, open })}
        restaurants={userRestaurants}
        title="Selecciona un local"
        description="Elige el restaurante donde aplicar esta acción"
        onSelect={(restaurantId) => {
          setTargetRestaurantId(restaurantId);
          if (selectRestaurantDialog.action === 'import_xlsx') {
            setShowImportDialog(true);
          } else if (selectRestaurantDialog.action === 'add_supply') {
            setEditingSupply(null);
            setShowSupplyDialog(true);
          } else if (selectRestaurantDialog.action === 'count_app') {
            setShowCountTypeSelector(true);
          } else if (selectRestaurantDialog.action === 'ideal_stock') {
            setSelectedRestaurant(restaurantId);
            setTimeout(() => setShowIdealStockConfig(true), 100);
          }
        }}
      />

      {/* Dialog: Agregar/Editar Insumo */}
                  <Dialog open={showSupplyDialog} onOpenChange={setShowSupplyDialog}>
                    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Carrot className="w-5 h-5 text-green-600" />
              {editingSupply ? 'Editar Insumo' : 'Nuevo Insumo'}
            </DialogTitle>
          </DialogHeader>
          <SupplyItemForm
            defaultValues={editingSupply || { restaurant_id: targetRestaurantId || (selectedRestaurant !== 'all' ? selectedRestaurant : ''), unit_of_measure: 'kg' }}
            restaurants={restaurantOptions}
            supplyCategories={supplyCategories}
            suppliers={suppliers.filter(s => s.restaurant_id === (editingSupply?.restaurant_id || targetRestaurantId || selectedRestaurant))}
            onSubmit={handleSupplySubmit}
            onCancel={() => { setShowSupplyDialog(false); setEditingSupply(null); setTargetRestaurantId(null); }}
            isLoading={createSupplyMutation.isPending || updateSupplyMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Importar Insumos XLSX */}
      <SupplyImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        restaurantId={targetRestaurantId || selectedRestaurant}
        restaurant={(() => {
          const rid = targetRestaurantId || selectedRestaurant;
          return (rid && rid !== 'all') ? userRestaurants.find(r => r.id === rid) : null;
        })()}
        restaurantConfig={(() => {
          const rid = targetRestaurantId || selectedRestaurant;
          if (rid && rid !== 'all') {
            const r = userRestaurants.find(r => r.id === rid);
            return r?.config || {};
          }
          return restaurantConfig;
        })()}
        onSuccess={(count) => {
          queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
          setTargetRestaurantId(null);
          setSuccessOverlay({
            open: true,
            title: '¡Insumos importados!',
            message: `Se importaron ${count} insumos correctamente.`
          });
        }}
      />

      {/* Success Overlay */}
      <SuccessOverlay
        open={successOverlay.open}
        onClose={() => setSuccessOverlay({ ...successOverlay, open: false })}
        title={successOverlay.title}
        message={successOverlay.message}
      />

      {/* Dialog: Traspaso entre Bodegas */}
      <WarehouseTransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        restaurants={userRestaurants}
        supplyItems={supplyItems}
        onTransfer={(data) => transferMutation.mutate(data)}
        isLoading={transferMutation.isPending}
      />

      {/* Stock Export Dialog */}
      <StockExportDialog
        open={showStockExportDialog}
        onOpenChange={setShowStockExportDialog}
        supplyItems={filteredSupplyItems}
        getStockStatus={getStockStatus}
        restaurantName={selectedRestaurant !== 'all' ? userRestaurants.find(r => r.id === selectedRestaurant)?.name : 'Todos los locales'}
        currency={selectedCurrency}
      />

      {/* Restaurant Picker al entrar */}
      <RestaurantPickerOnEntry
        restaurants={userRestaurants}
        selectedRestaurant={selectedRestaurant}
        onSelect={setSelectedRestaurant}
        pageName="Inventario"
      />

      {/* Stock alerts are now generated exclusively by the backend (runScheduledAlertAnalysis) */}

      {/* Configurar Conteo Diario */}
      <DailyCountConfigDialog
        open={showDailyCountConfig}
        onOpenChange={setShowDailyCountConfig}
        restaurantId={targetRestaurantId || selectedRestaurant}
        supplyItems={supplyItems}
      />

      {/* Selector de tipo de conteo */}
      <CountTypeSelector
        open={showCountTypeSelector}
        onOpenChange={setShowCountTypeSelector}
        onSelect={(type) => {
          setCountWizardType(type);
          setShowCountWizard(true);
        }}
      />

      {/* Modal Stock Ideal */}
      <IdealStockConfigModal
        open={showIdealStockConfig}
        onOpenChange={setShowIdealStockConfig}
        currentPercent={idealStockPercent || 10}
        onSave={handleSaveIdealStock}
        restaurantName={selectedRestaurant !== 'all' 
          ? userRestaurants.find(r => r.id === selectedRestaurant)?.name 
          : 'Todos los locales'}
      />

      <AlertDialog open={confirmDeleteState.open} onOpenChange={(open) => setConfirmDeleteState(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deseas confirmar la eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se {confirmDeleteState.count === 1 ? 'eliminará 1 insumo' : `eliminarán ${confirmDeleteState.count} insumos`} de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Rechazar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteSupplyMutation.mutate(confirmDeleteState.ids)}
            >
              Aceptar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Wizard de conteo */}
      <InventoryCountWizard
        open={showCountWizard}
        onOpenChange={setShowCountWizard}
        countType={countWizardType}
        restaurantId={targetRestaurantId || selectedRestaurant}
        supplyItems={supplyItems}
        isManager={isManager}
        onSuccess={(count) => {
          // El wizard ya muestra su propia pantalla de éxito, no duplicar con SuccessOverlay
        }}
      />
    </>
  );
}