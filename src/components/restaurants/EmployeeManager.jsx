import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, Trash2, Pencil, X, Check, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from "sonner";

export default function EmployeeManager({ employees = [], areas = [], onChange }) {
  const [newEmployee, setNewEmployee] = useState({ name: '', area: '', phone: '', salary: '', notes: '' });
  const [newRut, setNewRut] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState('');

  const checkDuplicate = (name, excludeId = null) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) { setDuplicateWarning(''); return false; }
    const found = employees.find(e =>
      e.name.trim().toLowerCase() === normalized && e.id !== excludeId
    );
    if (found) {
      setDuplicateWarning(`"${found.name}" ya existe en el equipo`);
      return true;
    }
    setDuplicateWarning('');
    return false;
  };

  const handleAdd = () => {
    if (!newEmployee.name.trim()) return;
    if (checkDuplicate(newEmployee.name)) {
      toast.error(`El empleado "${newEmployee.name.trim()}" ya se encuentra en el sistema`);
      return;
    }
    const employee = {
      id: Date.now().toString(),
      name: newEmployee.name.trim(),
      role: 'other',
      area: newEmployee.area || '',
      phone: newEmployee.phone?.trim() || '',
      salary: newEmployee.salary ? Number(newEmployee.salary) : undefined,
      notes: newRut.trim() ? `RUT: ${newRut.trim()}` + (newEmployee.notes ? ` | ${newEmployee.notes}` : '') : newEmployee.notes || '',
      rut: newRut.trim() || '',
      is_active: true
    };
    onChange([...employees, employee]);
    setNewEmployee({ name: '', area: '', phone: '', salary: '', notes: '' });
    setNewRut('');
    setDuplicateWarning('');
  };

  const handleRemove = (id) => {
    onChange(employees.filter(e => e.id !== id));
  };

  const handleToggle = (id) => {
    onChange(employees.map(e => e.id === id ? { ...e, is_active: !e.is_active } : e));
  };

  const startEdit = (employee) => {
    setEditingId(employee.id);
    // Extract RUT from notes if stored there (legacy)
    let rut = employee.rut || '';
    let notes = employee.notes || '';
    if (!rut && notes.startsWith('RUT: ')) {
      const parts = notes.split(' | ');
      rut = parts[0].replace('RUT: ', '');
      notes = parts.slice(1).join(' | ');
    }
    setEditData({
      name: employee.name,
      area: employee.area || '',
      phone: employee.phone || '',
      rut: rut,
      notes: notes
    });
    setDuplicateWarning('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
    setDuplicateWarning('');
  };

  const saveEdit = () => {
    if (!editData.name?.trim()) return;
    if (checkDuplicate(editData.name, editingId)) {
      toast.error(`El empleado "${editData.name.trim()}" ya se encuentra en el sistema`);
      return;
    }
    const notesWithRut = editData.rut?.trim()
      ? `RUT: ${editData.rut.trim()}` + (editData.notes ? ` | ${editData.notes}` : '')
      : editData.notes || '';

    onChange(employees.map(e => e.id === editingId ? {
      ...e,
      name: editData.name.trim(),
      area: editData.area || '',
      phone: editData.phone?.trim() || '',
      rut: editData.rut?.trim() || '',
      notes: notesWithRut
    } : e));
    setEditingId(null);
    setEditData({});
    setDuplicateWarning('');
  };

  const activeCount = employees.filter(e => e.is_active).length;

  return (
    <Card className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <Label className="text-gray-900 font-semibold">Empleados</Label>
            <p className="text-xs text-gray-500">Gestiona tu Team / Personal</p>
          </div>
        </div>
        <Badge className="bg-blue-100 text-blue-700">{activeCount} activos</Badge>
      </div>

      <div className="space-y-2 mb-4 max-h-[350px] overflow-y-auto pr-1">
        {employees.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Sin empleados registrados</p>
            <p className="text-xs">Agrega tu equipo de trabajo</p>
          </div>
        ) : (
          <AnimatePresence>
            {employees.map((employee) => (
              <motion.div
                key={employee.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-3 rounded-xl border transition-all ${
                  employee.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                }`}
              >
                {editingId === employee.id ? (
                  <EditRow
                    editData={editData}
                    setEditData={setEditData}
                    areas={areas}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    checkDuplicate={checkDuplicate}
                    editingId={editingId}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        employee.is_active ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white' : 'bg-gray-300 text-gray-500'
                      }`}>
                        {employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-medium ${employee.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {employee.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">{employee.area || 'Sin área'}</p>
                          {(employee.rut || (employee.notes && employee.notes.startsWith('RUT: '))) && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-400 border-gray-200">
                              {employee.rut || employee.notes?.split(' | ')[0]?.replace('RUT: ', '')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(employee)}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 w-8"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Switch
                        checked={employee.is_active}
                        onCheckedChange={() => handleToggle(employee.id)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(employee.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">{duplicateWarning}</p>
        </div>
      )}

      {/* Add form */}
      <div className="pt-3 border-t border-blue-200 space-y-2">
        <div className="flex gap-2">
          <Input
            value={newEmployee.name}
            onChange={(e) => {
              setNewEmployee(prev => ({ ...prev, name: e.target.value }));
              checkDuplicate(e.target.value);
            }}
            placeholder="Nombre del empleado..."
            className="flex-1 h-10"
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Select
            value={newEmployee.area || ''}
            onValueChange={(value) => setNewEmployee(prev => ({ ...prev, area: value }))}
          >
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Área..." />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area} value={area}>{area}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Input
            value={newRut}
            onChange={(e) => setNewRut(e.target.value)}
            placeholder="RUT (ej: 12.345.678-9)"
            className="flex-1 h-10"
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} className="h-10 bg-blue-600 hover:bg-blue-700 px-4">
            <UserPlus className="w-4 h-4 mr-1" />
            Agregar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EditRow({ editData, setEditData, areas, onSave, onCancel, checkDuplicate, editingId }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={editData.name}
          onChange={(e) => {
            setEditData(prev => ({ ...prev, name: e.target.value }));
            checkDuplicate(e.target.value, editingId);
          }}
          placeholder="Nombre..."
          className="flex-1 h-9"
          autoFocus
        />
        <Select
          value={editData.area || ''}
          onValueChange={(value) => setEditData(prev => ({ ...prev, area: value }))}
        >
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Área..." />
          </SelectTrigger>
          <SelectContent>
            {areas.map((area) => (
              <SelectItem key={area} value={area}>{area}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Input
          value={editData.rut || ''}
          onChange={(e) => setEditData(prev => ({ ...prev, rut: e.target.value }))}
          placeholder="RUT..."
          className="flex-1 h-9"
        />
        <Input
          value={editData.phone || ''}
          onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
          placeholder="Teléfono..."
          className="flex-1 h-9"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8">
          <X className="w-3.5 h-3.5 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={onSave} className="h-8 bg-blue-600 hover:bg-blue-700">
          <Check className="w-3.5 h-3.5 mr-1" /> Guardar
        </Button>
      </div>
    </div>
  );
}