import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from 'framer-motion';
import { Star, FlaskConical, Search, Trophy, UserCircle, ChevronDown, Calendar, ChefHat } from "lucide-react";
import { useState } from 'react';

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default function SamplingStarsPanel({ accessibleRestaurantIds = [], selectedRestaurant = 'all' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const currentWeek = getWeekNumber(now);

  // Fetch all samples for the month from accessible restaurants
  const { data: allSamples = [] } = useQuery({
    queryKey: ['recipeSamplesEmployees', accessibleRestaurantIds, currentMonth],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return [];
      const samples = await base44.entities.RecipeSample.list('-date', 500);
      return samples.filter(s => 
        accessibleRestaurantIds.includes(s.restaurant_id) && 
        s.month === currentMonth &&
        (selectedRestaurant === 'all' || s.restaurant_id === selectedRestaurant)
      );
    },
    enabled: accessibleRestaurantIds.length > 0
  });

  // Fetch deviation configs
  const { data: configs = [] } = useQuery({
    queryKey: ['deviationConfigs', accessibleRestaurantIds],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return [];
      const all = await base44.entities.DeviationConfig.list();
      return all.filter(c => accessibleRestaurantIds.includes(c.restaurant_id));
    },
    enabled: accessibleRestaurantIds.length > 0
  });

  // Fetch recipes to know how many are eligible
  const { data: recipes = [] } = useQuery({
    queryKey: ['recipesForStars', accessibleRestaurantIds],
    queryFn: async () => {
      if (accessibleRestaurantIds.length === 0) return [];
      const all = await base44.entities.Recipe.filter({ is_active: true });
      return all.filter(r => accessibleRestaurantIds.includes(r.restaurant_id) && !r.is_sub_recipe);
    },
    enabled: accessibleRestaurantIds.length > 0
  });

  // Group by employee and calculate stars
  const employeeRanking = useMemo(() => {
    const byEmail = {};
    
    allSamples.forEach(sample => {
      const email = sample.sampled_by_email;
      if (!email) return;
      if (!byEmail[email]) {
        byEmail[email] = {
          email,
          name: sample.sampled_by_name || email,
          totalSamples: 0,
          weekSamples: {},
          avgDeviation: 0,
          deviations: []
        };
      }
      byEmail[email].totalSamples++;
      byEmail[email].deviations.push(sample.overall_deviation_percent || 0);
      
      const week = sample.week_number;
      if (!byEmail[email].weekSamples[week]) byEmail[email].weekSamples[week] = 0;
      byEmail[email].weekSamples[week]++;
    });

    // Calculate stars: 1 star per week where they completed their assigned samples
    // Simplified: if they did at least 1 sample per week, they get a star
    const totalRecipes = recipes.length;
    const avgConfig = configs.length > 0 
      ? configs.reduce((s, c) => s + (c.samples_per_recipe_per_month || 3), 0) / configs.length 
      : 3;
    const weeklyTarget = Math.ceil(avgConfig / 4) * Math.max(1, Math.ceil(totalRecipes / 4));

    return Object.values(byEmail).map(emp => {
      const avgDev = emp.deviations.length > 0 
        ? emp.deviations.reduce((s, d) => s + d, 0) / emp.deviations.length 
        : 0;
      
      // Count weeks where target was met
      let starsEarned = 0;
      for (let w = currentWeek - 3; w <= currentWeek; w++) {
        const weekCount = emp.weekSamples[w] || 0;
        if (weekCount >= Math.max(1, Math.ceil(weeklyTarget / 4))) {
          starsEarned++;
        }
      }

      return {
        ...emp,
        avgDeviation: Math.round(avgDev * 10) / 10,
        starsEarned: Math.min(starsEarned, 4),
        weeklyTarget
      };
    }).sort((a, b) => b.starsEarned - a.starsEarned || b.totalSamples - a.totalSamples);
  }, [allSamples, configs, recipes, currentWeek]);

  const filtered = employeeRanking.filter(e => 
    !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSamples = allSamples.length;
  const avgStars = filtered.length > 0 
    ? filtered.reduce((s, e) => s + e.starsEarned, 0) / filtered.length 
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-400 to-amber-500 border-0 shadow-xl">
          <CardContent className="p-4 text-center">
            <p className="text-yellow-100 text-xs font-medium uppercase tracking-wider">Estrellas Promedio</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[...Array(4)].map((_, i) => (
                <Star key={i} className={`w-5 h-5 ${i < Math.round(avgStars) ? 'text-white fill-white' : 'text-white/30'}`} />
              ))}
            </div>
            <p className="text-white text-xs mt-1">{avgStars.toFixed(1)}/4</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500 to-violet-600 border-0 shadow-xl">
          <CardContent className="p-4 text-center">
            <p className="text-indigo-100 text-xs font-medium uppercase tracking-wider">Muestreos Totales</p>
            <p className="text-2xl font-black text-white mt-1">{totalSamples}</p>
            <p className="text-indigo-200 text-xs">este mes</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-green-600 border-0 shadow-xl">
          <CardContent className="p-4 text-center">
            <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Personal de Cocina</p>
            <p className="text-2xl font-black text-white mt-1">{employeeRanking.length}</p>
            <p className="text-emerald-200 text-xs">han muestreado</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Buscar personal de cocina..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 rounded-xl" />
      </div>

      {/* Employee ranking */}
      <div className="space-y-2">
        {filtered.map((emp, idx) => {
          const isExpanded = expandedEmployee === emp.email;
          const empSamples = allSamples.filter(s => s.sampled_by_email === emp.email).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

          return (
          <motion.div key={emp.email} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Card className={`border transition-all ${isExpanded ? 'border-indigo-200 shadow-lg' : 'border-gray-100 hover:shadow-lg'}`}>
              <CardContent className="p-0">
                {/* Clickable header */}
                <button
                  onClick={() => setExpandedEmployee(isExpanded ? null : emp.email)}
                  className="w-full p-4 flex items-center gap-4 text-left"
                >
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-lg ${
                    idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg' :
                    idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-md' :
                    idx === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-white shadow-md' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {idx < 3 ? <Trophy className="w-5 h-5" /> : idx + 1}
                  </div>

                  {/* Avatar + Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                        <UserCircle className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm truncate">{emp.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-gray-400">Muestreos</p>
                      <p className="font-bold text-indigo-700">{emp.totalSamples}</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-gray-400">Desv. Prom.</p>
                      <Badge className={`border-0 text-xs font-bold ${
                        Math.abs(emp.avgDeviation) <= 5 ? 'bg-emerald-100 text-emerald-700' :
                        Math.abs(emp.avgDeviation) <= 15 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {emp.avgDeviation > 0 ? '+' : ''}{emp.avgDeviation}%
                      </Badge>
                    </div>

                    {/* Stars */}
                    <div className="flex items-center gap-0.5">
                      {[...Array(4)].map((_, i) => (
                        <Star key={i} className={`w-5 h-5 ${
                          i < emp.starsEarned 
                            ? 'text-yellow-400 fill-yellow-400 drop-shadow-sm' 
                            : 'text-gray-200'
                        }`} />
                      ))}
                    </div>

                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expandable detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Detalle de muestreos este mes</p>
                        {empSamples.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">Sin muestreos registrados</p>
                        ) : empSamples.map((sample, sIdx) => (
                          <div key={sample.id || sIdx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                            {/* Sample header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ChefHat className="w-4 h-4 text-orange-500" />
                                <span className="font-semibold text-sm text-gray-900">{sample.recipe_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`border-0 text-xs font-bold ${
                                  Math.abs(sample.overall_deviation_percent || 0) <= 5 ? 'bg-emerald-100 text-emerald-700' :
                                  Math.abs(sample.overall_deviation_percent || 0) <= 15 ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {(sample.overall_deviation_percent || 0) > 0 ? '+' : ''}{(sample.overall_deviation_percent || 0).toFixed(1)}%
                                </Badge>
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {sample.date ? new Date(sample.date + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '—'}
                                </span>
                              </div>
                            </div>

                            {/* Ingredients detail */}
                            {(sample.ingredients || []).length > 0 && (
                              <div className="space-y-1">
                                {sample.ingredients.map((ing, iIdx) => {
                                  const dev = ing.deviation_percent || 0;
                                  return (
                                    <div key={iIdx} className="flex items-center justify-between text-xs px-2 py-1.5 bg-white rounded-lg">
                                      <span className="text-gray-700 font-medium">{ing.supply_name}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-gray-400">
                                          {ing.actual_quantity ?? '—'} / {ing.expected_quantity ?? '—'} {ing.unit || ''}
                                        </span>
                                        <span className={`font-bold min-w-[50px] text-right ${
                                          Math.abs(dev) <= 5 ? 'text-emerald-600' :
                                          Math.abs(dev) <= 15 ? 'text-amber-600' :
                                          'text-red-600'
                                        }`}>
                                          {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
          );
        })}

        {filtered.length === 0 && (
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <FlaskConical className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No hay muestreos registrados</p>
              <p className="text-sm text-gray-400 mt-1">El personal de cocina debe realizar muestreos desde Cocina → Muestreos</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}