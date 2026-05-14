import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, MessageSquareWarning } from "lucide-react";

const ERROR_OPTIONS = [
  { id: 'supplier_name', label: 'Nombre del proveedor incorrecto' },
  { id: 'supplier_rut', label: 'RUT del proveedor incorrecto' },
  { id: 'products', label: 'Productos/items mal detectados' },
  { id: 'quantities', label: 'Cantidades o precios incorrectos' },
  { id: 'category', label: 'Categoría equivocada' },
  { id: 'amounts', label: 'Montos (neto/IVA/total) incorrectos' },
  { id: 'date', label: 'Fecha equivocada' },
  { id: 'invoice_number', label: 'Número de factura incorrecto' },
];

export default function ReanalyzeFeedbackDialog({ open, onOpenChange, invoiceType, onSubmit }) {
  const [selected, setSelected] = useState([]);
  const [details, setDetails] = useState('');

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    onSubmit({ errors: selected, details: details.trim() });
    setSelected([]);
    setDetails('');
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSubmit({ errors: [], details: '' });
    setSelected([]);
    setDetails('');
    onOpenChange(false);
  };

  // Filter relevant options based on invoice type
  const options = ERROR_OPTIONS.filter(opt => {
    if (invoiceType === 'opex' && opt.id === 'products') return false;
    if (invoiceType === 'opex' && opt.id === 'quantities') return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquareWarning className="w-5 h-5 text-amber-500" />
            ¿Qué necesita corrección?
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500">
          Indica qué errores detectaste para que la IA se enfoque en corregirlos.
        </p>

        <div className="space-y-2.5 py-2">
          {options.map(opt => (
            <label
              key={opt.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                selected.includes(opt.id)
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Checkbox
                checked={selected.includes(opt.id)}
                onCheckedChange={() => toggle(opt.id)}
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">Detalles adicionales (opcional)</Label>
          <Textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Ej: El proveedor se llama 'Distribuidora ABC', no 'ABC Ltda'. El tomate es 5kg, no 5 unidades..."
            className="h-20 text-sm resize-none"
          />
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="ghost" className="text-xs text-gray-400" onClick={handleSkip}>
            Re-analizar sin indicaciones
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selected.length === 0 && !details.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Re-analizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}