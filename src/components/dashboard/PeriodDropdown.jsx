import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, setMonth, setYear, getMonth, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCurrentDateInUserTz } from '@/components/utils/timezoneHelper';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const MONTHS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export default function PeriodDropdown({ viewMode, dateRange, onDateChange, annualYear, onAnnualYearChange }) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const btnRef = useRef(null);
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const now = getCurrentDateInUserTz(user);

  const updatePosition = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.right });
    }
  };

  const toggleOpen = () => {
    if (!open) updatePosition();
    setOpen(!open);
  };

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (viewMode === 'monthly') {
    const selectedMonth = getMonth(dateRange.from);
    const selectedYear = getYear(dateRange.from);
    const label = format(dateRange.from, 'MMMM yyyy', { locale: es });

    const handleMonthSelect = (monthNum) => {
      const newDate = setMonth(dateRange.from, monthNum);
      onDateChange({ from: startOfMonth(newDate), to: endOfMonth(newDate) });
      setOpen(false);
    };

    const handleYearNav = (delta) => {
      const newYear = selectedYear + delta;
      const newDate = setYear(dateRange.from, newYear);
      onDateChange({ from: startOfMonth(newDate), to: endOfMonth(newDate) });
    };

    return (
      <div className="relative">
        <button
          ref={btnRef}
          onClick={toggleOpen}
          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-all border border-white/20"
        >
          <span className="capitalize">{label}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && ReactDOM.createPortal(
          <div 
            ref={ref}
            className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-56"
            style={{ top: dropdownPos.top, left: dropdownPos.left - 224 }}
          >
            {/* Year nav */}
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => { handleYearNav(-1); updatePosition(); }} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <span className="font-bold text-gray-900 text-sm">{selectedYear}</span>
              <button 
                onClick={() => { handleYearNav(1); updatePosition(); }} 
                disabled={selectedYear >= now.getFullYear()}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 disabled:opacity-30"
              >
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            </div>
            {/* Month grid - all 12 months */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((m, i) => {
                const isFuture = selectedYear === now.getFullYear() && i > now.getMonth();
                const isSelected = i === selectedMonth && selectedYear === getYear(dateRange.from);
                return (
                  <button
                    key={i}
                    onClick={() => !isFuture && handleMonthSelect(i)}
                    disabled={isFuture}
                    className={`py-2.5 px-1 rounded-lg text-xs font-semibold transition-all
                      ${isSelected 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : isFuture 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  if (viewMode === 'annual') {
    const currentAnnualYear = annualYear || now.getFullYear();
    const years = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
      years.push(y);
    }

    return (
      <div className="relative">
        <button
          ref={btnRef}
          onClick={toggleOpen}
          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-all border border-white/20"
        >
          <span>Año {currentAnnualYear}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && ReactDOM.createPortal(
          <div 
            ref={ref}
            className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 p-2 w-32"
            style={{ top: dropdownPos.top, left: dropdownPos.left - 128 }}
          >
            {years.map(y => (
              <button
                key={y}
                onClick={() => { onAnnualYearChange(y); setOpen(false); }}
                className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all text-left
                  ${y === currentAnnualYear 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                  }`}
              >
                {y}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    );
  }

  return null;
}