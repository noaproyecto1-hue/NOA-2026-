import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Phone,
  Edit,
  ToggleLeft,
  ToggleRight,
  QrCode,
  DollarSign,
  Settings,
  Star,
  TrendingUp,

  FileSpreadsheet
} from "lucide-react";
import { motion } from "framer-motion";

const currencyConfig = {
  USD: { label: "Dólar", symbol: "$", flag: "🇺🇸" },
  EUR: { label: "Euro", symbol: "€", flag: "🇪🇺" },
  MXN: { label: "Peso MX", symbol: "$", flag: "🇲🇽" },
  COP: { label: "Peso CO", symbol: "$", flag: "🇨🇴" },
  ARS: { label: "Peso AR", symbol: "$", flag: "🇦🇷" },
  CLP: { label: "Peso CL", symbol: "$", flag: "🇨🇱" },
  PEN: { label: "Sol", symbol: "S/", flag: "🇵🇪" }
};

// Imágenes de respaldo para restaurantes sin foto
const fallbackImages = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
];

export default function RestaurantCard({ 
  restaurant, 
  stats, 
  index,
  isManager,
  onEdit,
  onConfig,
  onProforma,
  onQr,
  onToggleActive,
  formatCurrency
}) {
  const currencyInfo = currencyConfig[restaurant.currency] || currencyConfig.USD;
  
  // Usar imagen de portada o fallback
  const coverImage = restaurant.cover_image_url || fallbackImages[index % fallbackImages.length];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="h-full"
    >
      <Card className={`bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden h-full flex flex-col ${!restaurant.is_active ? 'opacity-70' : ''}`}>
        {/* Imagen de portada */}
        <div className="relative h-44 overflow-hidden">
          <img 
            src={coverImage} 
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
          {/* Overlay con gradiente */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Logo flotante */}
          {restaurant.logo_url && (
            <div className="absolute top-3 left-3">
              <img 
                src={restaurant.logo_url} 
                alt={`Logo ${restaurant.name}`}
                className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-lg"
              />
            </div>
          )}
          
          {/* Badges en esquina superior derecha */}
          <div className="absolute top-3 right-3 flex gap-2">
            <Badge 
              className={`${restaurant.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'} shadow-md`}
            >
              {restaurant.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          
          {/* Nombre y ubicación sobre la imagen */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-xl font-bold text-white mb-1 drop-shadow-md">
              {restaurant.name}
            </h3>
            <div className="flex items-center gap-1 text-white/90 text-sm">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate">{restaurant.location}</span>
            </div>
          </div>
        </div>
        
        <CardContent className="p-4 flex-1 flex flex-col">
          {/* Info rápida */}
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
            {restaurant.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs">{restaurant.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs">{currencyInfo.flag} {restaurant.currency}</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          {isManager && (
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onEdit(restaurant)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onConfig(restaurant)}
                title="Configuración"
              >
                <Settings className="w-4 h-4" />
              </Button>

              {/* Salud Financiera se configura desde el Centro de Alertas */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onProforma(restaurant)}
                title="Proforma"
                className="text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleActive(restaurant)}
                title={restaurant.is_active ? 'Desactivar' : 'Activar'}
              >
                {restaurant.is_active ? (
                  <ToggleRight className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-gray-400" />
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}