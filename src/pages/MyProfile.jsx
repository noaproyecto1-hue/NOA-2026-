import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Phone,
  Mail,
  Shield,
  Save,
  Loader2,
  CheckCircle,
  Camera,
  Upload,
  Store,
  Clock,
  UserCircle
} from "lucide-react";
import { motion } from "framer-motion";
import PageHeader from '@/components/ui/PageHeader';

export default function MyProfile() {
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Filtrar restaurantes por usuario - cada gerente solo ve los suyos
  const { data: restaurants = [] } = useQuery({
    queryKey: ['myRestaurants', user?.email],
    queryFn: () => base44.entities.Restaurant.filter({ is_active: true, created_by: user?.email }),
    enabled: !!user?.email
  });



  const [formData, setFormData] = useState({
    display_name: '',
    phone: '',
    bio: '',
    profile_photo: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || user.full_name || '',
        phone: user.phone || '',
        bio: user.bio || '',
        profile_photo: user.profile_photo || ''
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData(prev => ({ ...prev, profile_photo: file_url }));
    setIsUploading(false);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const getUserRestaurants = () => {
    if (!user?.restaurant_ids?.length) return [];
    return restaurants.filter(r => user.restaurant_ids.includes(r.id));
  };

  const getRoleName = () => {
    if (user?.role === 'admin') return 'Administrador';
    if (user?.app_role === 'manager') return 'Propietario';
    return 'Colaborador';
  };

  const getRoleColor = () => {
    if (user?.role === 'admin' || user?.app_role === 'manager') {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-gray-100 text-gray-700';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-noa-navy flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Verificar si necesita aprobación
  const needsApproval = !user?.is_approved && user?.role !== 'admin';

  return (
    <div className="min-h-screen bg-noa-navy text-white">
      {/* Hero Header */}
      <div className="relative overflow-hidden py-20">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1920&q=80)` }}
        />
        <div className="absolute inset-0" style={{ background: 'rgba(12, 27, 51, 0.72)' }} />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white rounded-full animate-pulse" />
          <div className="absolute bottom-1/3 right-1/4 w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-200" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            {/* Foto de perfil */}
            <div className="relative mb-6">
              <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center overflow-hidden border-4 border-white/20 shadow-2xl">
                {formData.profile_photo ? (
                  <img 
                    src={formData.profile_photo} 
                    alt={user?.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 lg:w-20 lg:h-20 text-white/80" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-12 h-12 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-xl hover:scale-110 transition-transform border-4 border-indigo-900">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                ) : (
                  <Camera className="w-5 h-5 text-blue-600" />
                )}
              </label>
            </div>

            {/* Info del usuario */}
            <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3">{formData.display_name || user?.display_name || user?.full_name}</h1>
            <p className="text-white/70 text-lg mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {user?.email}
            </p>
            <div className="flex items-center gap-2">
              <Badge className={`${getRoleColor()} border-0 text-sm px-4 py-1`}>
                <Shield className="w-3 h-3 mr-1" />
                {getRoleName()}
              </Badge>
              {needsApproval && (
                <Badge className="bg-amber-100 text-amber-800 border-0 text-sm px-4 py-1">
                  <Clock className="w-3 h-3 mr-1" />
                  Pendiente de aprobación
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-noa-navy to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8">
        {/* Alerta de aprobación pendiente */}
        {needsApproval && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-800">Tu cuenta está pendiente de aprobación</p>
                  <p className="text-sm text-amber-600">Un administrador revisará tu solicitud pronto.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {needsApproval && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-800">Tu cuenta está pendiente de aprobación</p>
                  <p className="text-sm text-amber-600">Un administrador revisará tu solicitud pronto.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid gap-6">
          {/* Información de contacto */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-white border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  Información Personal
                </CardTitle>
                <CardDescription>
                  Actualiza tu información de contacto y perfil
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      Nombre Completo
                    </Label>
                    <Input 
                      value={formData.display_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                      placeholder="Tu nombre completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      Correo Electrónico
                    </Label>
                    <Input value={user?.email || ''} disabled className="bg-gray-50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      Teléfono
                    </Label>
                    <Input 
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      Rol en el Sistema
                    </Label>
                    <div className="h-10 flex items-center">
                      <Badge className={getRoleColor()}>
                        {getRoleName()}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sobre mí</Label>
                  <Textarea
                    value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Cuéntanos un poco sobre ti..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  {saveSuccess && (
                    <span className="text-sm text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Guardado exitosamente
                    </span>
                  )}
                  <Button 
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Restaurantes asignados */}
          {getUserRestaurants().length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-white border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Store className="w-4 h-4 text-emerald-600" />
                    </div>
                    Restaurantes Asignados
                  </CardTitle>
                  <CardDescription>
                    Locales a los que tienes acceso
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {getUserRestaurants().map(restaurant => (
                      <div 
                        key={restaurant.id}
                        className="p-4 bg-gray-50 rounded-xl flex items-center gap-3"
                      >
                        {restaurant.logo_url ? (
                          <img 
                            src={restaurant.logo_url} 
                            alt={restaurant.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Store className="w-5 h-5 text-emerald-600" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{restaurant.name}</p>
                          <p className="text-sm text-gray-500">{restaurant.location}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}