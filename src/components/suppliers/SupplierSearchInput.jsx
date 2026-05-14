import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X, Check, Truck, CreditCard, Clock } from "lucide-react";

const paymentTermsLabels = {
  contado: 'Contado', '7_dias': '7 días', '15_dias': '15 días', '30_dias': '30 días',
};

const paymentMethodLabels = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', cheque: 'Cheque'
};

export default function SupplierSearchInput({
  suppliers = [],
  value = '',
  taxIdValue = '',
  onChange,
  onTaxIdChange,
  onSupplierSelect,
  placeholder = "Buscar proveedor..."
}) {
  const [search, setSearch] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search || !search.trim()) return suppliers.filter(s => s.is_active !== false).slice(0, 10);
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      s.is_active !== false && (
        s.name?.toLowerCase().includes(q) ||
        s.tax_id?.toLowerCase().includes(q)
      )
    ).slice(0, 10);
  }, [suppliers, search]);

  const handleSelect = (supplier) => {
    setSearch(supplier.name);
    onChange(supplier.name);
    if (onTaxIdChange && supplier.tax_id) onTaxIdChange(supplier.tax_id);
    if (onSupplierSelect) onSupplierSelect(supplier);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSearch('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none z-10" />
      <Input
        ref={inputRef}
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
        className="h-9 text-sm pl-8 pr-8"
      />
      {search && (
        <button type="button" onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10">
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {showDropdown && filtered.length > 0 && (
        <div ref={dropdownRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s)}
              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-teal-50 flex items-start gap-2 transition-colors border-b border-gray-50 last:border-0 ${
                search === s.name ? 'bg-teal-50 text-teal-700' : 'text-gray-700'
              }`}
            >
              <Truck className="w-3.5 h-3.5 mt-0.5 text-teal-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{s.name}</span>
                  {s.tax_id && <span className="text-xs font-mono text-gray-400">{s.tax_id}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                  {s.payment_method && (
                    <span className="flex items-center gap-0.5">
                      <CreditCard className="w-2.5 h-2.5" />
                      {paymentMethodLabels[s.payment_method]}
                    </span>
                  )}
                  {s.payment_terms && s.payment_terms !== 'contado' && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {paymentTermsLabels[s.payment_terms]}
                    </span>
                  )}
                </div>
              </div>
              {search === s.name && <Check className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}