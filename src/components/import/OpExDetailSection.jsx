import React, { useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

export default function OpExDetailSection({ form, set, opexCostCenters = [], suppliers = [] }) {
  // Obtener subcategorías del centro de costo seleccionado
  const selectedCenter = useMemo(() => {
    if (!form.suggested_cost_center) return null;
    return opexCostCenters.find(
      c => c.name.toLowerCase() === form.suggested_cost_center.toLowerCase()
    );
  }, [form.suggested_cost_center, opexCostCenters]);

  const subcategories = selectedCenter?.categories || [];

  return (
    <div className="p-3 bg-blue-50 rounded-xl space-y-2 border border-blue-100">
      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
        <Building2 className="w-3 h-3" /> Detalle del gasto
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Centro de costo</Label>
          {opexCostCenters.length > 0 ? (
            <Select 
              value={form.suggested_cost_center} 
              onValueChange={v => {
                set('suggested_cost_center', v);
                // Limpiar categoría al cambiar centro de costo
                set('suggested_opex_category', '');
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {opexCostCenters.map(c => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input 
              value={form.suggested_cost_center} 
              onChange={e => set('suggested_cost_center', e.target.value)} 
              placeholder="Centro de costo" 
              className="h-8 text-sm" 
            />
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Categoría</Label>
          {subcategories.length > 0 ? (
            <Select 
              value={form.suggested_opex_category} 
              onValueChange={v => {
                set('suggested_opex_category', v);
                // Si hay proveedor matcheado, verificar si esta categoría sugiere un centro de costo
                const matched = form._matchedSupplier || suppliers.find(s => 
                  s.name && form.supplier_name && s.name.toLowerCase().trim() === form.supplier_name.toLowerCase().trim()
                );
                if (matched?.opex_categories?.length > 0 && v !== '__new__') {
                  const catMatch = matched.opex_categories.find(oc => 
                    (oc.category || '').toLowerCase() === (v || '').toLowerCase()
                  );
                  if (catMatch && catMatch.cost_center && catMatch.cost_center !== form.suggested_cost_center) {
                    set('suggested_cost_center', catMatch.cost_center);
                  }
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
              <SelectContent>
                {subcategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
                <SelectItem value="__new__">+ Nueva categoría...</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input 
              value={form.suggested_opex_category} 
              onChange={e => set('suggested_opex_category', e.target.value)} 
              placeholder="Subcategoría del gasto" 
              className="h-8 text-sm" 
            />
          )}
          {form.suggested_opex_category === '__new__' && (
            <Input 
              value=""
              onChange={e => set('suggested_opex_category', e.target.value)} 
              placeholder="Escribe la nueva categoría..."
              className="h-8 text-sm mt-1"
              autoFocus
            />
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-gray-500">Descripción</Label>
        <Textarea 
          value={form.description} 
          onChange={e => set('description', e.target.value)} 
          className="text-sm resize-none" 
          rows={2} 
        />
      </div>
    </div>
  );
}