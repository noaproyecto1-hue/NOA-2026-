import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Plus, 
  ShoppingCart, 
  Package, 
  Receipt,
  Edit,
  Trash2,
  ClipboardList,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  Upload,
  Database
} from "lucide-react";
import PageHeader from '@/components/ui/PageHeader';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

import RestaurantSelector from '@/components/dashboard/RestaurantSelector';
import RefreshButton from '@/components/ui/RefreshButton';
import DataTable from '@/components/analysis/DataTable';
import EntityForm from '@/components/forms/EntityForm';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import SalesImportDialog from '@/components/import/SalesImportDialog';
import PurchasesImportDialog from '@/components/import/PurchasesImportDialog';
import SelectRestaurantDialog from '@/components/dialogs/SelectRestaurantDialog';
import SaleEditForm from '@/components/forms/SaleEditForm';
import SupplyPurchaseForm from '@/components/forms/SupplyPurchaseForm';
import OpExPurchaseForm from '@/components/forms/OpExPurchaseForm';
import { getSelectedCurrency, formatCurrency, getCurrencySymbol } from '@/components/utils/currencyHelper';
import { getTodayInUserTz, getCurrentDateInUserTz } from '@/components/utils/timezoneHelper';
import { resolveCategoryCostType as _resolveCostType } from '@/components/utils/supplyCategoryHelper';
import SuccessOverlay from '@/components/ui/SuccessOverlay';
import FudoSyncDialog from '@/components/integrations/FudoSyncDialog';
import InvoiceUploadDialog from '@/components/import/InvoiceUploadDialog';
import RestaurantPickerOnEntry from '@/components/dialogs/RestaurantPickerOnEntry';
import NewSupplierDetectedDialog from '@/components/suppliers/NewSupplierDetectedDialog';
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
import { AlertTriangle } from "lucide-react";
import { processStockForNewPurchase, processStockRectification } from '@/components/utils/purchaseStockService';
import { fetchAllRecords, fetchAllForRestaurants } from '@/components/utils/fetchAllRecords';
import BulkDeleteBar from '@/components/data/BulkDeleteBar';

// Configuración de tabs con branding
const tabsConfig = {
  sales: {
    label: 'Ventas',
    icon: ShoppingCart,
    color: 'emerald',
    gradient: 'from-emerald-500 to-emerald-600',
    lightBg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
    badgeBg: 'bg-emerald-100 text-emerald-700',
    description: 'Registra y administra las ventas diarias'
  },
  purchases: {
    label: 'Compras y Gastos',
    icon: Receipt,
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-500',
    lightBg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-700',
    description: 'Registro unificado de compras y gastos operativos'
  }
  // NPS deshabilitado temporalmente
};

const categoryLabels = {
  food: "Comida", beverages: "Bebidas", desserts: "Postres",
  alcohol: "Alcohol", delivery: "Delivery", catering: "Catering", other: "Otros"
};

const opexTypeLabels = {
  rent: "Alquiler", utilities: "Servicios", payroll: "Nómina",
  insurance: "Seguros", maintenance: "Mantenimiento", marketing: "Marketing",
  licenses: "Licencias", technology: "Tecnología", other: "Otros"
};

// Obtener rango de fechas por defecto (últimos 3 meses) — se calcula dentro del componente con zona horaria

