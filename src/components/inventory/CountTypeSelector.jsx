import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, CalendarDays } from "lucide-react";
import { motion } from 'framer-motion';

export default function CountTypeSelector({ open, onOpenChange, onSelect }) {
  const options = [
    {
      type: 'daily',
      icon: Calendar,
      title: 'Conteo Diario',
      description: 'Solo los insumos seleccionados por el administrador',
      gradient: 'from-blue-500 to-indigo-600',
      bg: 'bg-blue-50 border-blue-200'
    },
    {
      type: 'monthly',
      icon: CalendarDays,
      title: 'Conteo Mensual',
      description: 'Conteo completo de todos los insumos del restaurante',
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50 border-emerald-200'
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">¿Qué tipo de conteo vas a realizar?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {options.map((opt, idx) => {
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => { onSelect(opt.type); onOpenChange(false); }}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${opt.bg}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${opt.gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{opt.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}