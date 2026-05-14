import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users } from 'lucide-react';

const roleLabels = {
  waiter: 'Mesero/a', chef: 'Chef / Cocinero', bartender: 'Bartender',
  cashier: 'Cajero/a', host: 'Host / Recepción', manager: 'Gerente',
  assistant: 'Auxiliar', delivery: 'Repartidor', cleaning: 'Limpieza', other: 'Otro'
};

const roleColors = {
  waiter: 'bg-blue-100 text-blue-700',
  chef: 'bg-amber-100 text-amber-700',
  bartender: 'bg-purple-100 text-purple-700',
  cashier: 'bg-green-100 text-green-700',
  host: 'bg-pink-100 text-pink-700',
  manager: 'bg-red-100 text-red-700',
  assistant: 'bg-gray-100 text-gray-700',
  delivery: 'bg-orange-100 text-orange-700',
  cleaning: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-700'
};

export default function EmployeeRosterModal({ open, onOpenChange, employees, classificationMode }) {
  const isAreaMode = classificationMode === 'areas';
  const byGroup = useMemo(() => {
    const map = {};
    employees.forEach(emp => {
      const key = isAreaMode ? (emp.area || 'Sin área') : (emp.role || 'other');
      if (!map[key]) map[key] = [];
      map[key].push(emp);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [employees, isAreaMode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Empleados Activos por {isAreaMode ? 'Área' : 'Cargo'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {byGroup.map(([group, emps]) => (
            <div key={group} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <Badge className={`${isAreaMode ? 'bg-teal-100 text-teal-700' : (roleColors[group] || roleColors.other)} border-0 text-xs`}>
                  {isAreaMode ? group : (roleLabels[group] || group)}
                </Badge>
                <span className="text-lg font-black text-gray-900">{emps.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {emps.map((emp, i) => (
                  <span key={i} className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded-md border">
                    {emp.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {byGroup.length === 0 && (
            <p className="text-center text-gray-400 py-6 text-sm">No hay empleados configurados</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}