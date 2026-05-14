import React from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Check, X, CalendarRange } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, isSameDay, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { getCurrentDateInUserTz, formatDateInUserTz, getUserTimezone } from '@/components/utils/timezoneHelper';

// Los presets ahora se generan dinámicamente según la zona horaria del usuario
const getPresets = (user) => {
  const now = getCurrentDateInUserTz(user) || new Date();
  return [
    { label: "Hoy", getValue: () => ({ from: startOfDay(now), to: endOfDay(now) }) },
    { label: "Esta semana", getValue: () => ({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }) },
    { label: "Este mes", getValue: () => ({ from: startOfMonth(now), to: endOfMonth(now) }) },
    { label: "Mes anterior", getValue: () => ({ from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) }) },
    { label: "Últimos 3 meses", getValue: () => ({ from: startOfMonth(subMonths(now, 2)), to: now }) },
    { label: "Todo el año", getValue: () => ({ from: startOfYear(now), to: endOfYear(now) }) },
  ];
};

export default function DateRangePicker({ 
  dateRange,
  value,
  onChange,
  className = "",
  user = null // Usuario para zona horaria
}) {
  // Soportar tanto 'dateRange' como 'value' para compatibilidad
  const range = dateRange || value;
  const [open, setOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState(null);
  const [selectionMode, setSelectionMode] = React.useState('single'); // 'single' o 'range'

  // Presets basados en zona horaria del usuario
  const presets = getPresets(user);

  // Resetear estado temporal cuando se abre el popover
  React.useEffect(() => {
    if (open) {
      setTempRange(null);
    }
  }, [open]);

  const handlePresetClick = (preset) => {
    onChange(preset.getValue());
    setOpen(false);
  };

  // Selección de día único
  const handleSingleDaySelect = (date) => {
    if (date) {
      onChange({ from: startOfDay(date), to: endOfDay(date) });
      setOpen(false);
    }
  };

  // Selección de rango
  const handleRangeSelect = (newRange) => {
    setTempRange(newRange);
  };

  const confirmRangeSelection = () => {
    if (tempRange?.from) {
      onChange({
        from: startOfDay(tempRange.from),
        to: tempRange.to ? endOfDay(tempRange.to) : endOfDay(tempRange.from)
      });
      setOpen(false);
    }
  };

  const cancelSelection = () => {
    setTempRange(null);
    setOpen(false);
  };

  // Formatear el texto del botón
  const getButtonText = () => {
    if (!range?.from) return <span className="text-gray-500">Seleccionar fecha</span>;
    
    if (range.to && isSameDay(range.from, range.to)) {
      return format(range.from, "d 'de' MMMM yyyy", { locale: es });
    }
    
    if (range.to) {
      return (
        <>
          {format(range.from, "d MMM", { locale: es })} - {format(range.to, "d MMM yyyy", { locale: es })}
        </>
      );
    }
    
    return format(range.from, "d 'de' MMMM yyyy", { locale: es });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full md:w-auto justify-start text-left font-medium ${className}`}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {getButtonText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col">
          {/* Selector de modo */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setSelectionMode('single')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                selectionMode === 'single' 
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CalendarIcon className="w-4 h-4 inline mr-1.5" />
              Un día
            </button>
            <button
              onClick={() => setSelectionMode('range')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                selectionMode === 'range' 
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CalendarRange className="w-4 h-4 inline mr-1.5" />
              Rango
            </button>
          </div>

          <div className="flex">
            {/* Accesos rápidos */}
            <div className="border-r border-gray-100 p-3 space-y-1 min-w-[140px]">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-2">Acceso rápido</p>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Calendario */}
            <div className="p-2">
              {selectionMode === 'single' ? (
                <>
                  <p className="text-xs text-gray-500 text-center mb-2">
                    Haz clic en un día para seleccionarlo
                  </p>
                  <Calendar
                    mode="single"
                    selected={range?.from}
                    onSelect={handleSingleDaySelect}
                    numberOfMonths={1}
                    locale={es}
                    className="rounded-lg"
                  />
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 text-center mb-2">
                    {!tempRange?.from 
                      ? "Selecciona fecha inicio" 
                      : !tempRange?.to 
                        ? "Selecciona fecha fin" 
                        : "Rango seleccionado"}
                  </p>
                  <Calendar
                    mode="range"
                    selected={tempRange || range}
                    onSelect={handleRangeSelect}
                    numberOfMonths={1}
                    locale={es}
                    className="rounded-lg"
                  />
                  
                  {/* Botones de confirmación para rango */}
                  {tempRange?.from && (
                    <div className="flex gap-2 mt-3 px-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={cancelSelection}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={confirmRangeSelection}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aplicar
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}