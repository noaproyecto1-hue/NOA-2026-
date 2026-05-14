import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield,
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  Building2,
  Calendar,
  Loader2,
  AlertTriangle,
  Store,
  Eye,
  MapPin,
  X
} from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SuperadminLayout from '../components/superadmin/SuperadminLayout';

export default function SuperadminDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject'
  const [viewingManager, setViewingManager] = useState(null); // Para ver detalles

  // Obtener usuario actual
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Obtener todos los usuarios (gerentes)
  const { data: allManagers = [], isLoading } = useQuery({
    queryKey: ['allManagersForApproval'],
    queryFn: () => base44.entities.User.filter({ app_role: 'manager' }),
    enabled: currentUser?.role === 'admin'
  });

  // Obtener todos los colaboradores
  const { data: allStaff = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['allStaff'],
    queryFn: () => base44.entities.User.filter({ app_role: 'staff' }),
    enabled: currentUser?.role === 'admin'
  });

  // Obtener todos los restaurantes
  const { data: allRestaurants = [] } = useQuery({
    queryKey: ['allRestaurants'],
    queryFn: () => base44.entities.Restaurant.filter({ is_active: true }),
    enabled: currentUser?.role === 'admin'
  });

  const pendingManagers = allManagers.filter(u => u.onboarding_completed && !u.is_approved);
  const approvedManagers = allManagers.filter(u => u.is_approved);
  const pendingStaff = allStaff.filter(u => u.onboarding_completed && !u.is_approved);
  const approvedStaff = allStaff.filter(u => u.is_approved);
  const totalPending = pendingManagers.length + pendingStaff.length;

  // Mutación para aprobar/rechazar
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allManagersForApproval'] });
      queryClient.invalidateQueries({ queryKey: ['allStaff'] });
      setSelectedUser(null);
      setActionType(null);
    }
  });

  const handleApprove = (user) => {
    setSelectedUser(user);
    setActionType('approve');
  };

  const handleReject = (user) => {
    setSelectedUser(user);
    setActionType('reject');
  };

  const confirmAction = () => {
    if (!selectedUser) return;
    
    updateUserMutation.mutate({
      userId: selectedUser.id,
      data: {
        is_approved: actionType === 'approve'
      }
    });
  };

  // Verificar que sea superadmin
  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
            <p className="text-gray-500">No tienes permisos para acceder a esta sección.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredPendingManagers = pendingManagers.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPendingStaff = pendingStaff.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Obtener info del gerente que invitó a un colaborador
  const getManagerInfo = (staffEmail) => {
    const staff = allStaff.find(s => s.email === staffEmail);
    if (!staff?.invited_by) return null;
    return allManagers.find(m => m.email === staff.invited_by);
  };

  return (
    <SuperadminLayout currentPage="SuperadminDashboard">
      <div className="p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Gestión de Usuarios</h1>
              <p className="text-slate-500">Aprueba o rechaza solicitudes de propietarios</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-600 text-sm font-medium">Pendientes</p>
                    <p className="text-3xl font-bold text-slate-800">{totalPending}</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-sm font-medium">Propietarios Activos</p>
                    <p className="text-3xl font-bold text-slate-800">{approvedManagers.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-medium">Total Propietarios</p>
                    <p className="text-3xl font-bold text-slate-800">{allManagers.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-600 text-sm font-medium">Colaboradores Activos</p>
                    <p className="text-3xl font-bold text-slate-800">{approvedStaff.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-indigo-600 text-sm font-medium">Total Colaboradores</p>
                    <p className="text-3xl font-bold text-slate-800">{allStaff.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar usuarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-slate-200"
            />
          </div>
        </div>

        {/* Pending Managers Section */}
        <Card className="mb-8 bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Clock className="w-5 h-5 text-amber-500" />
              Propietarios Pendientes ({pendingManagers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredPendingManagers.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No hay propietarios pendientes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPendingManagers.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4 mb-4 md:mb-0">
                      {user.profile_photo ? (
                        <img 
                          src={user.profile_photo} 
                          alt={user.display_name || user.full_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">{user.display_name || user.full_name}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {user.email}
                          </span>
                          {user.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {user.phone}
                            </span>
                          )}
                          {user.company_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {user.company_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            {format(new Date(user.created_date), "d MMM yyyy", { locale: es })}
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                            Propietario
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(user)}
                        className="text-red-600 hover:bg-red-50 hover:border-red-200"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(user)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Aprobar
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Staff Section */}
        <Card className="mb-8 bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Clock className="w-5 h-5 text-purple-500" />
              Colaboradores Pendientes ({pendingStaff.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStaff ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : filteredPendingStaff.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No hay colaboradores pendientes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPendingStaff.map((user, index) => {
                  const manager = getManagerInfo(user.email);
                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-purple-100 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4 mb-4 md:mb-0">
                        {user.profile_photo ? (
                          <img 
                            src={user.profile_photo} 
                            alt={user.display_name || user.full_name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-purple-600" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900">{user.display_name || user.full_name}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {user.email}
                            </span>
                            {manager && (
                              <span className="flex items-center gap-1 text-purple-600">
                                <Users className="w-3.5 h-3.5" />
                                Invitado por: {manager.display_name || manager.full_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              {format(new Date(user.created_date), "d MMM yyyy", { locale: es })}
                            </Badge>
                            <Badge className="bg-purple-100 text-purple-700 text-xs">
                              Colaborador
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReject(user)}
                          className="text-red-600 hover:bg-red-50 hover:border-red-200"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(user)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Aprobar
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approved Users List */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <UserCheck className="w-5 h-5 text-green-500" />
              Propietarios Aprobados ({approvedManagers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {approvedManagers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay propietarios aprobados aún</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {approvedManagers.map((user) => {
                  // Contar colaboradores de este gerente
                  const managerCollaborators = allStaff.filter(s => s.invited_by === user.email);
                  return (
                    <div 
                      key={user.id}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        {user.profile_photo ? (
                          <img 
                            src={user.profile_photo} 
                            alt={user.display_name || user.full_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-green-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{user.display_name || user.full_name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          {managerCollaborators.length > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              {managerCollaborators.length} colaborador{managerCollaborators.length !== 1 ? 'es' : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingManager(user)}
                            className="text-blue-600 hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Badge className="bg-green-100 text-green-700 text-xs">Activo</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manager Details Dialog */}
        <Dialog open={!!viewingManager} onOpenChange={() => setViewingManager(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {viewingManager?.profile_photo ? (
                  <img 
                    src={viewingManager.profile_photo} 
                    alt={viewingManager.display_name || viewingManager.full_name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
                  />
                ) : (
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-7 h-7 text-blue-600" />
                  </div>
                )}
                <div>
                  <p className="text-xl">{viewingManager?.display_name || viewingManager?.full_name}</p>
                  <p className="text-sm font-normal text-gray-500">{viewingManager?.email}</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            {viewingManager && (
              <div className="space-y-6 py-4">
                {/* Info del gerente */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                  {viewingManager.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{viewingManager.phone}</span>
                    </div>
                  )}
                  {viewingManager.company_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span>{viewingManager.company_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Registrado: {format(new Date(viewingManager.created_date), "d MMM yyyy", { locale: es })}</span>
                  </div>
                </div>

                {/* Restaurantes */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Store className="w-5 h-5 text-blue-600" />
                    Restaurantes ({allRestaurants.filter(r => r.created_by === viewingManager.email).length})
                  </h4>
                  <div className="space-y-3">
                    {allRestaurants.filter(r => r.created_by === viewingManager.email).length === 0 ? (
                      <p className="text-gray-500 text-sm p-4 bg-gray-50 rounded-lg text-center">
                        No tiene restaurantes registrados
                      </p>
                    ) : (
                      allRestaurants
                        .filter(r => r.created_by === viewingManager.email)
                        .map((restaurant) => (
                          <div 
                            key={restaurant.id}
                            className="flex items-center gap-4 p-4 bg-white border rounded-xl"
                          >
                            {restaurant.logo_url ? (
                              <img 
                                src={restaurant.logo_url} 
                                alt={restaurant.name}
                                className="w-12 h-12 rounded-lg object-cover border"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Store className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{restaurant.name}</p>
                              <p className="text-sm text-gray-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {restaurant.location}
                              </p>
                            </div>
                            <Badge variant="outline">{restaurant.currency}</Badge>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Colaboradores */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Colaboradores ({allStaff.filter(s => s.invited_by === viewingManager.email).length})
                  </h4>
                  <div className="space-y-2">
                    {allStaff.filter(s => s.invited_by === viewingManager.email).length === 0 ? (
                      <p className="text-gray-500 text-sm p-4 bg-gray-50 rounded-lg text-center">
                        No tiene colaboradores
                      </p>
                    ) : (
                      allStaff
                        .filter(s => s.invited_by === viewingManager.email)
                        .map((staff) => (
                          <div 
                            key={staff.id}
                            className="flex items-center gap-3 p-3 bg-white border rounded-lg"
                          >
                            {staff.profile_photo ? (
                              <img 
                                src={staff.profile_photo} 
                                alt={staff.display_name || staff.full_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <Users className="w-5 h-5 text-purple-600" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm">{staff.display_name || staff.full_name}</p>
                              <p className="text-xs text-gray-500">{staff.email}</p>
                            </div>
                            <Badge className={staff.is_approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                              {staff.is_approved ? 'Activo' : 'Pendiente'}
                            </Badge>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setViewingManager(null)} className="w-full">
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {actionType === 'approve' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Aprobar Propietario
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Rechazar Solicitud
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            
            {selectedUser && (
              <div className="py-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-4">
                  {selectedUser.profile_photo ? (
                    <img 
                      src={selectedUser.profile_photo} 
                      alt={selectedUser.display_name || selectedUser.full_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{selectedUser.display_name || selectedUser.full_name}</p>
                    <p className="text-sm text-gray-500">{selectedUser.email}</p>
                  </div>
                </div>
                
                <p className="text-gray-600">
                  {actionType === 'approve' 
                    ? '¿Estás seguro de aprobar a este propietario? Tendrá acceso completo a la plataforma.'
                    : '¿Estás seguro de rechazar esta solicitud? El usuario no podrá acceder a la plataforma.'}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmAction}
                disabled={updateUserMutation.isPending}
                className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              >
                {updateUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {actionType === 'approve' ? 'Aprobar' : 'Rechazar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}