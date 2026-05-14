import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, UserCircle, Phone, StickyNote } from "lucide-react";

export default function SupplierContactsList({ contacts = [], onChange }) {
  const addContact = () => {
    onChange([...contacts, { name: '', phone: '', notes: '' }]);
  };

  const updateContact = (idx, field, value) => {
    const updated = contacts.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    onChange(updated);
  };

  const removeContact = (idx) => {
    onChange(contacts.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
          <UserCircle className="w-3.5 h-3.5 text-teal-600" />
          Vendedores / Contactos
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={addContact} className="h-7 text-xs gap-1 text-teal-600 hover:text-teal-700">
          <Plus className="w-3 h-3" /> Agregar
        </Button>
      </div>

      {contacts.length === 0 && (
        <p className="text-xs text-gray-400 italic">Sin vendedores registrados</p>
      )}

      <div className="space-y-2">
        {contacts.map((contact, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200 relative group">
            <button
              type="button"
              onClick={() => removeContact(idx)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <UserCircle className="w-3 h-3" /> Nombre
                </span>
                <Input
                  value={contact.name}
                  onChange={e => updateContact(idx, 'name', e.target.value)}
                  placeholder="Nombre del vendedor"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Teléfono
                </span>
                <Input
                  value={contact.phone}
                  onChange={e => updateContact(idx, 'phone', e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <StickyNote className="w-3 h-3" /> Notas
              </span>
              <Input
                value={contact.notes}
                onChange={e => updateContact(idx, 'notes', e.target.value)}
                placeholder="Horarios, especialidad, etc."
                className="h-8 text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}