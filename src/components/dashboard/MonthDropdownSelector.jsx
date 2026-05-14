import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, getMonth, getYear, setMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCurrentDateInUserTz } from '@/components/utils/timezoneHelper';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const MONTHS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export default function MonthDropdownSelector({ selectedMonth, onChange }) {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const nowLocal = getCurrentDateInUserTz(user);
  const [open, setOpen] = useState(false);
  const currentYear = getYear(selectedMonth);
  const currentMonth = getMonth(selectedMonth);
  const label = format(selectedMonth, 'MMMM yyyy', { locale: es });

  const handleYearChange = (delta) => {
    const newDate = delta > 0 ? addMonths(selectedMonth, 12) : subMonths(selectedMonth, 12);
    onChange({ from: startOfMonth(newDate), to: endOfMonth(newDate) });
  };

  const handleMonthSelect = (monthNum) => {
    const newDate = setMonth(selectedMonth, monthNum);
    onChange({ from: startOfMonth(newDate), to: endOfMonth(newDate) });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 font-semibold text-sm capitalize shadow-sm h-9 px-4">
          <CalendarDays className="w-4 h-4 text-indigo-500" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        {/* Año */}
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleYearChange(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-bold text-sm text-gray-900">{currentYear}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleYearChange(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        {/* Grid de meses */}
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((m, i) => {
            const isSelected = i === currentMonth;
            const isFuture = i > nowLocal.getMonth() && currentYear >= nowLocal.getFullYear();
            return (
              <button
                key={i}
                onClick={() => !isFuture && handleMonthSelect(i)}
                disabled={isFuture}
                className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isFuture
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}