import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Store, ChevronRight, MapPin } from "lucide-react";
import { motion } from 'framer-motion';

export default function RestaurantPickerDialog({ open, onOpenChange, restaurants = [], onSelect }) {
  if (restaurants.length <= 1) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-600" />
            ¿Qué local quieres gestionar?
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Selecciona el restaurante para trabajar con su inventario
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {/* Opción: Ver todos */}
          <button
            onClick={() => { onSelect('all'); onOpenChange(false); }}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group text-left"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-slate-100 rounded-xl flex items-center justify-center group-hover:from-emerald-100 group-hover:to-green-100 transition-colors">
              <Store className="w-6 h-6 text-gray-500 group-hover:text-emerald-600 transition-colors" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">Ver todos los locales</p>
              <p className="text-xs text-gray-500 mt-0.5">Vista consolidada de {restaurants.length} locales</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
          </button>

          {/* Lista de restaurantes */}
          {restaurants.map((restaurant, idx) => (
            <motion.button
              key={restaurant.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => { onSelect(restaurant.id); onOpenChange(false); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group text-left"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-105 transition-transform">
                {restaurant.name?.charAt(0).toUpperCase() || 'R'}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{restaurant.name}</p>
                {restaurant.location && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {restaurant.location}
                  </p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
            </motion.button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}