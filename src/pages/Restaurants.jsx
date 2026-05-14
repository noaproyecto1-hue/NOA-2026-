import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Store, 
  MapPin, 
  Phone,
  Edit,
  ToggleLeft,
  ToggleRight,
  QrCode,
  Download,
  DollarSign,
  ExternalLink,
  Printer,
  Upload,
  Loader2,
  Image as ImageIcon,
  FileSpreadsheet,
  Settings,
  Camera,
  Building2
} from "lucide-react";
import PageHeader from '@/components/ui/PageHeader';
import { motion } from "framer-motion";
import TemplatesDownloadDialog from '@/components/templates/TemplatesDownloadDialog';
import RestaurantConfigDialog from '@/components/restaurants/RestaurantConfigDialog';

// FinancialHealthConfigDialog eliminado — ahora se configura desde Centro de Alertas
import RestaurantProformaDialog from '@/components/restaurants/RestaurantProformaDialog';
import RestaurantCard from '@/components/restaurants/RestaurantCard';
import { normalizeSupplyCategories, serializeSupplyCategories } from '@/components/utils/supplyCategoryHelper';
import { safeRestaurantUpdate } from '@/components/utils/safeRestaurantUpdate';

const currencyConfig = {
  USD: { label: "Dólar Estadounidense", symbol: "$", flag: "🇺🇸" },
  EUR: { label: "Euro", symbol: "€", flag: "🇪🇺" },
  MXN: { label: "Peso Mexicano", symbol: "$", flag: "🇲🇽" },
  COP: { label: "Peso Colombiano", symbol: "$", flag: "🇨🇴" },
  ARS: { label: "Peso Argentino", symbol: "$", flag: "🇦🇷" },
  CLP: { label: "Peso Chileno", symbol: "$", flag: "🇨🇱" },
  PEN: { label: "Sol Peruano", symbol: "S/", flag: "🇵🇪" }
};

// Generador de QR usando API pública
const generateQRUrl = (text, size = 200) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
};

