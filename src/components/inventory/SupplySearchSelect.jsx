import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Check, Package, X } from 'lucide-react';
import { Input } from "@/components/ui/input";

export default function SupplySearchSelect({ items = [], selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selectedItem = items.find(s => s.id === selectedId);

  const filtered = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return items.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [items, query]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item) => {
    onSelect(item.id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setQuery('');
    onSelect('');
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Selected item display or search input */}
      {selectedId && selectedItem && !open ? (
        <div
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 px-3 cursor-pointer hover:bg-emerald-100 transition-colors"
        >
          <div className="w-7 h-7 bg-emerald-200 rounded-lg flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-emerald-700" />
          </div>
          <span className="font-semibold text-gray-900 text-sm flex-1 truncate">{selectedItem.name}</span>
          <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{selectedItem.unit_of_measure}</span>
          <button onClick={handleClear} className="text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar insumo por nombre..."
            className="h-11 pl-10 rounded-xl bg-gray-50 border-gray-200 focus:bg-white transition-colors"
          />
        </div>
      )}

      {/* Dropdown */}
      {open && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Package className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No se encontró "{query}"</p>
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-orange-50 transition-colors ${
                  item.id === selectedId ? 'bg-emerald-50' : ''
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  item.id === selectedId ? 'bg-emerald-200 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {item.id === selectedId ? <Check className="w-3.5 h-3.5" /> : item.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {item.category && <p className="text-[10px] text-gray-400">{item.category}</p>}
                </div>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{item.unit_of_measure}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}