import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store, Building2 } from "lucide-react";

export default function RestaurantSelector({ 
  restaurants = [], 
  selectedId, 
  onChange,
  showConsolidated = true,
  className = ""
}) {
  return (
    <Select value={selectedId || "all"} onValueChange={onChange}>
      <SelectTrigger className={`w-auto max-w-[200px] bg-white/95 backdrop-blur-sm border-white/50 text-gray-800 shadow-md hover:bg-white transition-all ${className}`}>
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-gray-600" />
          <SelectValue placeholder="Seleccionar restaurante" className="text-gray-800" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {showConsolidated && (
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="font-medium">Todos los locales</span>
            </div>
          </SelectItem>
        )}
        {restaurants.map((restaurant) => (
          <SelectItem key={restaurant.id} value={restaurant.id}>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{restaurant.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}