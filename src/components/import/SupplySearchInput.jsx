import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Search, X, Package } from "lucide-react";

export default function SupplySearchInput({ supplyItems = [], onSelect, onClear, selectedName }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim().length >= 2
    ? supplyItems.filter(s => 
        (s.name || '').toLowerCase().includes(query.toLowerCase().trim())
      ).slice(0, 15)
    : [];

  const handleSelect = (supply) => {
    onSelect(supply.name);
    setQuery('');
    setIsOpen(false);
  };

  if (selectedName) {
    return (
      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
        <Package className="w-3 h-3 text-emerald-600 shrink-0" />
        <span className="text-xs text-emerald-700 font-medium truncate flex-1">{selectedName}</span>
        <button 
          onClick={onClear}
          className="text-emerald-400 hover:text-red-500 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar insumo existente..."
          className="h-8 text-xs pl-7 pr-2"
        />
      </div>
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 p-3 text-center">No se encontraron insumos</p>
          ) : (
            filtered.map((s, i) => (
              <button
                key={s.id || i}
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-xs flex items-center justify-between gap-2 border-b border-gray-50 last:border-0 transition-colors"
              >
                <span className="font-medium text-gray-800 truncate">{s.name}</span>
                <span className="text-gray-400 shrink-0">{s.unit_of_measure} · {s.category || '—'}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}