export default function Restaurants() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const qrRef = useRef(null);
  const [formData, setFormData] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configRestaurant, setConfigRestaurant] = useState(null);


  const [proformaDialogOpen, setProformaDialogOpen] = useState(false);
  const [proformaRestaurant, setProformaRestaurant] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Filtrar restaurantes por usuario - cada gerente solo ve los suyos
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['myRestaurants', user?.email],
    queryFn: () => base44.entities.Restaurant.filter({ created_by: user?.email }),
    enabled: !!user?.email
  });

  // Obtener IDs de mis restaurantes para filtrar datos
  const myRestaurantIds = restaurants.map(r => r.id);

  // Suppliers
  const { data: allSuppliers = [] } = useQuery({
    queryKey: ['suppliers', myRestaurantIds],
    queryFn: async () => {
      if (myRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        myRestaurantIds.map(id => base44.entities.Supplier.filter({ restaurant_id: id }))
      );
      return results.flat();
    },
    enabled: myRestaurantIds.length > 0,
    staleTime: 5 * 60 * 1000
  });

  const addSupplierMutation = useMutation({
    mutationFn: (data) => base44.entities.Supplier.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  });

  const updateSupplierMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  });

  const bulkCreateSuppliersMutation = useMutation({
    mutationFn: (data) => base44.entities.Supplier.bulkCreate(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  });

  // Estadísticas solo de mis restaurantes
  const { data: sales = [] } = useQuery({
    queryKey: ['mySales', myRestaurantIds],
    queryFn: async () => {
      if (myRestaurantIds.length === 0) return [];
      const results = await Promise.all(
        myRestaurantIds.map(id => base44.entities.Sale.filter({ restaurant_id: id }, '-date_time', 200))
      );
      return results.flat();
    },
    enabled: myRestaurantIds.length > 0,
    staleTime: 5 * 60 * 1000
  });



  const isManager = user?.role === 'admin' || user?.app_role === 'manager';

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const newRestaurant = await base44.entities.Restaurant.create(data);
      // Auto-assign restaurant to the creator's user record
      const currentUser = await base44.auth.me();
      const currentIds = currentUser?.restaurant_ids || [];
      if (newRestaurant?.id && !currentIds.includes(newRestaurant.id)) {
        await base44.auth.updateMe({ 
          restaurant_ids: [...currentIds, newRestaurant.id] 
        });
      }
      return newRestaurant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['dashRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setIsDialogOpen(false);
      setEditingRestaurant(null);
      setFormData({});
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const restaurant = editingRestaurant || restaurants.find(r => r.id === id);
      return safeRestaurantUpdate(id, data, restaurant);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['dashRestaurants'] });
      setIsDialogOpen(false);
      setEditingRestaurant(null);
      setFormData({});
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => {
      const restaurant = restaurants.find(r => r.id === id);
      return safeRestaurantUpdate(id, { is_active }, restaurant);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['dashRestaurants'] });
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, config }) => base44.entities.Restaurant.update(id, { config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['dashRestaurants'] });
      setConfigDialogOpen(false);
      setConfigRestaurant(null);
    }
  });

  const openConfigDialog = async (restaurant) => {
    // Refetch para obtener datos más recientes de la base de datos
    const freshData = await base44.entities.Restaurant.filter({ id: restaurant.id });
    const freshRestaurant = freshData.length > 0 ? freshData[0] : restaurant;
    console.log('Config restaurant fixed_expenses:', freshRestaurant?.config?.fixed_expenses);
    setConfigRestaurant(freshRestaurant);
    setConfigDialogOpen(true);
  };

  const handleSaveConfig = async (newConfig, extraFields = {}) => {
    if (configRestaurant) {
      // Asegurar que se guarden todos los campos incluyendo fixed_expenses
      const configToSave = {
        ...newConfig,
        fixed_expenses: newConfig.fixed_expenses || [],
        employees: newConfig.employees || [],
        cost_centers: newConfig.cost_centers || [],
        payment_methods: newConfig.payment_methods || [],
        preparation_zones: newConfig.preparation_zones || [],
        rooms: newConfig.rooms || [],
        supply_categories: serializeSupplyCategories(normalizeSupplyCategories(newConfig.supply_categories || [])),
        cost_center_items: newConfig.cost_center_items || []
      };
      // Guardar config + campos extra del restaurante (como tax_id)
      const updateData = { config: configToSave, ...extraFields };
      await safeRestaurantUpdate(configRestaurant.id, updateData, configRestaurant);
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['dashRestaurants'] });
      setConfigDialogOpen(false);
      setConfigRestaurant(null);
    }
  };



  // Financial Health — eliminado, ahora se configura desde Centro de Alertas

  // Proforma
  const openProformaDialog = (restaurant) => {
    const freshRestaurant = restaurants.find(r => r.id === restaurant.id) || restaurant;
    setProformaRestaurant(freshRestaurant);
    setProformaDialogOpen(true);
  };

  const [isSavingProforma, setIsSavingProforma] = useState(false);

  const handleSaveProforma = async (proforma) => {
    if (proformaRestaurant) {
      setIsSavingProforma(true);
      await safeRestaurantUpdate(proformaRestaurant.id, { proforma }, proformaRestaurant);
      queryClient.invalidateQueries({ queryKey: ['allRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['myRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['dashRestaurants'] });
      setIsSavingProforma(false);
      setProformaDialogOpen(false);
      setProformaRestaurant(null);
    }
  };

  // Upload logo
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData(prev => ({ ...prev, logo_url: file_url }));
    setIsUploading(false);
  };

