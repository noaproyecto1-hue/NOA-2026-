// Diálogo para crear colaboradores directamente (modo local).
// Reemplaza el flujo original de "código de invitación" (que requería un
// servicio externo para que el invitado se registrara). En local, el admin
// crea al usuario con sus credenciales y queda listo para entrar.

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus, Loader2, LayoutDashboard, Package, ChefHat, ClipboardList,
  UserCircle, Users, Shield, User, Store, CheckCircle2, AlertCircle, Eye, EyeOff,
} from "lucide-react";

const STAFF_SECTIONS = [
  { id: 'Dashboard', name: 'Dashboard', icon: LayoutDashboard, description: 'Métricas y análisis' },
  { id: 'Inventory', name: 'Inventario', icon: Package, description: 'Stock, insumos y conteos' },
  { id: 'Recipes', name: 'Recetas', icon: ChefHat, description: 'Recetas y fichas técnicas' },
  { id: 'DataManagement', name: 'Gestión de Datos', icon: ClipboardList, description: 'Ventas, compras y gastos' },
  { id: 'Empleados', name: 'Empleados', icon: UserCircle, description: 'Gestión de personal' },
  { id: 'Clientes', name: 'Clientes', icon: Users, description: 'Base de clientes' },
  { id: 'SII', name: 'SII', icon: ClipboardList, description: 'Registro de Compras y Ventas del SII' },
];

const ALL_SECTIONS_FOR_MANAGER = [
  ...STAFF_SECTIONS.map(s => s.id),
  'Restaurants', 'MyProfile', 'Settings', 'Copilot',
];

const initialState = {
  fullName: '',
  email: '',
  username: '',
  password: '',
  role: 'staff',
  restaurantIds: [],
  allowedSections: [],
};

export default function InviteCollaboratorDialog({ open, onClose, restaurants = [], userEmail }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [error, setError] = useState(null);

  const createUserMutation = useMutation({
    mutationFn: async (data) => {
      // Verificar duplicados por email
      const existing = await base44.entities.User.filter({ email: data.email });
      if (existing.length > 0) {
        throw new Error(`Ya existe un usuario con email "${data.email}"`);
      }
      if (data.username) {
        const byUsername = (await base44.entities.User.list())
          .filter(u => (u.username || '').toLowerCase() === data.username.toLowerCase());
        if (byUsername.length > 0) {
          throw new Error(`Ya existe un usuario con nombre de usuario "${data.username}"`);
        }
      }
      return base44.entities.User.create({
        full_name: data.fullName,
        display_name: data.fullName.split(' ')[0],
        email: data.email,
        username: data.username || data.email,
        password: data.password,
        role: 'user',
        app_role: data.role,
        restaurant_ids: data.restaurantIds,
        allowed_sections: data.role === 'manager'
          ? ALL_SECTIONS_FOR_MANAGER
          : data.allowedSections,
        onboarding_completed: true,
        is_approved: true,
        created_by: userEmail,
      });
    },
    onSuccess: (user) => {
      setCreatedUser(user);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      queryClient.invalidateQueries({ queryKey: ['pendingCollaborators'] });
    },
    onError: (err) => {
      setError(err.message || 'No se pudo crear el usuario');
    },
  });

  const handleClose = () => {
    setForm(initialState);
    setShowPassword(false);
    setCreatedUser(null);
    setError(null);
    onClose();
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setError(null);
    if (!form.fullName.trim()) return setError('Nombre requerido');
    if (!form.email.trim()) return setError('Email requerido');
    if (!form.password || form.password.length < 4) return setError('La contraseña debe tener al menos 4 caracteres');
    if (form.restaurantIds.length === 0) return setError('Selecciona al menos un restaurante');
    if (form.role === 'staff' && form.allowedSections.length === 0) {
      return setError('Para un colaborador, selecciona al menos una sección permitida');
    }
    createUserMutation.mutate(form);
  };

  const toggleRestaurant = (id) => {
    setForm((f) => ({
      ...f,
      restaurantIds: f.restaurantIds.includes(id)
        ? f.restaurantIds.filter(r => r !== id)
        : [...f.restaurantIds, id],
    }));
  };

  const toggleSection = (id) => {
    setForm((f) => ({
      ...f,
      allowedSections: f.allowedSections.includes(id)
        ? f.allowedSections.filter(s => s !== id)
        : [...f.allowedSections, id],
    }));
  };

  // Vista de éxito
  if (createdUser) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              Usuario creado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Comparte estas credenciales con el colaborador. Pueden entrar en la pantalla de inicio.
            </p>
            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border">
              <div><span className="text-xs text-gray-500">Usuario:</span> <code className="ml-2 px-2 py-0.5 bg-white rounded border">{createdUser.username}</code></div>
              <div><span className="text-xs text-gray-500">Email:</span> <span className="ml-2">{createdUser.email}</span></div>
              <div><span className="text-xs text-gray-500">Contraseña:</span> <code className="ml-2 px-2 py-0.5 bg-white rounded border">{form.password}</code></div>
              <div className="pt-2">
                <Badge className={createdUser.app_role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                  {createdUser.app_role === 'manager' ? <><Shield className="w-3 h-3 mr-1" /> Manager</> : <><User className="w-3 h-3 mr-1" /> Colaborador</>}
                </Badge>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg">Crear Colaborador</p>
              <p className="text-sm font-normal text-gray-500">Define rol, restaurantes y permisos</p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Formulario de creación de colaborador</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Datos básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input id="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@correo.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="username">Usuario (opcional)</Label>
              <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="juan" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="password">Contraseña inicial</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 4 caracteres"
                  className="pr-10"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Rol */}
          <div>
            <Label className="text-sm font-semibold text-gray-800 mb-2 block">Rol</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'manager' })}
                className={`p-3 border-2 rounded-xl text-left transition ${
                  form.role === 'manager' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-blue-600" /><span className="font-semibold">Manager</span></div>
                <p className="text-xs text-gray-500">Acceso completo</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'staff' })}
                className={`p-3 border-2 rounded-xl text-left transition ${
                  form.role === 'staff' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1"><User className="w-4 h-4 text-green-600" /><span className="font-semibold">Colaborador</span></div>
                <p className="text-xs text-gray-500">Solo secciones seleccionadas</p>
              </button>
            </div>
          </div>

          {/* Restaurantes */}
          <div>
            <Label className="text-sm font-semibold text-gray-800 mb-2 block flex items-center gap-1">
              <Store className="w-4 h-4" /> Restaurantes
            </Label>
            {restaurants.length === 0 ? (
              <p className="text-xs text-gray-500 p-3 bg-gray-50 rounded">No tienes restaurantes. Crea uno en Restaurantes primero.</p>
            ) : (
              <div className="space-y-2">
                {restaurants.map((r) => (
                  <label key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <Checkbox checked={form.restaurantIds.includes(r.id)} onCheckedChange={() => toggleRestaurant(r.id)} />
                    <span className="text-sm">{r.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Secciones (solo si staff) */}
          {form.role === 'staff' && (
            <div>
              <Label className="text-sm font-semibold text-gray-800 mb-2 block">Secciones permitidas</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STAFF_SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const isSelected = form.allowedSections.includes(s.id);
                  return (
                    <label key={s.id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition ${
                      isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSection(s.id)} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><Icon className="w-4 h-4" /><span className="font-medium text-sm">{s.name}</span></div>
                        <p className="text-xs text-gray-500">{s.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Creando...</>) : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
