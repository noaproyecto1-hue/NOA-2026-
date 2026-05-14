import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { 
  Globe, 
  Clock, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Calendar,
  Sun,
  Moon
} from "lucide-react";
import { motion } from "framer-motion";
import { 
  TIMEZONES_BY_REGION, 
  getUserTimezone, 
  getTimezoneLabel,
  formatDateInUserTz,
  getCurrentTimeInUserTz,
  getTodayInUserTz
} from '@/components/utils/timezoneHelper';

export default function TimezoneSettings({ user, onSave, isSaving }) {
  const [selectedTimezone, setSelectedTimezone] = useState(getUserTimezone(user));
  const [currentTime, setCurrentTime] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Actualizar hora actual cada segundo
  useEffect(() => {
    const updateTime = () => {
      const mockUser = { timezone: selectedTimezone };
      setCurrentTime(formatDateInUserTz(new Date(), 'HH:mm:ss', mockUser));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [selectedTimezone]);

  // Detectar cambios
  useEffect(() => {
    setHasChanges(selectedTimezone !== getUserTimezone(user));
  }, [selectedTimezone, user]);

  const handleSave = () => {
    onSave({ timezone: selectedTimezone });
  };

  const mockUser = { timezone: selectedTimezone };
  const currentDate = getTodayInUserTz(mockUser);
  const formattedDate = formatDateInUserTz(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", mockUser);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Info Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">¿Por qué es importante la zona horaria?</h3>
              <p className="text-sm text-blue-700">
                La zona horaria afecta cómo se registran y muestran todas las fechas en tu sistema: 
                ventas, compras, alertas, reportes y conversaciones con el asistente NOA. 
                Asegúrate de seleccionar la zona correcta para tu ubicación.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Settings Card */}
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="block">Zona Horaria</span>
              <span className="text-sm font-normal text-white/70">Configura tu ubicación</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Current Timezone Display */}
          <div className="bg-gradient-to-br from-slate-800 to-gray-900 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <span className="text-white/70 text-sm">Hora actual en tu zona</span>
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                {getTimezoneLabel(selectedTimezone)}
              </Badge>
            </div>
            <div className="text-center py-4">
              <div className="text-5xl font-bold font-mono tracking-wider text-white mb-2">
                {currentTime}
              </div>
              <div className="text-white/60 text-sm flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" />
                {formattedDate}
              </div>
            </div>
          </div>

          {/* Timezone Selector */}
          <div className="space-y-3">
            <Label className="text-gray-700 font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-500" />
              Selecciona tu zona horaria
            </Label>
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Selecciona zona horaria" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {Object.entries(TIMEZONES_BY_REGION).map(([region, timezones]) => (
                  <SelectGroup key={region}>
                    <SelectLabel className="text-xs text-gray-500 font-bold uppercase tracking-wider px-2 py-2 bg-gray-50">
                      {region}
                    </SelectLabel>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value} className="py-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>{tz.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-4 border-t"
            >
              <Button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Guardar Zona Horaria
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Impact Info */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            ¿Qué afecta este cambio?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '📊', text: 'Fechas en reportes y dashboards' },
              { icon: '🛒', text: 'Registro de ventas y compras' },
              { icon: '🔔', text: 'Fechas de alertas generadas' },
              { icon: '🤖', text: 'Contexto temporal del asistente NOA' },
              { icon: '📅', text: 'Filtros de fecha en todo el sistema' },
              { icon: '📈', text: 'Gráficos y análisis por período' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}