import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Palette, 
  Store, 
  Wand2, 
  Loader2, 
  CheckCircle,
  Eye,
  RotateCcw,
  Sparkles,
  Save,
  Upload,
  Image as ImageIcon,
  X
} from "lucide-react";
import { motion } from "framer-motion";

// Colores por defecto del sistema
const DEFAULT_THEME = {
  primary: '#3B82F6',
  secondary: '#6366F1', 
  accent: '#F59E0B',
  name: 'Azul Estándar',
  logo_url: null
};

export default function BrandingCustomizer({ user, restaurants }) {
  const queryClient = useQueryClient();
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [customColors, setCustomColors] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Obtener restaurantes accesibles
  const accessibleRestaurants = useMemo(() => {
    if (!user || !restaurants.length) return [];
    if (user.role === 'admin' || user.user_role === 'manager') return restaurants;
    return restaurants.filter(r => user.restaurant_ids?.includes(r.id));
  }, [user, restaurants]);

  // Obtener tema actual del usuario
  const currentTheme = user?.brand_theme || DEFAULT_THEME;

  // Obtener colores del restaurante seleccionado
  const selectedRestaurantData = restaurants.find(r => r.id === selectedRestaurant);
  const restaurantColors = selectedRestaurantData?.brand_colors;

  // Mutation para guardar tema
  const saveBrandingMutation = useMutation({
    mutationFn: (theme) => base44.auth.updateMe({ brand_theme: theme }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  });

  // Cargar colores desde restaurante
  const loadFromRestaurant = () => {
    if (restaurantColors) {
      setCustomColors({
        primary: restaurantColors.primary || DEFAULT_THEME.primary,
        secondary: restaurantColors.secondary || DEFAULT_THEME.secondary,
        accent: restaurantColors.accent || DEFAULT_THEME.accent,
        name: selectedRestaurantData?.name || 'Personalizado',
        logo_url: selectedRestaurantData?.logo_url || null
      });
    }
  };

  // Subir logo personalizado
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setCustomColors(prev => prev ? { ...prev, logo_url: file_url } : { ...DEFAULT_THEME, logo_url: file_url });
    setIsUploadingLogo(false);
  };

  // Remover logo
  const removeLogo = () => {
    setCustomColors(prev => prev ? { ...prev, logo_url: null } : null);
  };

  // Aplicar tema y guardar
  const applyTheme = async () => {
    if (!customColors) return;
    
    setIsApplying(true);
    
    // Guardar en el usuario
    await saveBrandingMutation.mutateAsync(customColors);
    
    // Aplicar CSS variables inmediatamente
    applyThemeToDOM(customColors);
    
    setIsApplying(false);
  };

  // Resetear a colores por defecto
  const resetToDefault = async () => {
    setCustomColors(DEFAULT_THEME);
    await saveBrandingMutation.mutateAsync(DEFAULT_THEME);
    applyThemeToDOM(DEFAULT_THEME);
  };

  // Aplicar tema al DOM
  const applyThemeToDOM = (theme) => {
    const root = document.documentElement;
    
    // Convertir hex a HSL para Tailwind
    const hexToHSL = (hex) => {
      let r = 0, g = 0, b = 0;
      if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16) / 255;
        g = parseInt(hex.slice(3, 5), 16) / 255;
        b = parseInt(hex.slice(5, 7), 16) / 255;
      }
      
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    // Aplicar variables CSS
    root.style.setProperty('--brand-primary', theme.primary);
    root.style.setProperty('--brand-secondary', theme.secondary);
    root.style.setProperty('--brand-accent', theme.accent);
    root.style.setProperty('--brand-primary-hsl', hexToHSL(theme.primary));
    root.style.setProperty('--brand-secondary-hsl', hexToHSL(theme.secondary));
  };

  // Preview de colores
  const previewColors = customColors || currentTheme;
  
  // Iniciar con colores actuales si no hay customColors
  const startCustomization = () => {
    if (!customColors) {
      setCustomColors({ ...currentTheme });
    }
  };

  return (
    <div className="space-y-6">
      {/* Tema Actual */}
      <Card className="bg-white border-0 shadow-lg overflow-hidden">
        <div 
          className="h-3"
          style={{
            background: `linear-gradient(to right, ${currentTheme.primary}, ${currentTheme.secondary}, ${currentTheme.accent})`
          }}
        />
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Palette className="w-4 h-4 text-purple-600" />
            </div>
            Tema Actual
          </CardTitle>
          <CardDescription>
            Tu plataforma está usando estos colores y logo
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            {/* Logo actual */}
            {currentTheme.logo_url ? (
              <img 
                src={currentTheme.logo_url} 
                alt="Logo"
                className="w-14 h-14 rounded-xl object-cover border-2 border-gray-100 shadow-sm"
              />
            ) : (
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: `linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.secondary})` }}
              >
                <Store className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="flex gap-2">
              <div 
                className="w-10 h-10 rounded-lg shadow-inner border-2 border-white"
                style={{ backgroundColor: currentTheme.primary }}
                title="Primario"
              />
              <div 
                className="w-10 h-10 rounded-lg shadow-inner border-2 border-white"
                style={{ backgroundColor: currentTheme.secondary }}
                title="Secundario"
              />
              <div 
                className="w-10 h-10 rounded-lg shadow-inner border-2 border-white"
                style={{ backgroundColor: currentTheme.accent }}
                title="Acento"
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{currentTheme.name || 'Personalizado'}</p>
              <p className="text-sm text-gray-500">Tema activo</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={startCustomization}
            >
              <Palette className="w-4 h-4 mr-1" />
              Editar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personalizar desde Restaurante */}
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Store className="w-4 h-4 text-blue-600" />
            </div>
            Importar desde Restaurante
          </CardTitle>
          <CardDescription>
            Usa los colores de marca configurados en uno de tus restaurantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona un restaurante" />
              </SelectTrigger>
              <SelectContent>
                {accessibleRestaurants.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center gap-2">
                      {r.brand_colors?.primary && (
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: r.brand_colors.primary }}
                        />
                      )}
                      {r.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={loadFromRestaurant}
              disabled={!selectedRestaurant || !restaurantColors}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Cargar Colores
            </Button>
          </div>

          {selectedRestaurant && !restaurantColors && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              Este restaurante no tiene colores de marca configurados. Ve a Restaurantes para configurarlos.
            </p>
          )}

          {selectedRestaurant && restaurantColors && (
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600 mb-3">Colores disponibles de {selectedRestaurantData?.name}:</p>
              <div className="flex gap-3">
                <div className="text-center">
                  <div 
                    className="w-10 h-10 rounded-lg shadow-sm mx-auto"
                    style={{ backgroundColor: restaurantColors.primary }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Primario</p>
                </div>
                <div className="text-center">
                  <div 
                    className="w-10 h-10 rounded-lg shadow-sm mx-auto"
                    style={{ backgroundColor: restaurantColors.secondary || '#ccc' }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Secundario</p>
                </div>
                <div className="text-center">
                  <div 
                    className="w-10 h-10 rounded-lg shadow-sm mx-auto"
                    style={{ backgroundColor: restaurantColors.accent || '#ccc' }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Acento</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor de Colores */}
      {customColors && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-white border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
                Vista Previa y Ajustes
              </CardTitle>
              <CardDescription>
                Ajusta los colores antes de aplicarlos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Logo Upload */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <ImageIcon className="w-4 h-4" />
                  Logo Personalizado
                </Label>
                <div className="flex items-center gap-4">
                  {customColors?.logo_url ? (
                    <div className="relative">
                      <img 
                        src={customColors.logo_url} 
                        alt="Logo"
                        className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow"
                      />
                      <button
                        onClick={removeLogo}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="w-16 h-16 rounded-xl flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${previewColors.primary}, ${previewColors.secondary})` }}
                    >
                      <Store className="w-6 h-6 text-white" />
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
                        {isUploadingLogo ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {customColors?.logo_url ? 'Cambiar logo' : 'Subir logo'}
                      </div>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">Este logo se mostrará en el menú lateral</p>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div 
                className="rounded-xl p-6 text-white"
                style={{
                  background: `linear-gradient(135deg, ${previewColors.primary}, ${previewColors.secondary})`
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  {customColors?.logo_url ? (
                    <img 
                      src={customColors.logo_url}
                      alt="Logo"
                      className="w-10 h-10 rounded-xl object-cover border-2 border-white/30"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                      <Store className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold">Restaurant Copilot</h3>
                    <p className="text-white/70 text-sm">Vista previa del tema</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span 
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{ backgroundColor: previewColors.accent, color: '#fff' }}
                  >
                    Acento
                  </span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                    Dashboard
                  </span>
                </div>
              </div>

              {/* Color Pickers */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Primario</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customColors.primary}
                      onChange={(e) => setCustomColors(prev => ({ ...prev, primary: e.target.value }))}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={customColors.primary}
                      onChange={(e) => setCustomColors(prev => ({ ...prev, primary: e.target.value }))}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Secundario</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customColors.secondary}
                      onChange={(e) => setCustomColors(prev => ({ ...prev, secondary: e.target.value }))}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={customColors.secondary}
                      onChange={(e) => setCustomColors(prev => ({ ...prev, secondary: e.target.value }))}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Acento</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customColors.accent}
                      onChange={(e) => setCustomColors(prev => ({ ...prev, accent: e.target.value }))}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <Input
                      value={customColors.accent}
                      onChange={(e) => setCustomColors(prev => ({ ...prev, accent: e.target.value }))}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={resetToDefault}
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restaurar Predeterminado
                </Button>
                <Button
                  onClick={applyTheme}
                  disabled={isApplying}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {isApplying ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {saveSuccess ? '¡Aplicado!' : 'Aplicar Tema'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Información */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">¿Qué se personaliza?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li><strong>Logo:</strong> Se muestra en el menú lateral (móvil y desktop)</li>
                <li><strong>Colores:</strong> Headers de todas las páginas, navegación activa, botones principales</li>
                <li><strong>Gradientes:</strong> Dashboard, Reviews, Alertas, Gestión de Datos</li>
                <li>Los cambios se aplican inmediatamente y se guardan en tu perfil</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}