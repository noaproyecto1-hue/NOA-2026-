import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Store, ChevronRight, MapPin } from "lucide-react";
import { motion } from 'framer-motion';

export default function RestaurantPickerOnEntry({ restaurants = [], selectedRestaurant, onSelect, pageName = "esta sección", isLoading = false }) {
  const [open, setOpen] = useState(false);
  const prevRestaurantIdsRef = useRef(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // No hacer nada mientras los datos aún están cargando
    if (isLoading || restaurants.length === 0) return;

    const ids = restaurants.map(r => r.id);

    // Case 1: User has selected a specific restaurant that no longer exists in the list
    if (selectedRestaurant && selectedRestaurant !== 'all' && !ids.includes(selectedRestaurant)) {
      if (ids.length === 1) {
        onSelect(ids[0]);
      } else {
        onSelect('all');
        setOpen(true);
      }
      prevRestaurantIdsRef.current = ids;
      setHasInitialized(true);
      return;
    }

    // Case 2: Only 1 restaurant → auto-select it silently, never show picker
    if (ids.length === 1) {
      if (selectedRestaurant !== ids[0]) {
        onSelect(ids[0]);
      }
      setOpen(false);
      prevRestaurantIdsRef.current = ids;
      setHasInitialized(true);
      return;
    }

    // Case 3: Multiple restaurants and nothing selected → show picker
    if (ids.length > 1 && selectedRestaurant === 'all') {
      const prevIds = prevRestaurantIdsRef.current;
      const isFirstLoad = !hasInitialized;
      const listChanged = prevIds && (prevIds.length !== ids.length || !prevIds.every(id => ids.includes(id)));
      if (isFirstLoad || listChanged) {
        setOpen(true);
      }
    }

    prevRestaurantIdsRef.current = ids;
    setHasInitialized(true);
  }, [restaurants, selectedRestaurant, isLoading]);

  if (restaurants.length <= 1) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" />
            ¿Qué local quieres ver?
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Selecciona el restaurante para {pageName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          <button
            onClick={() => { onSelect('all'); setOpen(false); }}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group text-left"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-slate-100 rounded-xl flex items-center justify-center group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors">
              <Store className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">Ver todos los locales</p>
              <p className="text-xs text-gray-500 mt-0.5">Vista consolidada de {restaurants.length} locales</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </button>

          {restaurants.map((restaurant, idx) => (
            <motion.button
              key={restaurant.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => { onSelect(restaurant.id); setOpen(false); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group text-left"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-105 transition-transform">
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
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </motion.button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}