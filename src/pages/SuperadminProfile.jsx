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
  Camera
} from "lucide-react";
import { motion } from "framer-motion";
import SuperadminLayout from '@/components/superadmin/SuperadminLayout';

export default function SuperadminProfile() {
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
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

  if (isLoading) {
    return (
      <SuperadminLayout currentPage="SuperadminProfile">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </SuperadminLayout>
    );
  }

  return (
    <SuperadminLayout currentPage="SuperadminProfile">
      <div className="min-h-screen">
        {/* Hero Header */}
        <div className="relative overflow-hidden py-16 lg:py-20">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(https://images.unsplash.com/photo-1557426272-fc759fdf7a8d?w=1920&q=80)` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-indigo-900/90 to-purple-900/85" />
          <div className="absolute inset-0 opacity-20">
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
                    <Shield className="w-16 h-16 lg:w-20 lg:h-20 text-white/80" />
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
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  ) : (
                    <Camera className="w-5 h-5 text-indigo-600" />
                  )}
                </label>
              </div>

              {/* Info del usuario */}
              <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3">
                {formData.display_name || user?.full_name}
              </h1>
              <p className="text-white/70 text-lg mb-4 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {user?.email}
              </p>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-sm px-4 py-1.5 shadow-lg">
                <Shield className="w-4 h-4 mr-2" />
                Superadministrador
              </Badge>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-100 to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8">
          <div className="grid gap-6">
            {/* Información de contacto */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="bg-white border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    Información Personal
                  </CardTitle>
                  <CardDescription>
                    Actualiza tu información de administrador
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
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        Correo Electrónico
                      </Label>
                      <Input value={user?.email || ''} disabled className="bg-gray-50 h-11" />
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
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-400" />
                        Rol en el Sistema
                      </Label>
                      <div className="h-11 flex items-center">
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                          <Shield className="w-3 h-3 mr-1" />
                          Superadministrador
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
                      <motion.span 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-sm text-emerald-600 flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Guardado exitosamente
                      </motion.span>
                    )}
                    <Button 
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                      {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Cambios
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </SuperadminLayout>
  );
}