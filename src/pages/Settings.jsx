import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User,
  Shield,
  Users,
  Loader2,
  CheckCircle,
  Store,
  XCircle,
  Clock,
  Settings as SettingsIcon,
  UserCheck,
  UserX,
  UserPlus,
  Key,
  Globe,
  Plug,
  Crown,
  Trash2,
  Bot,
} from "lucide-react";
import { motion } from "framer-motion";

import PageHeader from '@/components/ui/PageHeader';
import InviteCollaboratorDialog from '@/components/settings/InviteCollaboratorDialog';
import TimezoneSettings from '@/components/settings/TimezoneSettings';
import IntegrationsSettings from '@/components/settings/IntegrationsSettings';
import AgentSettings from '@/components/settings/AgentSettings';


export default function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Mutation para guardar zona horaria
  const saveTimezoneMutation = useMutation({
    mutationFn: async (data) => {
      setIsSavingTimezone(true);
      await base44.auth.updateMe(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setIsSavingTimezone(false);
    },
    onError: () => {
      setIsSavingTimezone(false);
    }
  });

  // Filtrar restaurantes por usuario - respeta restaurant_ids
  const { data: restaurants = [] } = useQuery({
    queryKey: ['myRestaurants', user?.email, user?.restaurant_ids],
    queryFn: async () => {
      if (user?.restaurant_ids?.length > 0) {
        const allActive = await base44.entities.Restaurant.filter({ is_active: true });
        return allActive.filter(r => user.restaurant_ids.includes(r.id));
      }
      return base44.entities.Restaurant.filter({ is_active: true, created_by: user?.email });
    },
    enabled: !!user?.email
  });

  // Listar TODOS los usuarios y separar al actual (principal) del resto (colaboradores).
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user?.email,
  });

  // Compatibilidad con el botón "Historial" (códigos de invitación) — vacío en modo local.
  const invitationCodes = [];

  // Colaboradores = todos los usuarios distintos al actual
  const myCollaborators = allUsers
    .filter((u) => u.email !== user?.email && u.id !== user?.id)
    .map((u) => ({
      ...u,
      _codeData: { restaurant_ids: u.restaurant_ids, allowed_sections: u.allowed_sections },
    }));

  const isManager = user?.role === 'admin' || user?.app_role === 'manager';
  const pendingCollaborators = myCollaborators.filter((c) => !c.is_approved);
  const approvedCollaborators = myCollaborators.filter((c) => c.is_approved);

  // Si un colaborador intenta entrar por URL directa, lo mandamos al Dashboard.
  useEffect(() => {
    if (user && !isManager) {
      navigate(createPageUrl('Dashboard'), { replace: true });
    }
  }, [user, isManager, navigate]);

  // Mutation para borrar colaborador
  const deleteUserMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.delete(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allUsers'] }),
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      {/* Hero Header */}
      <PageHeader
        title="Configuración"
        subtitle="Gestiona usuarios y configuraciones del sistema"
        icon={SettingsIcon}
        imageKey="settings"
        gradient="from-slate-900/90 via-gray-900/80 to-zinc-900/70"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-4">
        {isManager ? (
          <Tabs defaultValue="timezone" className="space-y-6">
            <TabsList className="bg-white border shadow-sm flex-wrap">
              <TabsTrigger value="timezone" className="flex items-center gap-2">
                <Globe className="w-4 h-4" /> Zona Horaria
              </TabsTrigger>
              <TabsTrigger value="collaborators" className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Colaboradores
              </TabsTrigger>
              <TabsTrigger value="codes" className="flex items-center gap-2">
                <Key className="w-4 h-4" /> Historial
              </TabsTrigger>
              <TabsTrigger value="integrations" className="flex items-center gap-2">
                <Plug className="w-4 h-4" /> Integraciones
              </TabsTrigger>
              <TabsTrigger value="agent" className="flex items-center gap-2">
                <Bot className="w-4 h-4" /> Agente IA
              </TabsTrigger>

            </TabsList>

            {/* Integraciones Tab */}
            <TabsContent value="integrations">
              <IntegrationsSettings />
            </TabsContent>

            {/* Agente IA Tab */}
            <TabsContent value="agent">
              <AgentSettings />
            </TabsContent>

            {/* Timezone Tab */}
            <TabsContent value="timezone">
              <TimezoneSettings 
                user={user} 
                onSave={(data) => saveTimezoneMutation.mutate(data)}
                isSaving={isSavingTimezone}
              />
            </TabsContent>

            {/* Collaborators Tab */}
            <TabsContent value="collaborators">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Usuario principal / propietario */}
                {user && (
                  <Card className="bg-white border-0 shadow-lg overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                          <Crown className="w-4 h-4 text-amber-600" />
                        </div>
                        Usuario Principal
                      </CardTitle>
                      <CardDescription>Esta cuenta es la administradora del sistema y tiene acceso completo</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          {user.profile_photo ? (
                            <img src={user.profile_photo} alt={user.display_name || user.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow" />
                          ) : (
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                              <Crown className="w-6 h-6 text-amber-600" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">{user.display_name || user.full_name || 'Administrador'}</p>
                            <p className="text-xs text-gray-500">
                              {user.email}{user.username && user.username !== user.email ? ` · usuario: ${user.username}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge className="text-xs bg-amber-100 text-amber-700 border border-amber-200 gap-1">
                            <Crown className="w-3 h-3" /> Propietario
                          </Badge>
                          <Badge className="text-xs bg-blue-100 text-blue-700 border border-blue-200 gap-1">
                            <Shield className="w-3 h-3" /> Acceso completo
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Botón de invitar */}
                <Card className="bg-white border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">Crear nuevo colaborador</h3>
                        <p className="text-sm text-gray-500">Elige rol (Manager o Colaborador), restaurantes y secciones permitidas</p>
                      </div>
                      <Button
                        onClick={() => setShowInviteDialog(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Crear
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Pendientes de aprobación (solo vista, el superadmin aprueba) */}
                {pendingCollaborators.length > 0 && (
                  <Card className="bg-white border-0 shadow-lg">
                    <CardHeader className="bg-amber-50 border-b border-amber-100">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-4 h-4 text-amber-600" />
                        </div>
                        Pendientes de Aprobación
                        <Badge className="ml-2 bg-amber-100 text-amber-700">{pendingCollaborators.length}</Badge>
                      </CardTitle>
                      <CardDescription>
                        Estos colaboradores serán aprobados por el administrador de la plataforma
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {pendingCollaborators.map((collab) => (
                          <div key={collab.id} className="flex items-center justify-between p-4 border border-amber-100 bg-amber-50/50 rounded-xl">
                            <div className="flex items-center gap-3">
                              {collab.profile_photo ? (
                                <img src={collab.profile_photo} alt={collab.display_name || collab.full_name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" />
                              ) : (
                                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-amber-600" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{collab.display_name || collab.full_name}</p>
                                <p className="text-xs text-gray-500">{collab.email}</p>
                              </div>
                            </div>
                            <Badge className="bg-amber-100 text-amber-700">
                              <Clock className="w-3 h-3 mr-1" />
                              Esperando aprobación
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Colaboradores activos */}
                <Card className="bg-white border-0 shadow-lg">
                  <CardHeader className="bg-green-50 border-b border-green-100">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-green-600" />
                      </div>
                      Colaboradores Activos
                      {approvedCollaborators.length > 0 && (
                        <Badge className="ml-2 bg-green-100 text-green-700">{approvedCollaborators.length}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {approvedCollaborators.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p>No hay colaboradores activos aún</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {approvedCollaborators.map((collab) => (
                          <div key={collab.id} className="flex items-center justify-between p-4 border rounded-xl bg-gray-50/50 flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              {collab.profile_photo ? (
                                <img src={collab.profile_photo} alt={collab.display_name || collab.full_name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" />
                              ) : (
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-green-600" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{collab.display_name || collab.full_name}</p>
                                <p className="text-xs text-gray-500">
                                  {collab.email}{collab.username && collab.username !== collab.email ? ` · ${collab.username}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-wrap gap-1">
                                {collab.app_role === 'manager' ? (
                                  <Badge className="text-xs bg-blue-100 text-blue-700 border border-blue-200 gap-1">
                                    <Shield className="w-3 h-3" /> Manager
                                  </Badge>
                                ) : (
                                  <>
                                    <Badge className="text-xs bg-green-100 text-green-700 border border-green-200 gap-1">
                                      <User className="w-3 h-3" /> Colaborador
                                    </Badge>
                                    {(collab._codeData?.allowed_sections || collab.allowed_sections || []).map((s, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                                    ))}
                                  </>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (window.confirm(`¿Eliminar a ${collab.display_name || collab.full_name}?`)) {
                                    deleteUserMutation.mutate(collab.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Eliminar colaborador"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Historial Tab */}
            <TabsContent value="codes">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-white border-0 shadow-lg">
                  <CardHeader className="bg-purple-50 border-b border-purple-100">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Key className="w-4 h-4 text-purple-600" />
                      </div>
                      Historial de Códigos
                    </CardTitle>
                    <CardDescription>
                      Códigos de invitación generados y colaboradores registrados
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {invitationCodes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No has generado códigos de invitación
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {invitationCodes.map((code) => (
                          <div 
                            key={code.id}
                            className={`p-4 border rounded-xl ${code.is_used ? 'bg-gray-50 border-gray-200' : 'bg-white border-purple-200'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-mono font-bold text-lg">{code.code}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {code.invited_role === 'manager' ? (
                                    <Badge className="text-xs bg-blue-100 text-blue-700 border border-blue-200 gap-1">
                                      <Shield className="w-3 h-3" /> Manager
                                    </Badge>
                                  ) : (
                                    code.allowed_sections?.map((s, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                {code.is_used ? (
                                  <Badge className="bg-gray-100 text-gray-600">Usado</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-700">Disponible</Badge>
                                )}
                                {code.used_by && (
                                  <p className="text-xs text-gray-500 mt-1">Por: {code.used_by}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

          </Tabs>
        ) : (
          <Card className="bg-white border-0 shadow-lg">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceso restringido</h3>
              <p className="text-gray-500">Solo los administradores pueden acceder a esta sección</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog para invitar colaborador */}
      <InviteCollaboratorDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        restaurants={restaurants}
        userEmail={user?.email}
      />
    </div>
  );
}