import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users } from 'lucide-react';

const roleLabels = {
  waiter: 'Mesero/a', chef: 'Chef / Cocinero', bartender: 'Bartender',
  cashier: 'Cajero/a', host: 'Host / Recepción', manager: 'Gerente',
  assistant: 'Auxiliar', delivery: 'Repartidor', cleaning: 'Limpieza', other: 'Otro'
};

const roleColors = {
  waiter: 'bg-blue-100 text-blue-700',
  chef: 'bg-amber-100 text-amber-700',
  bartender: 'bg-purple-100 text-purple-700',
  cashier: 'bg-green-100 text-green-700',
  host: 'bg-pink-100 text-pink-700',
  manager: 'bg-red-100 text-red-700',
  assistant: 'bg-gray-100 text-gray-700',
  delivery: 'bg-orange-100 text-orange-700',
  cleaning: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-700'
};

export default function EmployeeDirectoryTab({ employees, onEmployeeClick, classificationMode, employeeAreas }) {
  const [search, setSearch] = React.useState('');
  const [filterValue, setFilterValue] = React.useState('all');
  const isAreaMode = classificationMode === 'areas';

  // Get unique roles or areas from employees
  const filterOptions = React.useMemo(() => {
    if (isAreaMode) {
      const areas = [...new Set(employees.map(e => e.area || '').filter(Boolean))];
      return areas.sort();
    }
    const roles = [...new Set(employees.map(e => e.role || 'other'))];
    return roles.sort();
  }, [employees, isAreaMode]);

  const filtered = employees.filter(emp => {
    if (search && !emp.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterValue !== 'all') {
      if (isAreaMode) {
        if ((emp.area || '') !== filterValue) return false;
      } else {
        if (emp.role !== filterValue) return false;
      }
    }
    return true;
  });

  const getRoleLabel = (role) => roleLabels[role] || role;
  const getRoleColor = (role) => roleColors[role] || roleColors.other;
  const getAreaColor = () => 'bg-teal-100 text-teal-700';

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Directorio de Empleados
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-gray-50"
              />
            </div>
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-[160px] bg-gray-50">
                <SelectValue placeholder={isAreaMode ? "Todas las áreas" : "Todos los cargos"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isAreaMode ? "Todas las áreas" : "Todos los cargos"}</SelectItem>
                {filterOptions.map(opt => (
                  <SelectItem key={opt} value={opt}>{isAreaMode ? opt : getRoleLabel(opt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((emp, idx) => (
            <div 
              key={emp.id || idx} 
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all cursor-pointer"
              onClick={() => onEmployeeClick?.(emp)}
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{emp.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className={`${isAreaMode ? getAreaColor() : getRoleColor(emp.role || 'other')} border-0 text-[10px]`}>
                    {isAreaMode ? (emp.area || 'Sin área') : getRoleLabel(emp.role || 'other')}
                  </Badge>
                  {emp.salary && (
                    <span className="text-[10px] text-gray-400">💰</span>
                  )}
                  {emp.phone && (
                    <span className="text-[10px] text-gray-400">📞</span>
                  )}
                </div>
              </div>
              {emp.restaurant_name && (
                <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{emp.restaurant_name}</span>
              )}
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay empleados que coincidan con el filtro</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}