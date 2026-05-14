import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PRESETS = [
  { key: 'today', label: 'Hoy' },
  { key: '3days', label: 'Últimos 3 días' },
  { key: 'week', label: 'Última semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'custom', label: 'Rango personalizado' },
  { key: 'all', label: 'Todo' },
];

function getPresetRange(preset) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (preset === 'today') {
    return { from: todayStr, to: todayStr };
  }
  if (preset === '3days') {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return { from: d.toISOString().slice(0, 10), to: todayStr };
  }
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: todayStr };
  }
  if (preset === 'month') {
    return { from: `${todayStr.slice(0, 7)}-01`, to: todayStr };
  }
  return null; // 'all' or 'custom'
}

export function getDateRangeFromFilter(filter) {
  if (!filter || filter.preset === 'all') return null;
  if (filter.preset === 'custom') {
    return { from: filter.from, to: filter.to };
  }
  return getPresetRange(filter.preset);
}

export default function MovementDateFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value?.from || '');
  const [customTo, setCustomTo] = useState(value?.to || '');

  const activePreset = value?.preset || 'all';

  const handlePreset = (key) => {
    if (key === 'custom') {
      // Don't close — show date inputs
      onChange({ preset: 'custom', from: customFrom, to: customTo });
      return;
    }
    onChange({ preset: key });
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      onChange({ preset: 'custom', from: customFrom, to: customTo });
      setOpen(false);
    }
  };

  const displayLabel = useMemo(() => {
    if (activePreset === 'custom' && value?.from && value?.to) {
      const fmt = (d) => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}`;
      };
      return `${fmt(value.from)} — ${fmt(value.to)}`;
    }
    return PRESETS.find(p => p.key === activePreset)?.label || 'Todo';
  }, [activePreset, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 rounded-xl border-gray-200 bg-white shadow-sm text-sm gap-2 min-w-[150px]">
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="space-y-1">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activePreset === p.key
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {activePreset === 'custom' && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-xs rounded-lg"
              />
              <span className="text-xs text-gray-400">a</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-xs rounded-lg"
              />
            </div>
            <Button
              size="sm"
              className="w-full h-8 rounded-lg text-xs bg-blue-600 hover:bg-blue-700"
              onClick={handleApplyCustom}
              disabled={!customFrom || !customTo}
            >
              Aplicar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}