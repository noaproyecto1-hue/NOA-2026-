import React from 'react';
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function MonthSelector({ 
  selectedMonth,
  onChange,
  year = new Date().getFullYear()
}) {
  const currentMonth = selectedMonth ? new Date(selectedMonth).getMonth() : new Date().getMonth();
  const currentYear = selectedMonth ? new Date(selectedMonth).getFullYear() : year;

  const handleMonthClick = (monthIndex) => {
    const newDate = new Date(currentYear, monthIndex, 1);
    onChange({
      from: startOfMonth(newDate),
      to: endOfMonth(newDate)
    });
  };

  const handleYearChange = (delta) => {
    const newYear = currentYear + delta;
    const newDate = new Date(newYear, currentMonth, 1);
    onChange({
      from: startOfMonth(newDate),
      to: endOfMonth(newDate)
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
      <div className="flex items-center justify-between mb-3">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleYearChange(-1)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-gray-900">{currentYear}</span>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleYearChange(1)}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {months.map((month, index) => (
          <Button
            key={month}
            variant={currentMonth === index ? "default" : "ghost"}
            size="sm"
            onClick={() => handleMonthClick(index)}
            className={`text-xs h-8 ${
              currentMonth === index 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {month}
          </Button>
        ))}
      </div>
    </div>
  );
}