export default function DataManagement() {
  const queryClient = useQueryClient();
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [activeTab, setActiveTab] = useState("sales");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [purchasesImportDialogOpen, setPurchasesImportDialogOpen] = useState(false);
  const [selectRestaurantDialog, setSelectRestaurantDialog] = useState({ open: false, action: null });
  const [targetRestaurantId, setTargetRestaurantId] = useState(null);
  const [successOverlay, setSuccessOverlay] = useState({ open: false, title: '', message: '' });
  const [manualPurchaseType, setManualPurchaseType] = useState(null); // 'supply' o 'opex'
  const [fudoSyncDialogOpen, setFudoSyncDialogOpen] = useState(false);
  const [fudoSyncRestaurant, setFudoSyncRestaurant] = useState(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceRestaurantId, setInvoiceRestaurantId] = useState(null);
  const [pendingFilter, setPendingFilter] = useState(false);
  const [newSupplierDialog, setNewSupplierDialog] = useState({ open: false, data: null, restaurantId: null });
  const [pendingSuccess, setPendingSuccess] = useState(null); // Queued success overlay for after supplier dialog closes
  const [selectedSaleIds, setSelectedSaleIds] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState([]);
  const [isBulkDeletingPurchases, setIsBulkDeletingPurchases] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, type: null });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Inicializar dateRange con mes actual en zona horaria del usuario
  React.useEffect(() => {
    if (user && !dateRange.from) {
      const nowLocal = getCurrentDateInUserTz(user);
      const endStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
      const startStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-01`;
      setDateRange({ from: startStr, to: endStr });
    }
  }, [user]);

  // Filtrar restaurantes por usuario - respeta restaurant_ids si existen
  const { data: restaurants = [], isLoading: isRestaurantsLoading } = useQuery({
    queryKey: ['myRestaurants', user?.email, user?.restaurant_ids],
    queryFn: async () => {
      // Si tiene restaurant_ids asignados, usar SOLO esos
      if (user?.restaurant_ids?.length > 0) {
        const allActive = await base44.entities.Restaurant.filter({ is_active: true });
        return allActive.filter(r => user.restaurant_ids.includes(r.id));
      }
      // Si no, buscar por created_by (propietario)
      return base44.entities.Restaurant.filter({ is_active: true, created_by: user?.email });
    },
    enabled: !!user?.email
  });

  const accessibleRestaurants = restaurants;

  // Obtener moneda del restaurante seleccionado
  const selectedCurrency = getSelectedCurrency(selectedRestaurant, accessibleRestaurants);
  const currencySymbol = getCurrencySymbol(selectedCurrency);

  // Zona horaria del usuario (Chile por defecto)
  const userTimezone = user?.timezone || 'America/Santiago';

  // Filtrar datos por fecha en el cliente — convierte a zona horaria del usuario
  const filterByDateRange = (items, dateField = 'date') => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) return items;
    
    return items.filter(item => {
      const itemDateStr = item[dateField];
      if (!itemDateStr) return false;
      
      let itemDateLocal;
      
      // Si tiene parte de hora (datetime ISO), convertir a zona horaria del usuario
      if (itemDateStr.includes('T')) {
        const dateObj = new Date(itemDateStr);
        if (isNaN(dateObj.getTime())) return false;
        // Formatear en la zona horaria del usuario para extraer la fecha local
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: userTimezone,
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(dateObj); // returns YYYY-MM-DD
        itemDateLocal = parts;
      } else {
        // Ya es solo fecha (YYYY-MM-DD), usar tal cual
        itemDateLocal = itemDateStr.split('T')[0];
      }
      
      const fromDate = dateRange.from;
      const toDate = dateRange.to;
      
      if (fromDate && itemDateLocal < fromDate) return false;
      if (toDate && itemDateLocal > toDate) return false;
      
      return true;
    });
  };

  // IDs de restaurantes accesibles
  const accessibleRestaurantIds = useMemo(() => {
    return accessibleRestaurants.map(r => r.id);
  }, [accessibleRestaurants]);

  // Fetch data — paginación automática para manejar >5000 registros
  const { data: salesRaw = [] } = useQuery({
    queryKey: ['sales', selectedRestaurant, accessibleRestaurantIds],
    queryFn: async () => {
      if (selectedRestaurant !== "all") {
        return fetchAllRecords('Sale', { restaurant_id: selectedRestaurant }, '-date_time');
      }
      const results = await fetchAllForRestaurants('Sale', accessibleRestaurantIds, {}, '-date_time');
      return results.sort((a, b) => (b.date_time || '').localeCompare(a.date_time || ''));
    },
    enabled: accessibleRestaurantIds.length > 0,
    staleTime: 2 * 60 * 1000
  });

  const { data: supplyCostsRaw = [] } = useQuery({
    queryKey: ['supplyCosts', selectedRestaurant, accessibleRestaurantIds],
    queryFn: async () => {
      if (selectedRestaurant !== "all") {
        return fetchAllRecords('SupplyCost', { restaurant_id: selectedRestaurant }, '-date');
      }
      const results = await fetchAllForRestaurants('SupplyCost', accessibleRestaurantIds, {}, '-date');
      return results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },
    enabled: accessibleRestaurantIds.length > 0,
    staleTime: 2 * 60 * 1000
  });

  const { data: opexRaw = [] } = useQuery({
    queryKey: ['opex', selectedRestaurant, accessibleRestaurantIds],
    queryFn: async () => {
      if (selectedRestaurant !== "all") {
        return fetchAllRecords('OpEx', { restaurant_id: selectedRestaurant }, '-date');
      }
      const results = await fetchAllForRestaurants('OpEx', accessibleRestaurantIds, {}, '-date');
      return results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },
    enabled: accessibleRestaurantIds.length > 0,
    staleTime: 2 * 60 * 1000
  });



  // Aplicar filtro de fechas en cliente (más confiable)
  const sales = useMemo(() => filterByDateRange(salesRaw, 'date_time'), [salesRaw, dateRange]);
  const supplyCosts = useMemo(() => filterByDateRange(supplyCostsRaw, 'date'), [supplyCostsRaw, dateRange]);
  const opex = useMemo(() => filterByDateRange(opexRaw, 'date'), [opexRaw, dateRange]);


  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes', accessibleRestaurantIds],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        accessibleRestaurantIds.map(id => base44.entities.Recipe.filter({ restaurant_id: id }))
      );
      return results.flat();
    },
    enabled: accessibleRestaurantIds.length > 0,
    staleTime: 5 * 60 * 1000
  });

  const { data: supplyItems = [] } = useQuery({
    queryKey: ['supplyItems', accessibleRestaurantIds],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        accessibleRestaurantIds.map(id => base44.entities.SupplyItem.filter({ restaurant_id: id }))
      );
      return results.flat();
    },
    enabled: accessibleRestaurantIds.length > 0,
    staleTime: 5 * 60 * 1000
  });

  // Proveedores
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', accessibleRestaurantIds],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        accessibleRestaurantIds.map(id => base44.entities.Supplier.filter({ restaurant_id: id }))
      );
      return results.flat();
    },
    enabled: accessibleRestaurantIds.length > 0,
    staleTime: 5 * 60 * 1000
  });

  // Mutations
  const createSaleMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Sale.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setIsDialogOpen(false);
      setEditingItem(null);
    }
  });

  const updateSaleMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Sale.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setIsDialogOpen(false);
      setEditingItem(null);
    }
  });

  const createSupplyCostMutation = useMutation({
    mutationFn: async (data) => {
      // Extraer items para stock ANTES de limpiar
      const invoiceItems = data._invoice_items;
      
      // Limpiar campos internos
      delete data._editType; delete data._type; delete data._typeLabel;
      delete data._originalPaymentStatus; delete data._originalStockUpdated;
      delete data._invoice_items; delete data._skipAutoSupplier;

      const subtotal = parseFloat(data.subtotal) || 0;
      const taxRate = data.is_tax_exempt ? 0 : (parseFloat(data.tax_rate) || 19);
      const taxAmount = data.is_tax_exempt ? 0 : Math.round(subtotal * (taxRate / 100));
      const totalCost = subtotal + taxAmount;
      const paymentDate = data.payment_status === 'pagado' 
        ? (data.payment_date || data.date || new Date().toISOString().split('T')[0])
        : data.payment_date;

      const supplyData = {
        ...data,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_cost: totalCost,
        supply_type: data.supply_type || 'ingredients',
        payment_date: paymentDate,
        received_by_name: user?.display_name || user?.full_name || '',
        received_by_email: user?.email || ''
      };

      // Auto-crear proveedor si no existe — match by RUT first, then name
      if (supplyData.supplier && supplyData.restaurant_id && !data._skipAutoSupplier) {
        const nR = (r) => (r || '').replace(/[\.\s\-]/g, '').toLowerCase().trim();
        const sRut = nR(supplyData.supplier_tax_id);
        const rS = suppliers.filter(s => s.restaurant_id === supplyData.restaurant_id);
        const ex = sRut ? rS.find(s => nR(s.tax_id) === sRut) : rS.find(s => s.name?.toLowerCase().trim() === supplyData.supplier.toLowerCase().trim());
        if (!ex) {
          await base44.entities.Supplier.create({ restaurant_id: supplyData.restaurant_id, name: supplyData.supplier, tax_id: supplyData.supplier_tax_id || '', supply_categories: supplyData.supply_category ? [supplyData.supply_category] : [], is_active: true });
          queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        } else {
          const u = {};
          if (sRut && ex.name !== supplyData.supplier) u.name = supplyData.supplier;
          if (supplyData.supply_category && !ex.supply_categories?.includes(supplyData.supply_category)) u.supply_categories = [...(ex.supply_categories || []), supplyData.supply_category];
          if (!ex.tax_id && supplyData.supplier_tax_id) u.tax_id = supplyData.supplier_tax_id;
          if (Object.keys(u).length > 0) { await base44.entities.Supplier.update(ex.id, u); queryClient.invalidateQueries({ queryKey: ['suppliers'] }); }
        }
      }

      // Determinar lista de items a actualizar en stock
      // Use _invoice_items (from invoice or manual form), or fall back to single item fields
      const stockItemsToUpdate = invoiceItems && invoiceItems.length > 0
        ? invoiceItems.filter(item => item.name && item.quantity > 0)
        : (supplyData.supply_item_name && supplyData.quantity_purchased > 0
          ? [{ name: supplyData.supply_item_name, quantity: supplyData.quantity_purchased, received_quantity: supplyData.quantity_received ?? supplyData.quantity_purchased, unit: supplyData.unit_of_measure || 'kg', subtotal: subtotal, category: supplyData.supply_category || '' }]
          : []);

      // Auto-resolver destino contable por categoría
      const _r = accessibleRestaurants.find(r => r.id === data.restaurant_id);
      const _ct = _resolveCostType(data.supply_category, _r?.config?.supply_categories || []);
      supplyData.cost_type = _ct.cost_type;
      if (_ct.cost_type === 'cost_center') { supplyData.cost_center_name = _ct.cost_center_name; supplyData.cost_center_category = _ct.cost_center_category; }

      if (supplyData.payment_status === 'pagado' && stockItemsToUpdate.length > 0) {
        await processStockForNewPurchase({
          stockItems: stockItemsToUpdate,
          supplyData,
          supplyItemsList: supplyItems,
          paymentDate,
          queryClient
        });
        supplyData.stock_updated = true;
      }
      
      return await base44.entities.SupplyCost.create(supplyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplyCosts'] });
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setIsDialogOpen(false);
      setEditingItem(null);
      setManualPurchaseType(null);
    }
  });

  const updateSupplyCostMutation = useMutation({
    mutationFn: async ({ id, data, previousStatus, previousStockUpdated, previousData }) => {
      // Extraer items for stock BEFORE cleaning
      const invoiceItems = data._invoice_items;
      
      // Limpiar campos internos
      delete data._editType;
      delete data._type;
      delete data._typeLabel;
      delete data._originalPaymentStatus;
      delete data._originalStockUpdated;
      delete data._invoice_items;

      // Calcular impuesto y total automáticamente
      const subtotal = parseFloat(data.subtotal) || 0;
      const taxRate = data.is_tax_exempt ? 0 : (parseFloat(data.tax_rate) || 19);
      const taxAmount = data.is_tax_exempt ? 0 : Math.round(subtotal * (taxRate / 100));
      const totalCost = subtotal + taxAmount;

      // Asegurar payment_date si está pagado
      const paymentDate = data.payment_status === 'pagado' 
        ? (data.payment_date || data.date || new Date().toISOString().split('T')[0])
        : data.payment_date;

      const updateData = {
        ...data,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_cost: totalCost,
        payment_date: paymentDate,
        received_by_name: data.received_by_name || user?.display_name || user?.full_name || '',
        received_by_email: data.received_by_email || user?.email || ''
      };

      // Determinar items a actualizar stock (multi-item o single)
      const stockItemsToUpdate = invoiceItems && invoiceItems.length > 0
        ? invoiceItems.filter(item => item.name && item.quantity > 0)
        : (updateData.supply_item_name && updateData.quantity_purchased > 0
          ? [{ name: updateData.supply_item_name, quantity: updateData.quantity_purchased, received_quantity: updateData.quantity_received ?? updateData.quantity_purchased, unit: updateData.unit_of_measure || 'kg', subtotal: subtotal, category: updateData.supply_category || '' }]
          : []);

      // CASE 1: First-time stock (pendiente → pagado)
      const isFirstTimeStock = (
        stockItemsToUpdate.length > 0 && 
        updateData.payment_status === 'pagado' && 
        !previousStockUpdated
      );

      // CASE 2: Rectification of already-processed purchase
      const isRectification = (
        stockItemsToUpdate.length > 0 &&
        updateData.payment_status === 'pagado' &&
        previousStockUpdated &&
        previousData
      );

      // Auto-resolver destino contable por categoría (igual que en create)
      const _rUpd = accessibleRestaurants.find(r => r.id === updateData.restaurant_id);
      const _ctUpd = _resolveCostType(updateData.supply_category, _rUpd?.config?.supply_categories || []);
      updateData.cost_type = _ctUpd.cost_type;
      if (_ctUpd.cost_type === 'cost_center') { updateData.cost_center_name = _ctUpd.cost_center_name; updateData.cost_center_category = _ctUpd.cost_center_category; }
      else { updateData.cost_center_name = ''; updateData.cost_center_category = ''; }

      if (isFirstTimeStock) {
        await processStockForNewPurchase({
          stockItems: stockItemsToUpdate,
          supplyData: updateData,
          supplyItemsList: supplyItems,
          paymentDate,
          queryClient
        });
        updateData.stock_updated = true;
      } else if (isRectification) {
        await processStockRectification({
          stockItems: stockItemsToUpdate,
          updateData,
          previousData,
          supplyItemsList: supplyItems,
          paymentDate
        });
      }
      
      return base44.entities.SupplyCost.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplyCosts'] });
      queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setIsDialogOpen(false);
      setEditingItem(null);
    }
  });

  const generateFutureDates = (startDate, period, count = 3) => {
    const dates = [];
    for (let i = 1; i <= count; i++) {
      const next = new Date(startDate);
      if (period === 'weekly') next.setDate(next.getDate() + 7 * i);
      else if (period === 'monthly') next.setMonth(next.getMonth() + i);
      else if (period === 'quarterly') next.setMonth(next.getMonth() + 3 * i);
      else if (period === 'yearly') next.setFullYear(next.getFullYear() + i);
      dates.push(next.toISOString().split('T')[0]);
    }
    return dates;
  };

  const createOpExMutation = useMutation({
    mutationFn: async (data) => {
      const cleanData = { ...data };
      delete cleanData._editType; delete cleanData._type; delete cleanData._typeLabel;
      delete cleanData._originalPaymentStatus; delete cleanData._originalStockUpdated;
      delete cleanData._skipAutoSupplier;

      // Calcular impuesto y total automáticamente
      const subtotal = parseFloat(cleanData.subtotal) || 0;
      const taxRate = cleanData.is_tax_exempt ? 0 : (parseFloat(cleanData.tax_rate) || 19);
      const taxAmount = cleanData.is_tax_exempt ? 0 : Math.round(subtotal * (taxRate / 100));
      const totalAmount = subtotal + taxAmount;

      // Asegurar que payment_date se establezca si está pagado
      const paymentDate = cleanData.payment_status === 'pagado' 
        ? (cleanData.payment_date || cleanData.date || new Date().toISOString().split('T')[0])
        : cleanData.payment_date;

      // Resolver type desde cost_center_name si no viene explícito
      let resolvedType = cleanData.type || 'other';
      if (cleanData.cost_center_name) {
        const restId = cleanData.restaurant_id;
        const restConfig = accessibleRestaurants.find(r => r.id === restId)?.config;
        const allCenters = restConfig?.cost_centers || [];
        const matchedCenter = allCenters.find(c => c.name === cleanData.cost_center_name);
        if (matchedCenter?.opex_type) resolvedType = matchedCenter.opex_type;
      }

      const opexData = {
        ...cleanData,
        type: resolvedType,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        amount: totalAmount,
        payment_date: paymentDate,
        payment_due_date: cleanData.payment_due_date || ''
      };

      // Auto-crear proveedor OPEX si no existe (skip if dialog will handle it)
      if (opexData.supplier && opexData.restaurant_id && !data._skipAutoSupplier) {
        const existingSupplier = suppliers.find(s => s.name?.toLowerCase().trim() === opexData.supplier.toLowerCase().trim() && s.restaurant_id === opexData.restaurant_id);
        if (!existingSupplier) {
          const opexCats = opexData.cost_center_name ? [{ cost_center: opexData.cost_center_name, category: opexData.category || '' }] : [];
          await base44.entities.Supplier.create({ restaurant_id: opexData.restaurant_id, name: opexData.supplier, tax_id: opexData.supplier_tax_id || '', supplier_type: 'opex', opex_categories: opexCats, is_active: true });
          queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        }
      }
      const result = await base44.entities.OpEx.create(opexData);

      // Si es recurrente y quiere generar futuros, crear los siguientes
      if (opexData.is_recurring && opexData.generate_future && opexData.recurrence_period) {
        const count = parseInt(opexData.future_count) || 3;
        const futureDates = generateFutureDates(opexData.date, opexData.recurrence_period, count);
        const futureRecords = futureDates.map(date => ({
          ...opexData,
          date,
          generate_future: undefined,
          future_count: undefined
        }));

        if (futureRecords.length > 0) {
          await base44.entities.OpEx.bulkCreate(futureRecords);
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opex'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setIsDialogOpen(false);
      setEditingItem(null);
      setManualPurchaseType(null);
    }
  });

  const updateOpExMutation = useMutation({
    mutationFn: ({ id, data }) => {
      // Limpiar campos internos
      delete data._editType;
      delete data._type;
      delete data._typeLabel;
      delete data._originalPaymentStatus;
      delete data._originalStockUpdated;

      const subtotal = parseFloat(data.subtotal) || 0;
      const taxRate = data.is_tax_exempt ? 0 : (parseFloat(data.tax_rate) || 19);
      const taxAmount = data.is_tax_exempt ? 0 : Math.round(subtotal * (taxRate / 100));
      const totalAmount = subtotal + taxAmount;

      const paymentDate = data.payment_status === 'pagado'
        ? (data.payment_date || data.date || new Date().toISOString().split('T')[0])
        : data.payment_date;

      let resolvedType = data.type || 'other';
      if (data.cost_center_name) {
        const restConfig = accessibleRestaurants.find(r => r.id === data.restaurant_id)?.config;
        const matchedCenter = (restConfig?.cost_centers || []).find(c => c.name === data.cost_center_name);
        if (matchedCenter?.opex_type) resolvedType = matchedCenter.opex_type;
      }

      return base44.entities.OpEx.update(id, {
        ...data,
        type: resolvedType,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        amount: totalAmount,
        payment_date: paymentDate,
        payment_due_date: data.payment_due_date || ''
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opex'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setIsDialogOpen(false);
      setEditingItem(null);
      setManualPurchaseType(null);
    }
  });



  const deleteSaleMutation = useMutation({
    mutationFn: (id) => base44.entities.Sale.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales'] })
  });

  const deleteSupplyCostMutation = useMutation({
    mutationFn: (id) => base44.entities.SupplyCost.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplyCosts'] })
  });

  const deleteOpExMutation = useMutation({
    mutationFn: (id) => base44.entities.OpEx.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opex'] })
  });



  // Form configurations
  const getFormConfig = () => {
    const restaurantField = {
      name: 'restaurant_id',
      label: 'Restaurante',
      type: 'select',
      required: true,
      options: accessibleRestaurants.map(r => ({ value: r.id, label: r.name }))
    };

    // Si estamos editando un item de purchases, devolver el config correcto
    if (activeTab === 'purchases' && editingItem?._editType) {
      const restId = editingItem?.restaurant_id || targetRestaurantId || (selectedRestaurant !== 'all' ? selectedRestaurant : '');
      const restConfig = accessibleRestaurants.find(r => r.id === restId)?.config;

      if (editingItem._editType === 'supply') {
        const supplyCategories = (restConfig?.supply_categories || []).map(c => {
          const name = typeof c === 'string' ? c : c?.name || '';
          return { value: name, label: name };
        }).filter(c => c.value);
        // Obtener lista de insumos del restaurante para autocompletado
        const restSupplyItems = supplyItems.filter(s => s.restaurant_id === restId);
        const supplyItemOptions = restSupplyItems.map(s => ({ value: s.name, label: `${s.name} (${s.unit_of_measure})` }));

        return {
          title: 'Compra de Suministro',
          fields: [
            restaurantField,
            { name: 'date', label: 'Fecha de compra', type: 'date', required: true },
            { name: 'supply_category', label: 'Categoría de Insumo', type: supplyCategories.length > 0 ? 'select' : 'text', required: true,
              ...(supplyCategories.length > 0 ? { options: supplyCategories } : { placeholder: 'Ej: Verduras, Carnes, Lácteos' })
            },
            { name: 'supply_item_name', label: 'Insumo (para actualizar stock)', type: supplyItemOptions.length > 0 ? 'select' : 'text',
              ...(supplyItemOptions.length > 0 ? { options: supplyItemOptions } : { placeholder: 'Nombre del insumo' })
            },
            { name: 'quantity_purchased', label: 'Cantidad comprada', type: 'number', step: '0.01', placeholder: '0' },
            { name: 'unit_of_measure', label: 'Unidad', type: 'select',
              options: [
                { value: 'kg', label: 'kg' }, { value: 'g', label: 'g' },
                { value: 'L', label: 'L' }, { value: 'ml', label: 'ml' },
                { value: 'unidad', label: 'unidad' }, { value: 'docena', label: 'docena' },
                { value: 'lb', label: 'lb' }, { value: 'oz', label: 'oz' }
              ]
            },
            { name: 'subtotal', label: `Monto Neto (sin IVA) — ${getCurrencySymbol(selectedCurrency)}`, type: 'number', required: true, step: '0.01', placeholder: '0.00' },
            { name: 'is_tax_exempt', label: 'Exento de Impuesto', type: 'switch', switchLabel: 'Compra exenta de IVA' },
            { name: 'supplier', label: 'Proveedor', type: 'text', placeholder: 'Nombre del proveedor' },
            { name: 'supplier_tax_id', label: 'RUT Proveedor', type: 'text', placeholder: 'Ej: 12.345.678-9' },
            { name: 'invoice_number', label: 'No. Factura', type: 'text', placeholder: 'Número de factura' },
            { name: 'payment_status', label: 'Estado de Pago', type: 'select', required: true,
              options: [
                { value: 'pagado', label: '✅ Pagado' },
                { value: 'pendiente', label: '⏳ Pendiente' }
              ]
            },
            { name: 'payment_date', label: 'Fecha de Pago', type: 'date',
              conditionalDisplay: (values) => values.payment_status === 'pagado'
            },
            { name: 'notes', label: 'Detalle de compra', type: 'textarea', placeholder: 'Ej: 5kg tomates, 2 lechugas, 1kg cebolla' }
          ],
          createMutation: createSupplyCostMutation,
          updateMutation: updateSupplyCostMutation
        };
      } else {
        const opexCostCenters = (restConfig?.cost_centers || [])
          .filter(c => c.type === 'opex')
          .map(c => ({ value: c.name, label: c.name, opexType: c.opex_type || 'other', categories: c.categories || [] }));

        const allCenterCategories = {};
        opexCostCenters.forEach(c => {
          if (c.categories?.length > 0) allCenterCategories[c.value] = c.categories;
        });

        return {
          title: 'Gasto Operativo',
          fields: [
            restaurantField,
            { name: 'date', label: 'Fecha del gasto', type: 'date', required: true },
            { name: 'cost_center_name', label: 'Centro de Costo', type: 'select', required: true,
              options: opexCostCenters.length > 0 
                ? opexCostCenters.map(c => ({ value: c.value, label: c.label }))
                : Object.entries(opexTypeLabels).map(([value, label]) => ({ value: label, label }))
            },
            { name: 'category', label: 'Categoría', type: 'dynamicSelect',
              getOptions: (values) => {
                const cats = allCenterCategories[values.cost_center_name] || [];
                return cats.map(c => ({ value: c, label: c }));
              },
              conditionalDisplay: (values) => {
                const cats = allCenterCategories[values.cost_center_name];
                return cats && cats.length > 0;
              }
            },
            { name: 'description', label: 'Descripción / Detalle', type: 'textarea', placeholder: 'Descripción del gasto' },
            { name: 'supplier', label: 'Proveedor', type: 'text', placeholder: 'Nombre del proveedor' },
            { name: 'supplier_tax_id', label: 'RUT Proveedor', type: 'text', placeholder: 'Ej: 12.345.678-9' },
            { name: 'invoice_number', label: 'No. Factura', type: 'text', placeholder: 'Número de factura' },
            { name: 'subtotal', label: `Monto Neto (sin IVA) — ${getCurrencySymbol(selectedCurrency)}`, type: 'number', required: true, step: '0.01', placeholder: '0.00' },
            { name: 'is_tax_exempt', label: 'Exento de IVA', type: 'switch', switchLabel: 'Gasto exento de IVA' },
            { name: 'payment_status', label: 'Estado de Pago', type: 'select', required: true,
              options: [
                { value: 'pagado', label: '✅ Pagado' },
                { value: 'pendiente', label: '⏳ Pendiente' }
              ]
            },
            { name: 'payment_date', label: 'Fecha de Pago', type: 'date',
              conditionalDisplay: (values) => values.payment_status === 'pagado'
            }
          ],
          createMutation: createOpExMutation,
          updateMutation: updateOpExMutation
        };
      }
    }

    const configs = {
      sales: {
        title: 'Venta',
        fields: [
          restaurantField,
          { name: 'date', label: 'Fecha', type: 'date', required: true },
          { name: 'product_name', label: 'Producto (Receta)', type: 'select', required: true,
            options: recipes
              .filter(r => selectedRestaurant === 'all' || r.restaurant_id === selectedRestaurant)
              .map(r => ({ value: r.dish_name, label: `${r.dish_name} - $${(r.sale_price || 0).toLocaleString()}` }))
          },
          { name: 'category', label: 'Categoría', type: 'select', required: true,
            options: Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))
          },
          { name: 'quantity', label: 'Cantidad', type: 'number', placeholder: '1', required: true },
          { name: 'amount', label: 'Monto Neto', type: 'number', required: true, step: '0.01', placeholder: '0.00' },
          { name: 'is_tax_exempt', label: 'Exento de Impuesto', type: 'switch', switchLabel: 'Esta venta está exenta de impuestos (19%)' },
          { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Notas adicionales...' }
        ],
        createMutation: createSaleMutation,
        updateMutation: updateSaleMutation
      },
        supplies: (() => {
        const supplyCategories = [];
        accessibleRestaurants.forEach(r => {
          (r.config?.supply_categories || []).forEach(c => {
            const name = typeof c === 'string' ? c : c?.name || '';
            if (name && !supplyCategories.find(s => s.value === name)) supplyCategories.push({ value: name, label: name });
          });
        });
        return {
          title: 'Costo de Suministro',
          fields: [
            restaurantField,
            { name: 'date', label: 'Fecha', type: 'date', required: true },
            { name: 'supply_category', label: 'Categoría de Insumo', type: supplyCategories.length > 0 ? 'select' : 'text', required: true,
              ...(supplyCategories.length > 0 ? { options: supplyCategories } : { placeholder: 'Ej: Verduras, Carnes, Lácteos' })
            },
            { name: 'subtotal', label: 'Subtotal (sin IVA)', type: 'number', required: true, step: '0.01', placeholder: '0.00' },
            { name: 'is_tax_exempt', label: 'Exento de Impuesto', type: 'switch', switchLabel: 'Esta compra está exenta de impuestos (19%)' },
            { name: 'supplier', label: 'Proveedor', type: 'text', placeholder: 'Nombre del proveedor (opcional)' },
            { name: 'invoice_number', label: 'No. Factura', type: 'text', placeholder: 'Número de factura (opcional)' },
            { name: 'notes', label: 'Detalle', type: 'textarea', placeholder: 'Ej: 5kg tomates, 2 lechugas, 1kg cebolla' }
          ],
          createMutation: createSupplyCostMutation,
          updateMutation: updateSupplyCostMutation
        };
      })(),
      opex: (() => {
        const opexCostCenters = [];
        accessibleRestaurants.forEach(r => {
          (r.config?.cost_centers || []).filter(c => c.type === 'opex').forEach(c => {
            if (!opexCostCenters.find(o => o.value === c.name)) {
              opexCostCenters.push({ value: c.name, label: c.name, opexType: c.opex_type || 'other', categories: c.categories || [] });
            }
          });
        });
        return {
          title: 'Gasto Operativo',
          fields: [
            restaurantField,
            { name: 'date', label: 'Fecha', type: 'date', required: true },
            { name: 'cost_center_name', label: 'Centro de Costo', type: 'select', required: true,
              options: opexCostCenters.length > 0 
                ? opexCostCenters.map(c => ({ value: c.value, label: c.label }))
                : Object.entries(opexTypeLabels).map(([value, label]) => ({ value: label, label }))
            },
            { name: 'description', label: 'Descripción / Detalle', type: 'textarea', placeholder: 'Descripción o detalle del gasto' },
            { name: 'supplier', label: 'Proveedor', type: 'text', placeholder: 'Nombre del proveedor (opcional)' },
            { name: 'invoice_number', label: 'No. Factura', type: 'text', placeholder: 'Número de factura (opcional)' },
            { name: 'subtotal', label: 'Subtotal (sin IVA)', type: 'number', required: true, step: '0.01', placeholder: '0.00' },
            { name: 'is_tax_exempt', label: 'Exento de IVA', type: 'switch', switchLabel: 'Este gasto está exento de impuestos (19%)' },
            { name: 'payment_status', label: 'Estado de Pago', type: 'select', required: true,
              options: [
                { value: 'pendiente', label: '⏳ Pendiente' },
                { value: 'pagado', label: '✅ Pagado' }
              ]
            },
            { name: 'payment_date', label: 'Fecha de Pago', type: 'date',
              conditionalDisplay: (values) => values.payment_status === 'pagado'
            }
          ],
          createMutation: createOpExMutation,
          updateMutation: updateOpExMutation
        };
      })(),

    };

    return configs[activeTab];
  };

  const handleSubmit = (data) => {
    const config = getFormConfig();
    
    // Si es suministro y se seleccionó "nuevo", usar el nombre ingresado
    if (activeTab === 'supplies' && data.supply_name === '__new__') {
      data.supply_name = data.new_supply_name;
      delete data.new_supply_name;
    }
    
    // Si es venta, auto-completar categoría y precio desde la receta
    if (activeTab === 'sales' && data.product_name) {
      const recipe = recipes.find(r => r.dish_name === data.product_name);
      if (recipe) {
        data.category = data.category || recipe.category;
        if (!data.amount && recipe.sale_price) {
          data.amount = recipe.sale_price * (data.quantity || 1);
        }
      }
    }

    // Limpiar campos internos antes de enviar
    const cleanData = { ...data };
    delete cleanData._type;
    delete cleanData._typeLabel;
    delete cleanData._editType;
    
    if (editingItem?.id) {
      // Pasar estado previo para detectar cambio pendiente -> pagado
      // Usar los valores originales del item ANTES de editar
      config.updateMutation.mutate({ 
        id: editingItem.id, 
        data: cleanData,
        previousStatus: editingItem._originalPaymentStatus || editingItem.payment_status,
        previousStockUpdated: editingItem._originalStockUpdated ?? editingItem.stock_updated,
        previousData: editingItem._previousData || null
      });
    } else {
      config.createMutation.mutate(cleanData);
    }
  };

  const handleEdit = (item) => {
    // Para la vista de purchases, determinar si es supply u opex
    // Guardar estado original para detectar cambios al guardar
    // Save a snapshot of the original data for rectification logic
    const previousDataSnapshot = {
      invoice_items: item.invoice_items ? JSON.parse(JSON.stringify(item.invoice_items)) : null,
      supply_item_name: item.supply_item_name,
      quantity_purchased: item.quantity_purchased,
      quantity_received: item.quantity_received,
      invoice_number: item.invoice_number,
    };
    
    if (activeTab === 'purchases' && item._type) {
      setEditingItem({ 
        ...item, 
        _editType: item._type,
        _originalPaymentStatus: item.payment_status,
        _originalStockUpdated: item.stock_updated,
        _previousData: previousDataSnapshot
      });
    } else {
      setEditingItem({
        ...item,
        _originalPaymentStatus: item.payment_status,
        _originalStockUpdated: item.stock_updated,
        _previousData: previousDataSnapshot
      });
    }
    setIsDialogOpen(true);
  };

  const handleDelete = (id, type) => {
    setDeleteConfirm({ open: true, id, type: type || null });
  };

  const confirmDelete = () => {
    const { id, type } = deleteConfirm;
    if (type === 'supply') { deleteSupplyCostMutation.mutate(id); }
    else if (type === 'opex') { deleteOpExMutation.mutate(id); }
    else {
      const mutations = {
        sales: deleteSaleMutation,
        supplies: deleteSupplyCostMutation,
        opex: deleteOpExMutation,
      };
      mutations[activeTab]?.mutate(id);
    }
    setDeleteConfirm({ open: false, id: null, type: null });
  };

  const getRestaurantName = (id) => restaurants.find(r => r.id === id)?.name || '—';

  // Table columns
  // Helper para formatear fechas en la zona horaria del usuario

  const safeFormatDate = (v, dateFormat = 'dd/MM/yy') => {
    if (!v) return '—';

    // Si es solo fecha (YYYY-MM-DD), NO usar new Date() que interpreta como UTC
    // y causa desfase de un día en zonas horarias negativas como Chile
    const isDateOnly = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    
    if (isDateOnly) {
      const [year, month, day] = v.split('-');
      if (dateFormat === 'dd/MM/yy') return `${day}/${month}/${year.slice(-2)}`;
      if (dateFormat === 'dd/MM/yyyy') return `${day}/${month}/${year}`;
      return `${day}/${month}/${year}`;
    }

    // Para datetime (ISO con T), usar conversión de zona horaria
    const date = new Date(v);
    if (isNaN(date.getTime())) return '—';

    if (dateFormat === 'dd/MM/yy') {
      return new Intl.DateTimeFormat('es-CL', {
        timeZone: userTimezone, day: '2-digit', month: '2-digit', year: '2-digit'
      }).format(date);
    }
    if (dateFormat === 'dd/MM/yyyy') {
      return new Intl.DateTimeFormat('es-CL', {
        timeZone: userTimezone, day: '2-digit', month: '2-digit', year: 'numeric'
      }).format(date);
    }
    if (dateFormat === 'HH:mm') {
      return new Intl.DateTimeFormat('es-CL', {
        timeZone: userTimezone, hour: '2-digit', minute: '2-digit', hour12: false
      }).format(date);
    }

    // Fallback
    return new Intl.DateTimeFormat('es-CL', { timeZone: userTimezone }).format(date);
  };

  const salesColumns = [
    { key: 'date_time', label: 'Fecha', render: (v) => (
      <div className="text-xs">
        <div className="font-medium">{safeFormatDate(v, 'dd/MM/yy')}</div>
        <div className="text-gray-400">{safeFormatDate(v, 'HH:mm')}</div>
      </div>
    )},
    { key: 'transaction_id', label: 'ID', render: (v) => (
      <span className="text-xs font-mono bg-gray-100 px-1 rounded">{v?.slice(-6) || '—'}</span>
    )},
    { key: 'products', label: 'Productos', render: (products) => {
      if (!products?.length) return '—';
      // Show main products (non-extras) with their extras grouped below
      const mainProducts = products.filter(p => !p.is_extra);
      const extras = products.filter(p => p.is_extra);
      const displayLimit = 4;
      const mainToShow = mainProducts.slice(0, displayLimit);
      const remainingMain = mainProducts.length - mainToShow.length;
      
      return (
        <div className="max-w-[220px]">
          <div className="text-xs space-y-0.5">
            {mainToShow.map((p, i) => {
              // Find extras that follow this main product (by position in original array)
              const mainIdx = products.indexOf(p);
              const relatedExtras = [];
              for (let j = mainIdx + 1; j < products.length; j++) {
                if (products[j].is_extra) relatedExtras.push(products[j]);
                else break;
              }
              return (
                <div key={i}>
                  <div className={`${p.is_cancelled ? 'line-through text-gray-400' : 'font-medium'}`}>
                    {p.product_name} {p.quantity > 1 ? `(x${p.quantity})` : ''}
                  </div>
                  {relatedExtras.slice(0, 3).map((e, ei) => (
                    <div key={ei} className={`pl-3 text-purple-600 ${e.is_cancelled ? 'line-through text-gray-400' : ''}`}>
                      ↳ {e.product_name}
                    </div>
                  ))}
                  {relatedExtras.length > 3 && (
                    <div className="pl-3 text-gray-400">+{relatedExtras.length - 3} más</div>
                  )}
                </div>
              );
            })}
            {remainingMain > 0 && (
              <span className="text-gray-400 text-xs">+{remainingMain} productos más</span>
            )}
            {mainProducts.length === 0 && extras.length > 0 && extras.slice(0, 3).map((e, i) => (
              <div key={i} className={`pl-2 text-purple-600 ${e.is_cancelled ? 'line-through text-gray-400' : ''}`}>
                ↳ {e.product_name}
              </div>
            ))}
          </div>
        </div>
      );
    }},
    { key: 'room', label: 'Sala/Mesa', render: (v, row) => (
      <div className="text-xs">
        <div className="font-medium">{v || '—'}</div>
        {row.table_number && <span className="text-gray-400">Mesa {row.table_number}</span>}
      </div>
    )},
    { key: 'num_guests', label: 'Pers.', render: (v) => (
      <span className="text-xs text-center block font-medium">{v || '—'}</span>
    )},
    { key: 'waiter_name', label: 'Camarero', render: (v) => (
      <span className="text-xs truncate max-w-[80px] block">{v || '—'}</span>
    )},
    { key: 'sale_type', label: 'Tipo', render: (v, row) => (
      <div className="text-xs">
        <Badge variant="outline" className={`${v === 'delivery' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50'}`}>
          {v === 'delivery' ? 'Delivery' : 'Local'}
        </Badge>
        {v === 'delivery' && row.delivery_source && (
          <div className="text-gray-400 mt-0.5">{row.delivery_source}</div>
        )}
      </div>
    )},
    { key: 'payment_method', label: 'Pago', render: (v) => (
      <Badge variant="secondary" className="text-xs capitalize">{v || '—'}</Badge>
    )},
    { key: 'discount_amount', label: 'Dcto', render: (v, row) => (
      <div className="text-xs">
        {v > 0 || row.discount_percentage > 0 ? (
          <span className="text-red-500 font-medium">
            -{row.discount_percentage > 0 ? `${row.discount_percentage}%` : formatCurrency(v, selectedCurrency)}
          </span>
        ) : '—'}
      </div>
    )},
    { key: 'tip_amount', label: 'Propina', render: (v) => (
      <span className="text-xs">{v > 0 ? <span className="text-amber-600 font-medium">{formatCurrency(v, selectedCurrency)}</span> : '—'}</span>
    )},
    { key: 'total_amount', label: 'Total', render: (v, row) => (
      <div className="text-right">
        <div className="font-bold text-emerald-600">{formatCurrency(v || 0, selectedCurrency)}</div>
        {row.is_cancelled && <Badge variant="destructive" className="text-xs mt-0.5">Cancelada</Badge>}
      </div>
    )},
    { key: 'actions', label: '', sortable: false, render: (_, row) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}><Edit className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
      </div>
    )}
  ];

  const recurrenceLabels = {
    weekly: 'Semanal',
    monthly: 'Mensual', 
    quarterly: 'Trimestral',
    yearly: 'Anual'
  };

  // Combinar suministros y opex para la vista unificada
  const purchasesDataAll = [
    ...supplyCosts.map(s => ({ ...s, _type: 'supply', _typeLabel: 'Suministro' })),
    ...opex.map(o => ({ ...o, _type: 'opex', _typeLabel: 'Gasto Op.' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const purchasesData = pendingFilter 
    ? purchasesDataAll.filter(p => p.payment_status === 'pendiente')
    : purchasesDataAll;
  
  const pendingCount = purchasesDataAll.filter(p => p.payment_status === 'pendiente').length;

  // Columnas para Compras y Gastos - ALINEADO con plantilla XLSX
  // Plantilla: fecha, proveedor, rut_proveedor, numero_factura, monto_neto, exento_iva, iva, detalles_compra, cantidad, unidad, centro_costo, fecha_pago, estado_pago, comprador
  const purchasesColumns = [
    { key: 'date', label: 'Fecha', render: (v) => safeFormatDate(v, 'dd/MM/yyyy') },
    { key: '_typeLabel', label: 'Tipo', render: (v, row) => (
      <Badge variant="secondary" className={row._type === 'supply' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}>
        {v}
      </Badge>
    )},
    { key: 'supply_category', label: 'Centro de Costo', render: (v, row) => (
      <span className="text-xs font-medium">{row._type === 'supply' 
        ? (row.cost_type === 'cost_center' ? (row.cost_center_name || 'Centro de Costo') : 'FOOD COST') 
        : (row.cost_center_name || opexTypeLabels[row.type] || row.type)}</span>
    )},
    { key: '_category_detail', label: 'Categoría', render: (_, row) => (
      <span className="text-xs text-gray-600">{row._type === 'supply' ? (row.supply_category || '—') : (row.category || row.description?.substring(0, 30) || '—')}</span>
    )},
    { key: 'supplier', label: 'Proveedor', render: (v) => (
      <span className="text-xs truncate max-w-[100px] block">{v || '—'}</span>
    )},
    { key: 'supplier_tax_id', label: 'RUT Proveedor', render: (v) => (
      <span className="text-xs font-mono text-gray-500">{v || '—'}</span>
    )},
    { key: 'invoice_number', label: 'Factura', render: (v) => (
      <span className="text-xs font-mono text-gray-500">{v || '—'}</span>
    )},
    { key: 'notes', label: 'Insumo / Detalle', render: (v, row) => {
      if (row._type === 'supply') {
        const names = (row.invoice_items || []).map(i => i.name).filter(Boolean);
        if (names.length === 1) return <span className="text-xs font-medium text-gray-800">{names[0]}</span>;
        if (names.length > 1) return <span className="text-xs text-gray-800" title={names.join(', ')}><span className="font-medium">{names[0]}</span> <span className="text-gray-400">+{names.length - 1}</span></span>;
        if (row.supply_item_name) return <span className="text-xs font-medium text-gray-800">{row.supply_item_name}</span>;
      }
      return <span className="text-xs text-gray-600 truncate max-w-[120px] block">{v || row.description || '—'}</span>;
    }},
    { key: 'subtotal', label: 'Neto', render: (v, row) => (
      <span className="text-xs">{formatCurrency(row._type === 'supply' ? (v || 0) : (row.subtotal || row.amount || 0), selectedCurrency)}</span>
    )},
    { key: 'tax_amount', label: 'IVA', render: (v, row) => {
      if (row.is_tax_exempt) return <Badge variant="outline" className="text-xs text-gray-400">Exento</Badge>;
      return <span className="text-xs text-amber-600">+{formatCurrency(v || 0, selectedCurrency)}</span>;
    }},
    { key: 'total_cost', label: 'Total', render: (v, row) => (
      <span className="font-semibold text-sm">
        {formatCurrency(row._type === 'supply' ? (v || 0) : (row.amount || 0), selectedCurrency)}
      </span>
    )},
    { key: 'payment_status', label: 'Estado', render: (v) => (
      <Badge variant="outline" className={v === 'pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
        {v === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'}
      </Badge>
    )},
    { key: 'received_by_name', label: 'Recibido por', render: (v, row) => (
      <span className="text-xs text-gray-600">{v || row.created_by?.split('@')[0] || '—'}</span>
    )},
    { key: 'actions', label: '', sortable: false, render: (_, row) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}><Edit className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id, row._type)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
      </div>
    )}
  ];

  // Smart search functions
  const salesSearchFn = (row, term) => {
    // Search by: transaction_id, products, room, table, waiter, payment_method, total, sale_type, delivery_source, notes
    const fields = [
      row.transaction_id,
      row.room,
      row.table_number,
      row.waiter_name,
      row.payment_method,
      row.sale_type === 'delivery' ? 'delivery' : 'local',
      row.delivery_source,
      row.notes,
      row.customer_name,
      row.total_amount != null ? String(row.total_amount) : null,
      row.num_guests != null ? String(row.num_guests) : null,
    ];
    // Search inside products array
    if (row.products?.length) {
      for (const p of row.products) {
        if (p.product_name?.toLowerCase().includes(term)) return true;
        if (p.category?.toLowerCase().includes(term)) return true;
      }
    }
    // Search in date formatted
    if (row.date_time) {
      const dateStr = safeFormatDate(row.date_time, 'dd/MM/yy');
      if (dateStr.toLowerCase().includes(term)) return true;
    }
    return fields.some(v => v != null && String(v).toLowerCase().includes(term));
  };

  const purchasesSearchFn = (row, term) => {
    // Search by: supplier, supplier_tax_id, invoice_number, notes, description, category, cost_center,
    // subtotal, total, received_by_name, payment_status, _typeLabel
    const fields = [
      row.supplier,
      row.supplier_tax_id,
      row.invoice_number,
      row.notes,
      row.description,
      row.supply_category,
      row.cost_center_name,
      row.category,
      row._typeLabel,
      row.received_by_name,
      row.payment_status === 'pagado' ? 'pagado' : 'pendiente',
      row.subtotal != null ? String(row.subtotal) : null,
      row.total_cost != null ? String(row.total_cost) : null,
      row.amount != null ? String(row.amount) : null,
      row.created_by,
    ];
    // Search in date formatted
    if (row.date) {
      const dateStr = safeFormatDate(row.date, 'dd/MM/yyyy');
      if (dateStr.toLowerCase().includes(term)) return true;
    }
    // Search in invoice_items names
    if (row.invoice_items?.length) {
      for (const item of row.invoice_items) {
        if (item.name?.toLowerCase().includes(term)) return true;
      }
    }
    return fields.some(v => v != null && String(v).toLowerCase().includes(term));
  };

  const tableConfigs = {
    sales: { data: sales, columns: salesColumns, searchFn: salesSearchFn },
    purchases: { data: purchasesData, columns: purchasesColumns, searchFn: purchasesSearchFn }
    // nps: { data: npsData, columns: npsColumns } // NPS deshabilitado temporalmente
  };

  const formConfig = getFormConfig();
  const tableConfig = tableConfigs[activeTab];
  const currentTabConfig = tabsConfig[activeTab];
  const TabIcon = currentTabConfig.icon;

  // Stats para el header (incluyendo impuestos)
  const getStats = () => {
    const activeSales = sales.filter(s => !s.is_cancelled);
    const salesTotalBruto = activeSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    // Venta Neta (sin IVA): misma fórmula que el Dashboard para consistencia
    const salesTotalNeto = activeSales.reduce((sum, s) => {
      const amt = s.total_amount || s.subtotal || 0;
      if (!amt) return sum;
      if (s.applies_tax === false) return sum + amt;
      return sum + Math.round(amt / (1 + (s.tax_rate || 19) / 100));
    }, 0);
    
    // Solo sumar gastos PAGADOS
    const suppliesTotal = supplyCosts
      .filter(c => c.payment_status === 'pagado')
      .reduce((sum, c) => sum + (c.total_cost || 0), 0);
    const opexTotal = opex
      .filter(o => o.payment_status === 'pagado')
      .reduce((sum, o) => sum + (o.amount || 0), 0);

    const stats = {
      sales: { count: activeSales.length, totalBruto: salesTotalBruto, totalNeto: salesTotalNeto },
      purchases: { count: supplyCosts.length + opex.length, total: suppliesTotal + opexTotal, label: 'Total Pagado' }
    };
    return stats[activeTab];
  };

  const stats = getStats();

  return (
    <div className="min-h-screen bg-noa-navy text-white">
      {/* Hero Header */}
      <PageHeader
        title="Ventas y Compras"
        subtitle="Administra la información de tu negocio"
        icon={Database}
        imageKey="dataManagement"
        gradient="from-blue-900/90 via-indigo-900/80 to-slate-900/70"
      >
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
              <RestaurantSelector
                restaurants={accessibleRestaurants}
                selectedId={selectedRestaurant}
                onChange={setSelectedRestaurant}
                className="bg-white/95 backdrop-blur-sm border-white/50 shadow-xl"
              />
              <RefreshButton
                queryKeys={['sales', 'supplyCosts', 'opex', 'nps', 'supplyItems', 'recipes', 'myRestaurants']}
                label="Actualizar"
                className="bg-white/95 backdrop-blur-sm text-gray-800 hover:bg-white shadow-lg border-0 rounded-xl"
              />
              <DateRangePicker
                value={dateRange.from ? { 
                  from: new Date(dateRange.from + 'T12:00:00'), 
                  to: dateRange.to ? new Date(dateRange.to + 'T12:00:00') : undefined 
                } : undefined}
                onChange={(range) => {
                  if (range?.from) {
                    // Usar formato local para evitar problemas de zona horaria
                    // Para endOfDay (23:59:59), usar la misma fecha base que from para evitar desfase
                    const fromDate = range.from;
                    const toDate = range.to || range.from;
                    
                    // Si to es endOfDay del mismo día que from, usar la misma fecha string
                    const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
                    const toStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
                    
                    setDateRange({ from: fromStr, to: toStr });
                  }
                }}
                className="bg-white/95 backdrop-blur-sm border-white/50 shadow-xl"
              />
              {/* Ventas: importar XLSX + FUDO */}
              {activeTab === 'sales' && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (selectedRestaurant === 'all') {
                        setSelectRestaurantDialog({ open: true, action: 'import_sales' });
                      } else {
                        setTargetRestaurantId(selectedRestaurant);
                        setImportDialogOpen(true);
                      }
                    }}
                    className="bg-white text-gray-800 hover:bg-gray-50 shadow-sm border border-gray-200"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Importar XLSX
                  </Button>
                  {/* Botón Sincronizar FUDO - solo si hay restaurante con FUDO conectado */}
                  {(() => {
                    const fudoRestaurants = accessibleRestaurants.filter(r => r.fudo_config?.is_connected);
                    if (fudoRestaurants.length === 0) return null;
                    
                    const targetRest = selectedRestaurant !== 'all' 
                      ? fudoRestaurants.find(r => r.id === selectedRestaurant) 
                      : fudoRestaurants[0];
                    
                    if (!targetRest) return null;

                    return (
                      <Button
                        onClick={() => {
                          if (selectedRestaurant === 'all' && fudoRestaurants.length > 1) {
                            setSelectRestaurantDialog({ open: true, action: 'sync_fudo' });
                          } else {
                            setFudoSyncRestaurant(targetRest);
                            setFudoSyncDialogOpen(true);
                          }
                        }}
                        className="bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 shadow-xl font-semibold"
                      >
                        <img 
                          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6945d758a942733d687ef522/ba83b59c1_Fudo_idmLSWpEZL_0.png"
                          alt="FUDO"
                          className="h-4 w-auto"
                        />
                        Sincronizar FUDO
                      </Button>
                    );
                  })()}
                </>
              )}
              {/* Compras y Gastos: importar XLSX unificado + añadir manual */}
              {activeTab === 'purchases' && (
                <>
                  <Button 
                    onClick={() => {
                      if (selectedRestaurant === 'all') {
                        setSelectRestaurantDialog({ open: true, action: 'upload_invoice' });
                      } else {
                        setInvoiceRestaurantId(selectedRestaurant);
                        setInvoiceDialogOpen(true);
                      }
                    }}
                    className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-xl"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Subir Factura IA
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (selectedRestaurant === 'all') {
                        setSelectRestaurantDialog({ open: true, action: 'import_purchases' });
                      } else {
                        setTargetRestaurantId(selectedRestaurant);
                        setPurchasesImportDialogOpen(true);
                      }
                    }}
                    className="bg-white text-gray-800 hover:bg-gray-50 shadow-xl border border-white/50"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Importar XLSX
                  </Button>
                  <Button 
                    onClick={() => {
                      if (selectedRestaurant === 'all') {
                        setSelectRestaurantDialog({ open: true, action: 'add_supply' });
                      } else {
                        setTargetRestaurantId(selectedRestaurant);
                        setManualPurchaseType('supply');
                        const todayStr = getTodayInUserTz(user);
                        setEditingItem({ 
                          _editType: 'supply', 
                          restaurant_id: selectedRestaurant,
                          date: todayStr,
                          payment_status: 'pagado',
                          payment_date: todayStr,
                          supply_type: 'ingredients'
                        });
                        setIsDialogOpen(true);
                      }
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white shadow-xl"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Compra
                  </Button>
                  <Button 
                    onClick={() => {
                      if (selectedRestaurant === 'all') {
                        setSelectRestaurantDialog({ open: true, action: 'add_opex' });
                      } else {
                        setTargetRestaurantId(selectedRestaurant);
                        setManualPurchaseType('opex');
                        const todayOpex = getTodayInUserTz(user);
                        setEditingItem({ 
                          _editType: 'opex',
                          restaurant_id: selectedRestaurant,
                          date: todayOpex,
                          payment_status: 'pagado',
                          payment_date: todayOpex
                        });
                        setIsDialogOpen(true);
                      }
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white shadow-xl"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Gasto Op.
                  </Button>
                </>
              )}
                      {/* NPS deshabilitado temporalmente */}
            </div>
      </PageHeader>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Object.entries(tabsConfig).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = activeTab === key;
            const count = tableConfigs[key]?.data?.length || 0;
            
            return (
              <motion.div
                key={key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  className={`cursor-pointer transition-all duration-300 border-2 ${
                    isActive 
                      ? `${config.lightBg} ${config.borderColor} shadow-lg` 
                      : 'bg-white border-transparent hover:border-gray-200 hover:shadow-md'
                  }`}
                  onClick={() => setActiveTab(key)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isActive ? config.iconBg : 'bg-gray-100'
                      }`}>
                        <Icon className={`w-5 h-5 ${isActive ? config.iconColor : 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                          {config.label}
                        </p>
                        <p className="text-sm text-gray-400">{count} registros{key === 'sales' ? ' en BD' : ''}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Stats Banner */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className={`mb-6 border-0 shadow-sm overflow-hidden`}>
            <div className={`bg-gradient-to-r ${currentTabConfig.gradient} p-6`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <TabIcon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">{currentTabConfig.label}</h2>
                  <p className="text-white/70 text-sm hidden sm:block">{currentTabConfig.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 sm:gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">{stats.count}</p>
                    <p className="text-white/70 text-sm">
                      {activeTab === 'sales' ? 'Ventas activas' : 'Registros'}
                    </p>
                    {activeTab === 'sales' && stats.count !== sales.length && (
                      <p className="text-white/50 text-xs mt-0.5">
                        ({sales.length} totales, {sales.length - stats.count} canceladas)
                      </p>
                    )}
                  </div>
                  {activeTab === 'sales' ? (
                    <>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-white">
                          {formatCurrency(Number(stats.totalBruto), selectedCurrency, { compact: true })}
                        </p>
                        <p className="text-white/70 text-sm">Total Ventas (IVA incl.)</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-yellow-200">
                          {formatCurrency(Number(stats.totalNeto), selectedCurrency, { compact: true })}
                        </p>
                        <p className="text-white/70 text-sm">Venta Neta</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-white">
                        {formatCurrency(Number(stats.total), selectedCurrency, { compact: true })}
                      </p>
                      <p className="text-white/70 text-sm">{stats.label}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Data Table */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-white border-0 shadow-lg rounded-xl overflow-hidden">
              <CardHeader className={`${currentTabConfig.lightBg} border-b ${currentTabConfig.borderColor}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentTabConfig.iconBg}`}>
                      <FileSpreadsheet className={`w-4 h-4 ${currentTabConfig.iconColor}`} />
                    </div>
                    <CardTitle className="text-lg font-semibold text-gray-800">
                      Listado de {currentTabConfig.label}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeTab === 'purchases' && pendingCount > 0 && (
                      <Button
                        variant={pendingFilter ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPendingFilter(!pendingFilter)}
                        className={pendingFilter 
                          ? "bg-amber-500 hover:bg-amber-600 text-white" 
                          : "border-amber-300 text-amber-700 hover:bg-amber-50"
                        }
                      >
                        ⏳ Pendientes ({pendingCount})
                      </Button>
                    )}
                    <Badge className={currentTabConfig.badgeBg}>
                      {stats.count} registros
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto">
                {activeTab === 'sales' && selectedSaleIds.length > 0 && (
                  <BulkDeleteBar
                    selectedCount={selectedSaleIds.length}
                    isDeleting={isBulkDeleting}
                    onClearSelection={() => setSelectedSaleIds([])}
                    onDelete={async () => {
                      setIsBulkDeleting(true);
                      const ids = [...selectedSaleIds];
                      for (let i = 0; i < ids.length; i++) {
                        try {
                          await base44.entities.Sale.delete(ids[i]);
                        } catch (e) {}
                        if (i < ids.length - 1) await new Promise(r => setTimeout(r, 250));
                      }
                      setSelectedSaleIds([]);
                      setIsBulkDeleting(false);
                      queryClient.invalidateQueries({ queryKey: ['sales'] });
                    }}
                  />
                )}
                {activeTab === 'purchases' && selectedPurchaseIds.length > 0 && (
                  <BulkDeleteBar
                    selectedCount={selectedPurchaseIds.length}
                    isDeleting={isBulkDeletingPurchases}
                    onClearSelection={() => setSelectedPurchaseIds([])}
                    onDelete={async () => {
                      setIsBulkDeletingPurchases(true);
                      const selected = purchasesData.filter(p => selectedPurchaseIds.includes(p.id));
                      for (let i = 0; i < selected.length; i++) {
                        const item = selected[i];
                        try {
                          if (item._type === 'supply') {
                            await base44.entities.SupplyCost.delete(item.id);
                          } else {
                            await base44.entities.OpEx.delete(item.id);
                          }
                        } catch (e) {}
                        if (i < selected.length - 1) await new Promise(r => setTimeout(r, 250));
                      }
                      setSelectedPurchaseIds([]);
                      setIsBulkDeletingPurchases(false);
                      queryClient.invalidateQueries({ queryKey: ['supplyCosts'] });
                      queryClient.invalidateQueries({ queryKey: ['opex'] });
                    }}
                  />
                )}
                <DataTable
                  columns={tableConfig.columns}
                  data={tableConfig.data}
                  searchPlaceholder={activeTab === 'sales' 
                    ? 'Buscar por producto, ID, camarero, mesa, pago, total...' 
                    : 'Buscar por proveedor, factura, RUT, monto, recibido por, detalle...'}
                  searchFn={tableConfig.searchFn}
                  selectable={activeTab === 'sales' || activeTab === 'purchases'}
                  selectedIds={activeTab === 'sales' ? selectedSaleIds : selectedPurchaseIds}
                  onSelectionChange={activeTab === 'sales' ? setSelectedSaleIds : setSelectedPurchaseIds}
                />
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingItem(null); setTargetRestaurantId(null); setManualPurchaseType(null); }
        }}>
          <DialogContent className={`${activeTab === 'sales' ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  editingItem?._editType === 'supply' ? 'bg-amber-100' : 
                  editingItem?._editType === 'opex' ? 'bg-blue-100' : 
                  currentTabConfig.iconBg
                }`}>
                  {editingItem?._editType === 'supply' ? (
                    <ShoppingCart className="w-5 h-5 text-amber-600" />
                  ) : editingItem?._editType === 'opex' ? (
                    <Receipt className="w-5 h-5 text-blue-600" />
                  ) : (
                    <TabIcon className={`w-5 h-5 ${currentTabConfig.iconColor}`} />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-lg">
                    {editingItem?.id ? 'Editar' : 'Nuevo'} {formConfig?.title}
                  </DialogTitle>
                  <p className="text-sm text-gray-500">
                    {editingItem?._editType === 'supply' ? 'Registra una compra de insumos — se refleja en Food Cost' :
                     editingItem?._editType === 'opex' ? 'Registra un gasto operativo — se refleja en OPEX' :
                     currentTabConfig.description}
                  </p>
                </div>
              </div>
            </DialogHeader>
            {activeTab === 'sales' ? (
              <SaleEditForm
                sale={editingItem}
                restaurants={accessibleRestaurants}
                inventory={[]}
                employees={[]}
                currency={selectedCurrency}
                user={user}
                onSubmit={(data) => {
                  if (editingItem) {
                    updateSaleMutation.mutate({ id: editingItem.id, data });
                  } else {
                    createSaleMutation.mutate(data);
                  }
                }}
                onCancel={() => { setIsDialogOpen(false); setEditingItem(null); setTargetRestaurantId(null); }}
                isLoading={createSaleMutation.isPending || updateSaleMutation.isPending}
              />
            ) : editingItem?._editType === 'supply' ? (
              <SupplyPurchaseForm
                defaultValues={editingItem || {}}
                restaurant={accessibleRestaurants.find(r => r.id === (editingItem?.restaurant_id || targetRestaurantId))}
                supplyItems={supplyItems}
                suppliers={suppliers.filter(s => s.restaurant_id === (editingItem?.restaurant_id || targetRestaurantId))}
                currency={selectedCurrency}
                isEditing={!!editingItem?.id}
                onSubmit={handleSubmit}
                onCancel={() => { setIsDialogOpen(false); setEditingItem(null); setTargetRestaurantId(null); setManualPurchaseType(null); }}
                isLoading={createSupplyCostMutation.isPending || updateSupplyCostMutation.isPending}
              />
            ) : editingItem?._editType === 'opex' ? (
              <OpExPurchaseForm
                defaultValues={editingItem || {}}
                restaurant={accessibleRestaurants.find(r => r.id === (editingItem?.restaurant_id || targetRestaurantId))}
                suppliers={suppliers.filter(s => s.restaurant_id === (editingItem?.restaurant_id || targetRestaurantId))}
                currency={selectedCurrency}
                isEditing={!!editingItem?.id}
                onSubmit={handleSubmit}
                onCancel={() => { setIsDialogOpen(false); setEditingItem(null); setTargetRestaurantId(null); setManualPurchaseType(null); }}
                isLoading={createOpExMutation.isPending || updateOpExMutation.isPending}
              />
            ) : formConfig && (
              <EntityForm
                fields={formConfig.fields}
                defaultValues={editingItem || { restaurant_id: targetRestaurantId || (selectedRestaurant !== "all" ? selectedRestaurant : '') }}
                onSubmit={handleSubmit}
                isLoading={formConfig.createMutation.isPending || formConfig.updateMutation.isPending}
                onCancel={() => { setIsDialogOpen(false); setEditingItem(null); setTargetRestaurantId(null); setManualPurchaseType(null); }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Select Restaurant Dialog */}
        <SelectRestaurantDialog
          open={selectRestaurantDialog.open}
          onOpenChange={(open) => setSelectRestaurantDialog({ ...selectRestaurantDialog, open })}
          restaurants={accessibleRestaurants}
          title="Selecciona un local"
          description="Elige el restaurante donde aplicar esta acción"
          onSelect={(restaurantId) => {
            setTargetRestaurantId(restaurantId);
            if (selectRestaurantDialog.action === 'import_sales') {
              setImportDialogOpen(true);
            } else if (selectRestaurantDialog.action === 'import_purchases') {
              setPurchasesImportDialogOpen(true);
            } else if (selectRestaurantDialog.action === 'add_record') {
              setEditingItem(null);
              setIsDialogOpen(true);
            } else if (selectRestaurantDialog.action === 'add_supply') {
              setManualPurchaseType('supply');
              const todaySupply = getTodayInUserTz(user);
              setEditingItem({ 
                _editType: 'supply',
                restaurant_id: restaurantId,
                date: todaySupply,
                payment_status: 'pagado',
                payment_date: todaySupply,
                supply_type: 'ingredients'
              });
              setIsDialogOpen(true);
            } else if (selectRestaurantDialog.action === 'sync_fudo') {
              const rest = accessibleRestaurants.find(r => r.id === restaurantId);
              if (rest?.fudo_config?.is_connected) {
                setFudoSyncRestaurant(rest);
                setFudoSyncDialogOpen(true);
              }
            } else if (selectRestaurantDialog.action === 'upload_invoice') {
              setInvoiceRestaurantId(restaurantId);
              setInvoiceDialogOpen(true);
            } else if (selectRestaurantDialog.action === 'add_opex') {
              setManualPurchaseType('opex');
              const todayOpexSelect = getTodayInUserTz(user);
              setEditingItem({ 
                _editType: 'opex',
                restaurant_id: restaurantId,
                date: todayOpexSelect,
                payment_status: 'pagado',
                payment_date: todayOpexSelect
              });
              setIsDialogOpen(true);
            }
          }}
        />

        {/* Import Sales Dialog */}
        <SalesImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          restaurantId={targetRestaurantId || selectedRestaurant}
          restaurant={accessibleRestaurants.find(r => r.id === (targetRestaurantId || selectedRestaurant))}
          onSuccess={(count, notFound, ingredientsUpdated) => {
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
            setTargetRestaurantId(null);
            setSuccessOverlay({
              open: true,
              title: '¡Ventas importadas!',
              message: `Se importaron ${count} ventas.${ingredientsUpdated > 0 ? ` Ingredientes descontados de ${ingredientsUpdated} insumos.` : ''}${notFound > 0 ? ` (${notFound} productos no encontrados)` : ''}`
            });
          }}
        />

        {/* Import Purchases Dialog (Unificado) */}
        <PurchasesImportDialog
          open={purchasesImportDialogOpen}
          onOpenChange={setPurchasesImportDialogOpen}
          restaurantId={targetRestaurantId || selectedRestaurant}
          restaurant={accessibleRestaurants.find(r => r.id === (targetRestaurantId || selectedRestaurant))}
          restaurantConfig={accessibleRestaurants.find(r => r.id === (targetRestaurantId || selectedRestaurant))?.config}
          supplyItems={supplyItems.filter(s => s.restaurant_id === (targetRestaurantId || selectedRestaurant))}
          suppliers={suppliers.filter(s => s.restaurant_id === (targetRestaurantId || selectedRestaurant))}
          onSuccess={(suppliesCount, opexCount, stockUpdatesCount) => {
            queryClient.invalidateQueries({ queryKey: ['supplyCosts'] });
            queryClient.invalidateQueries({ queryKey: ['opex'] });
            queryClient.invalidateQueries({ queryKey: ['supplyItems'] });
            setTargetRestaurantId(null);
            setSuccessOverlay({
              open: true,
              title: '¡Compras y gastos importados!',
              message: `Se importaron ${suppliesCount} suministros y ${opexCount} gastos operativos.${stockUpdatesCount > 0 ? ` Stock actualizado en ${stockUpdatesCount} insumos.` : ''}`
            });
          }}
        />

        {/* Invoice Upload Dialog */}
        <InvoiceUploadDialog
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          restaurant={accessibleRestaurants.find(r => r.id === invoiceRestaurantId)}
          supplyItems={supplyItems.filter(s => s.restaurant_id === invoiceRestaurantId)}
          suppliers={suppliers.filter(s => s.restaurant_id === invoiceRestaurantId)}
          currency={selectedCurrency}
          onSubmitSupply={async (data) => {
            const itemCount = data.invoice_items?.length || data._invoice_items?.length || (data.supply_item_name ? 1 : 0);
            const supplierName = data.supplier;
            const restId = data.restaurant_id;
            const _nR = (r) => (r || '').replace(/[\.\s\-]/g, '').toLowerCase().trim();
            const _sRut = _nR(data.supplier_tax_id);
            const _rS = suppliers.filter(s => s.restaurant_id === restId);
            const isNew = supplierName && !(_sRut ? _rS.some(s => _nR(s.tax_id) === _sRut) : _rS.some(s => s.name?.toLowerCase().trim() === supplierName.toLowerCase().trim()));
            if (isNew) data._skipAutoSupplier = true;
            await createSupplyCostMutation.mutateAsync(data);
            setInvoiceDialogOpen(false);
            // Check if the invoice date is outside the current date filter
            const invoiceDate = data.date;
            const isOutsideFilter = invoiceDate && dateRange.from && dateRange.to && (invoiceDate < dateRange.from || invoiceDate > dateRange.to);
            const dateWarning = isOutsideFilter ? `\n⚠️ La fecha de la factura (${invoiceDate}) está fuera del rango actual del filtro. Ajusta las fechas para verla en la tabla.` : '';
            const baseMsg = itemCount > 1 ? `Compra registrada con stock actualizado para ${itemCount} insumos.` : 'Compra de suministro registrada exitosamente.';
            const successMsg = { title: '¡Factura registrada!', message: baseMsg + dateWarning };
            if (isNew) {
              // Queue success to show AFTER new supplier dialog closes
              setPendingSuccess(successMsg);
              // Extract supply item names from invoice for pre-populating supplier
              const detectedItems = (data.invoice_items || data._invoice_items || []).map(i => i.name).filter(Boolean);
              if (data.supply_item_name && !detectedItems.includes(data.supply_item_name)) detectedItems.push(data.supply_item_name);
              setNewSupplierDialog({ open: true, restaurantId: restId, data: { name: supplierName, tax_id: data.supplier_tax_id, suggested_type: 'supply', supply_categories: data.supply_category ? [data.supply_category] : [], supply_items: detectedItems } });
            } else {
              setSuccessOverlay({ open: true, ...successMsg });
            }
          }}
          onSubmitOpex={async (data) => {
            const supplierName = data.supplier;
            const restId = data.restaurant_id;
            const _nR2 = (r) => (r || '').replace(/[\.\s\-]/g, '').toLowerCase().trim();
            const _sRut2 = _nR2(data.supplier_tax_id);
            const _rS2 = suppliers.filter(s => s.restaurant_id === restId);
            const isNew = supplierName && !(_sRut2 ? _rS2.some(s => _nR2(s.tax_id) === _sRut2) : _rS2.some(s => s.name?.toLowerCase().trim() === supplierName.toLowerCase().trim()));
            if (isNew) data._skipAutoSupplier = true;
            await createOpExMutation.mutateAsync(data);
            setInvoiceDialogOpen(false);
            const invoiceDateOpex = data.date;
            const isOutsideFilterOpex = invoiceDateOpex && dateRange.from && dateRange.to && (invoiceDateOpex < dateRange.from || invoiceDateOpex > dateRange.to);
            const dateWarningOpex = isOutsideFilterOpex ? `\n⚠️ La fecha del gasto (${invoiceDateOpex}) está fuera del rango actual del filtro. Ajusta las fechas para verlo en la tabla.` : '';
            const successMsg = { title: '¡Factura registrada!', message: 'Gasto operativo registrado exitosamente.' + dateWarningOpex };
            if (isNew) {
              setPendingSuccess(successMsg);
              const opexCats = data.cost_center_name ? [{ cost_center: data.cost_center_name, category: data.category || '' }] : [];
              setNewSupplierDialog({ open: true, restaurantId: restId, data: { name: supplierName, tax_id: data.supplier_tax_id, suggested_type: 'opex', opex_categories: opexCats } });
            } else {
              setSuccessOverlay({ open: true, ...successMsg });
            }
          }}
        />

        {/* FUDO Sync Dialog */}
        {fudoSyncRestaurant && (
          <FudoSyncDialog
            open={fudoSyncDialogOpen}
            onOpenChange={setFudoSyncDialogOpen}
            restaurant={fudoSyncRestaurant}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['sales'] });
              queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
            }}
          />
        )}

        {/* Restaurant Picker al entrar */}
        <RestaurantPickerOnEntry
          restaurants={accessibleRestaurants}
          selectedRestaurant={selectedRestaurant}
          onSelect={setSelectedRestaurant}
          pageName="Ventas y Compras"
          isLoading={isRestaurantsLoading}
        />

        {/* New Supplier Detected Dialog */}
        <NewSupplierDetectedDialog
          open={newSupplierDialog.open}
          onOpenChange={(open) => {
            setNewSupplierDialog(s => ({ ...s, open }));
            // When supplier dialog closes, show queued success overlay
            if (!open && pendingSuccess) {
              setSuccessOverlay({ open: true, ...pendingSuccess });
              setPendingSuccess(null);
            }
          }}
          supplierData={newSupplierDialog.data}
          restaurant={accessibleRestaurants.find(r => r.id === newSupplierDialog.restaurantId)}
          onSave={async (supplierRecord) => {
            await base44.entities.Supplier.create(supplierRecord);
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            // Close dialog and show success
            setNewSupplierDialog(s => ({ ...s, open: false }));
            if (pendingSuccess) {
              setSuccessOverlay({ open: true, ...pendingSuccess });
              setPendingSuccess(null);
            }
          }}
        />
        <SuccessOverlay
          open={successOverlay.open}
          onClose={() => setSuccessOverlay({ ...successOverlay, open: false })}
          title={successOverlay.title}
          message={successOverlay.message}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, id: null, type: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El registro será eliminado permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={confirmDelete}
              >
                Sí, eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}