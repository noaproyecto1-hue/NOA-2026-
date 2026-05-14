import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Store, CheckCircle2, ArrowRight, MapPin, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SelectRestaurantDialog({ 
  open, 
  onOpenChange, 
  restaurants = [],
  onSelect,
  title = "Selecciona un local",
  description = "Elige el restaurante donde aplicar esta acción"
}) {
  const [selected, setSelected] = useState(null);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
      setSelected(null);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelected(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-0 shadow-2xl rounded-3xl">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-white/10 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-white/30">
                <Store className="w-7 h-7 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">{title}</DialogTitle>
                <p className="text-white/80 text-sm mt-1">{description}</p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        </div>

        {/* Lista de restaurantes */}
        <div className="p-6 space-y-3 max-h-[320px] overflow-y-auto bg-gradient-to-b from-gray-50/50 to-white">
          <AnimatePresence>
            {restaurants.map((restaurant, index) => {
              const isSelected = selected === restaurant.id;
              return (
                <motion.div
                  key={restaurant.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelected(restaurant.id)}
                  className={`
                    relative p-4 rounded-2xl cursor-pointer transition-all duration-300 border-2
                    ${isSelected 
                      ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-lg shadow-indigo-100' 
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                        ${isSelected 
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg' 
                          : 'bg-gradient-to-br from-gray-100 to-gray-200'
                        }
                      `}>
                        <Store className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className={`font-semibold text-base ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {restaurant.name}
                        </p>
                        {restaurant.location && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <p className="text-sm text-gray-500 truncate max-w-[220px]">
                              {restaurant.location}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300
                      ${isSelected 
                        ? 'bg-indigo-500 scale-100' 
                        : 'bg-gray-100 scale-75 opacity-0 group-hover:opacity-100'
                      }
                    `}>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute -top-1 -right-1"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-gray-100 bg-white flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="rounded-xl px-6 hover:bg-gray-50"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selected}
            className="rounded-xl px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all duration-300"
          >
            Continuar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}