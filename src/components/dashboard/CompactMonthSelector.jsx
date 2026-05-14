import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, getMonth, getYear, setMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCurrentDateInUserTz } from '@/components/utils/timezoneHelper';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const MONTHS = [
  { short: 'Ene', num: 0 },
  { short: 'Feb', num: 1 },
  { short: 'Mar', num: 2 },
  { short: 'Abr', num: 3 },
  { short: 'May', num: 4 },
  { short: 'Jun', num: 5 },
  { short: 'Jul', num: 6 },
  { short: 'Ago', num: 7 },
  { short: 'Sep', num: 8 },
  { short: 'Oct', num: 9 },
  { short: 'Nov', num: 10 },
  { short: 'Dic', num: 11 }
];

export default function CompactMonthSelector({ selectedMonth, onChange, compact = false }) {
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const nowLocal = getCurrentDateInUserTz(user);
  const currentYear = getYear(selectedMonth);
  const currentMonth = getMonth(selectedMonth);

  const handleYearChange = (delta) => {
    const newDate = delta > 0 ? addMonths(selectedMonth, 12) : subMonths(selectedMonth, 12);
    onChange({
      from: startOfMonth(newDate),
      to: endOfMonth(newDate)
    });
  };

  const handleMonthSelect = (monthNum) => {
    const newDate = setMonth(selectedMonth, monthNum);
    onChange({
      from: startOfMonth(newDate),
      to: endOfMonth(newDate)
    });
  };

  return (
    <div className={`bg-white rounded-xl shadow-md ${compact ? 'p-2' : 'p-3'} w-full ${compact ? '' : 'h-full'} flex flex-col`}>
      {/* Año */}
      <div className="flex items-center justify-between mb-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className={compact ? "h-6 w-6" : "h-7 w-7"}
          onClick={() => handleYearChange(-1)}
        >
          <ChevronLeft className={compact ? "w-3 h-3" : "w-4 h-4"} />
        </Button>
        <span className={`font-bold text-gray-900 ${compact ? 'text-xs' : ''}`}>{currentYear}</span>
        <Button 
          variant="ghost" 
          size="icon" 
          className={compact ? "h-6 w-6" : "h-7 w-7"}
          onClick={() => handleYearChange(1)}
        >
          <ChevronRight className={compact ? "w-3 h-3" : "w-4 h-4"} />
        </Button>
      </div>

      {/* Grid de meses */}
      <div className={`grid ${compact ? 'grid-cols-3 gap-0.5' : 'grid-cols-2 gap-1'} flex-1 content-start`}>
        {MONTHS.map((month) => {
          const isSelected = month.num === currentMonth;
          const isFuture = month.num > nowLocal.getMonth() && currentYear >= nowLocal.getFullYear();
          
          return (
            <button
              key={month.num}
              onClick={() => !isFuture && handleMonthSelect(month.num)}
              disabled={isFuture}
              className={`
                ${compact ? 'py-1 px-1 text-[10px]' : 'py-1.5 px-2 text-xs'} rounded-lg font-medium transition-all
                ${isSelected 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : isFuture
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {month.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}