const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData };
    
    if (editingRestaurant) {
      updateMutation.mutate({ id: editingRestaurant.id, data });
    } else {
      createMutation.mutate({ ...data, is_active: true });
    }
  };

  const handleEdit = (restaurant) => {
    setEditingRestaurant(restaurant);
    setFormData({
      name: restaurant.name || '',
      location: restaurant.location || '',
      currency: restaurant.currency || 'USD',
      phone: restaurant.phone || '',
      logo_url: restaurant.logo_url || '',
      cover_image_url: restaurant.cover_image_url || '',
      nps_qr_url: restaurant.nps_qr_url || ''
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingRestaurant(null);
    setFormData({
      name: '',
      location: '',
      currency: 'USD',
      phone: '',
      logo_url: '',
      cover_image_url: '',
      nps_qr_url: ''
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = (restaurant) => {
    toggleActiveMutation.mutate({ id: restaurant.id, is_active: !restaurant.is_active });
  };

  const openQrDialog = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setQrDialogOpen(true);
  };

  // Generar URL de NPS para el restaurante
  const getNpsUrl = (restaurant) => {
    // Si tiene un Google Form configurado, usar ese
    if (restaurant.nps_qr_url) return restaurant.nps_qr_url;
    // Si no, mostrar mensaje de que necesita configurar
    return null;
  };

  // Descargar QR
  const downloadQR = async () => {
    if (!selectedRestaurant || !selectedRestaurant.nps_qr_url) return;
    const qrUrl = generateQRUrl(selectedRestaurant.nps_qr_url, 400);
    
    const response = await fetch(qrUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR-NPS-${selectedRestaurant.name.replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Imprimir QR
  const printQR = () => {
    if (!selectedRestaurant || !selectedRestaurant.nps_qr_url) return;
    const printWindow = window.open('', '_blank');
    const qrUrl = generateQRUrl(selectedRestaurant.nps_qr_url, 400);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR NPS - ${selectedRestaurant.name}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 40px;
            margin: 0;
          }
          .container { max-width: 400px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 8px; color: #333; }
          h2 { font-size: 18px; font-weight: normal; color: #666; margin-bottom: 24px; }
          img { width: 300px; height: 300px; margin: 20px 0; }
          p { color: #888; font-size: 14px; margin-top: 24px; }
          .cta { 
            font-size: 20px; 
            font-weight: bold; 
            color: #2563eb; 
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${selectedRestaurant.name}</h1>
          <h2>📍 ${selectedRestaurant.location}</h2>
          <img src="${qrUrl}" alt="QR Code" />
          <p class="cta">¡Escanea y cuéntanos tu experiencia!</p>
          <p>Tu opinión nos ayuda a mejorar</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Obtener estadísticas por restaurante
  const getRestaurantStats = (restaurantId) => {
    const restaurantSales = sales.filter(s => s.restaurant_id === restaurantId);
    const totalSales = restaurantSales.reduce((sum, s) => sum + (s.amount || 0), 0);
    return { totalSales, avgNps: null, salesCount: restaurantSales.length };
  };

  const formatCurrency = (value, currency) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      {/* Hero Header */}
      <PageHeader
        title="Restaurantes"
        subtitle="Gestiona tus locales, monedas y códigos QR para NPS"
        icon={Building2}
        imageKey="restaurants"
        gradient="from-blue-900/90 via-indigo-900/80 to-slate-900/70"
      >
        {isManager && (
          <>
            <Button 
              variant="outline"
              onClick={() => setTemplatesDialogOpen(true)}
              className="bg-white/95 backdrop-blur-sm border-white/50 shadow-xl text-blue-700 hover:bg-white"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Plantillas XLSX
            </Button>
            <Button 
              onClick={openNewDialog}
              className="bg-white text-gray-800 hover:bg-gray-50 shadow-xl border border-white/50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Restaurante
            </Button>
          </>
        )}
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Store className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{restaurants.length}</p>
                  <p className="text-xs text-gray-500">Total Locales</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <ToggleRight className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{restaurants.filter(r => r.is_active).length}</p>
                  <p className="text-xs text-gray-500">Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{new Set(restaurants.map(r => r.currency)).size}</p>
                  <p className="text-xs text-gray-500">Monedas</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Restaurant Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((restaurant, index) => {
            const stats = getRestaurantStats(restaurant.id);
            
            return (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                stats={stats}
                index={index}
                isManager={isManager}
                onEdit={handleEdit}
                onConfig={openConfigDialog}
                onProforma={openProformaDialog}
                onQr={openQrDialog}
                onToggleActive={handleToggleActive}
                formatCurrency={formatCurrency}
              />
            );
          })}

          {restaurants.length === 0 && (
            <Card className="col-span-full bg-white border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Store className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Sin restaurantes</h3>
                <p className="text-gray-500 mb-4">Agrega tu primer restaurante para comenzar</p>
                {isManager && (
                  <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Restaurante
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                {editingRestaurant ? 'Editar' : 'Nuevo'} Restaurante
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nombre */}
              <div className="space-y-2">
                <Label>Nombre del Restaurante *</Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Café Central"
                  required
                />
              </div>

              {/* Ubicación */}
              <div className="space-y-2">
                <Label>Ubicación *</Label>
                <Input
                  value={formData.location || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Dirección completa"
                  required
                />
              </div>

              {/* Moneda */}
              <div className="space-y-2">
                <Label>Moneda *</Label>
                <Select
                  value={formData.currency || 'USD'}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(currencyConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.flag} {config.label} ({value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                />
              </div>

              {/* Foto de Portada */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Foto del Restaurante
                </Label>
                <div className="relative">
                  {formData.cover_image_url ? (
                    <div className="relative">
                      <img 
                        src={formData.cover_image_url} 
                        alt="Portada" 
                        className="w-full h-32 rounded-xl object-cover border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, cover_image_url: '' }))}
                        className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-md hover:bg-red-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploading(true);
                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                          setFormData(prev => ({ ...prev, cover_image_url: file_url }));
                          setIsUploading(false);
                        }}
                        className="hidden"
                      />
                      <div className="w-full h-32 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors">
                        {isUploading ? (
                          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">Subir foto del local</span>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Esta imagen aparecerá como portada en la tarjeta del restaurante
                </p>
              </div>

              {/* Logo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Logo del Restaurante
                </Label>
                <div className="flex gap-3 items-center">
                  {formData.logo_url ? (
                    <img 
                      src={formData.logo_url} 
                      alt="Logo" 
                      className="w-16 h-16 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Store className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {formData.logo_url ? 'Cambiar logo' : 'Subir logo'}
                      </div>
                    </label>
                    {formData.logo_url && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                        className="text-xs text-red-500 hover:text-red-600 mt-1"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => { setIsDialogOpen(false); setEditingRestaurant(null); }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Guardar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* QR Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-center pb-0">
              <DialogTitle className="text-lg font-bold">{selectedRestaurant?.name}</DialogTitle>
              <p className="text-sm text-gray-500">{selectedRestaurant?.location}</p>
            </DialogHeader>

            {selectedRestaurant && (
              <div className="flex flex-col items-center gap-4 pt-2">
                {selectedRestaurant.nps_qr_url ? (
                  <>
                    {/* QR Code - Solo si tiene URL configurada */}
                    <div ref={qrRef} className="p-3 bg-white border border-gray-200 rounded-xl">
                      <img 
                        src={generateQRUrl(selectedRestaurant.nps_qr_url, 180)} 
                        alt="QR Code"
                        className="w-44 h-44"
                      />
                    </div>

                    <p className="text-xs text-center text-gray-500">
                      Escanea para dejar tu opinión
                    </p>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Button variant="outline" size="sm" onClick={downloadQR}>
                        <Download className="w-4 h-4 mr-1" />
                        Descargar
                      </Button>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={printQR}>
                        <Printer className="w-4 h-4 mr-1" />
                        Imprimir
                      </Button>
                    </div>

                    <div className="w-full pt-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-gray-500"
                        onClick={() => handleEdit(selectedRestaurant)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Cambiar enlace del formulario
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* No tiene formulario configurado */}
                    <div className="text-center py-4">
                      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <QrCode className="w-8 h-8 text-amber-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Configura tu encuesta</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Necesitas crear un formulario de Google Forms y pegar el enlace aquí.
                      </p>
                    </div>

                    {/* Paso 1: Crear en Google Forms */}
                    <div className="w-full space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-xs font-medium text-blue-800 mb-2">Paso 1: Crear formulario</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full border-blue-200 text-blue-700 hover:bg-blue-100"
                          onClick={() => window.open('https://docs.google.com/forms', '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Abrir Google Forms
                        </Button>
                        <p className="text-xs text-blue-600 mt-2">
                          Crea un formulario con: Escala 1-10 y campo de comentarios
                        </p>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Paso 2: Pegar enlace</p>
                        <Button 
                          size="sm" 
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            setQrDialogOpen(false);
                            handleEdit(selectedRestaurant);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Configurar enlace del formulario
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Dialog */}
      <TemplatesDownloadDialog 
        open={templatesDialogOpen} 
        onOpenChange={setTemplatesDialogOpen} 
      />

      {/* Config Dialog */}
      <RestaurantConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        restaurant={configRestaurant}
        suppliers={allSuppliers.filter(s => s.restaurant_id === configRestaurant?.id)}
        sales={sales}
        onSave={handleSaveConfig}
        onAddSupplier={(data) => addSupplierMutation.mutate(data)}
        onUpdateSupplier={(id, data) => updateSupplierMutation.mutate({ id, data })}
        onDeleteSupplier={(id) => deleteSupplierMutation.mutate(id)}
        onBulkCreateSuppliers={(data) => bulkCreateSuppliersMutation.mutate(data)}
        isSaving={updateConfigMutation.isPending}
      />



      {/* Financial Health Dialog — eliminado, ahora se configura desde Centro de Alertas */}

      {/* Proforma Dialog */}
      <RestaurantProformaDialog
        open={proformaDialogOpen}
        onOpenChange={setProformaDialogOpen}
        restaurant={proformaRestaurant}
        onSave={handleSaveProforma}
        isSaving={isSavingProforma}
      />
    </div>
  );
}