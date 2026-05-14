import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { 
  User, 
  Phone,
  Camera,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  Building2,
  MapPin,
  Plus,
  Trash2,
  Store,
  DollarSign,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMEZONES_BY_REGION, DEFAULT_TIMEZONE } from '@/components/utils/timezoneHelper';
import { ensureSystemCostCenters } from '@/components/utils/systemCostCenters';

const currencies = [
  { value: 'USD', label: 'Dólares (USD)' },
  { value: 'EUR', label: 'Euros (EUR)' },
  { value: 'MXN', label: 'Pesos Mexicanos (MXN)' },
  { value: 'COP', label: 'Pesos Colombianos (COP)' },
  { value: 'ARS', label: 'Pesos Argentinos (ARS)' },
  { value: 'CLP', label: 'Pesos Chilenos (CLP)' },
  { value: 'PEN', label: 'Soles (PEN)' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0); // 0: selección de rol
  const [userType, setUserType] = useState(null); // 'manager' | 'staff'
  const [isUploading, setIsUploading] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [validatedCode, setValidatedCode] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    company_name: '',
    profile_photo: '',
    bio: '',
    timezone: DEFAULT_TIMEZONE
  });

  const [restaurants, setRestaurants] = useState([
    { name: '', location: '', currency: 'USD' }
  ]);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Si el usuario ya completó onboarding, redirigir (pero no durante el proceso de completar)
  useEffect(() => {
    if (user?.onboarding_completed && !isCompleting) {
      if (user?.is_approved) {
        navigate(createPageUrl('Dashboard'));
      } else {
        navigate(createPageUrl('PendingApproval'));
      }
    }
  }, [user, navigate, isCompleting]);

  // Inicializar nombre del usuario si ya existe
  useEffect(() => {
    if (user && !profileData.full_name) {
      // Usar display_name si existe, sino full_name
      const existingName = user.display_name || user.full_name || '';
      setProfileData(prev => ({ ...prev, full_name: existingName }));
    }
  }, [user]);

  // Si es superadmin, redirigir
  useEffect(() => {
    if (user?.role === 'admin') {
      navigate(createPageUrl('SuperadminDashboard'));
    }
  }, [user, navigate]);

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    }
  });

  const createRestaurantMutation = useMutation({
    mutationFn: (data) => base44.entities.Restaurant.create(data),
  });

  // Validar código de invitación
  const validateCodeMutation = useMutation({
    mutationFn: async (code) => {
      const codes = await base44.entities.InvitationCode.filter({ code: code.toUpperCase(), is_used: false });
      if (codes.length === 0) {
        throw new Error('Código inválido o ya utilizado');
      }
      const invCode = codes[0];
      // Verificar expiración
      if (invCode.expires_at && new Date(invCode.expires_at) < new Date()) {
        throw new Error('Este código ha expirado');
      }
      return invCode;
    },
    onSuccess: (code) => {
      setValidatedCode(code);
      setCodeError('');
      setStep(1); // Ir al paso de datos personales
    },
    onError: (error) => {
      setCodeError(error.message);
      setValidatedCode(null);
    }
  });

  // Marcar código como usado
  const markCodeUsedMutation = useMutation({
    mutationFn: ({ codeId, userEmail }) => 
      base44.entities.InvitationCode.update(codeId, { 
        is_used: true, 
        used_by: userEmail,
        used_at: new Date().toISOString()
      })
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProfileData(prev => ({ ...prev, profile_photo: file_url }));
    setIsUploading(false);
  };

  const addRestaurant = () => {
    setRestaurants(prev => [...prev, { name: '', location: '', currency: 'USD' }]);
  };

  const removeRestaurant = (index) => {
    if (restaurants.length > 1) {
      setRestaurants(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateRestaurant = (index, field, value) => {
    setRestaurants(prev => prev.map((r, i) => 
      i === index ? { ...r, [field]: value } : r
    ));
  };

  const handleCompleteManager = async () => {
    setIsCompleting(true);
    // Crear restaurantes y recopilar sus IDs
    const validRestaurants = restaurants.filter(r => r.name.trim());
    const createdRestaurantIds = [];
    
    for (const restaurant of validRestaurants) {
      const created = await createRestaurantMutation.mutateAsync({
        ...restaurant,
        created_by: user.email,
        is_active: true,
        config: {
          cost_centers: ensureSystemCostCenters([]),
          preparation_zones: ['Cocina', 'Barra', 'Pastelería'],
          rooms: ['Sala Principal', 'Terraza'],
          tables_count: 20,
          supply_categories: [
            { name: 'Verduras', cost_type: 'food_cost' },
            { name: 'Carnes', cost_type: 'food_cost' },
            { name: 'Lácteos', cost_type: 'food_cost' },
            { name: 'Pescados', cost_type: 'food_cost' },
            { name: 'Granos', cost_type: 'food_cost' },
            { name: 'Desechables', cost_type: 'cost_center', cost_center_name: 'DESECHABLES' },
            { name: 'Limpieza', cost_type: 'cost_center', cost_center_name: 'LIMPIEZA' },
          ],
          recipe_categories: ['Entradas', 'Platos Fuertes', 'Postres', 'Bebidas', 'Ensaladas', 'Sopas'],
          payment_methods: ['efectivo', 'tarjeta', 'transferencia'],
          default_tax_rate: 19,
          employees: [],
          fixed_expenses: []
        }
      });
      if (created?.id) createdRestaurantIds.push(created.id);
    }

    // Actualizar usuario con restaurant_ids asignados
    await updateUserMutation.mutateAsync({
      display_name: profileData.full_name,
      phone: profileData.phone,
      company_name: profileData.company_name,
      profile_photo: profileData.profile_photo,
      bio: profileData.bio,
      timezone: profileData.timezone,
      app_role: 'manager',
      onboarding_completed: true,
      is_approved: false,
      restaurant_count: validRestaurants.length,
      restaurant_ids: createdRestaurantIds
    });

    // Enviar email de confirmación (no bloquear si falla)
    try {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '🎉 ¡Registro completado! - NOA',
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3B82F6; margin-bottom: 10px;">¡Hola ${profileData.full_name}!</h1>
              <p style="color: #6B7280; font-size: 16px;">Tu registro ha sido recibido exitosamente</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #EFF6FF, #F0F9FF); padding: 25px; border-radius: 12px; margin-bottom: 25px;">
              <h2 style="color: #1E40AF; margin-bottom: 15px;">📋 Resumen de tu solicitud</h2>
              <p style="color: #374151; margin: 8px 0;"><strong>Empresa:</strong> ${profileData.company_name || 'No especificada'}</p>
              <p style="color: #374151; margin: 8px 0;"><strong>Restaurantes registrados:</strong> ${validRestaurants.length}</p>
              <ul style="color: #374151; margin: 10px 0; padding-left: 20px;">
                ${validRestaurants.map(r => `<li>${r.name} - ${r.location}</li>`).join('')}
              </ul>
            </div>
            
            <div style="background: #FEF3C7; padding: 20px; border-radius: 12px; border-left: 4px solid #F59E0B; margin-bottom: 25px;">
              <h3 style="color: #92400E; margin-bottom: 10px;">⏳ Estado: En revisión</h3>
              <p style="color: #78350F; font-size: 14px;">
                Nuestro equipo está revisando tu solicitud. Te notificaremos por correo electrónico 
                cuando tu cuenta sea aprobada. Este proceso normalmente toma entre 24-48 horas.
              </p>
            </div>
            
            <div style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 30px;">
              <p>NOA - Tu asistente inteligente para restaurantes</p>
            </div>
          </div>
        `
      });
    } catch (e) {
      console.log('Email de confirmación no se pudo enviar, continuando...');
    }

    // Redirigir a la página de pendiente de aprobación
    navigate(createPageUrl('PendingApproval'));
  };

  const handleCompleteStaff = async () => {
    setIsCompleting(true);
    // Marcar código como usado
    await markCodeUsedMutation.mutateAsync({
      codeId: validatedCode.id,
      userEmail: user.email
    });

    // Determinar app_role según el código de invitación
    const role = validatedCode.invited_role || 'staff';

    // Actualizar usuario con datos del colaborador
    await updateUserMutation.mutateAsync({
      display_name: profileData.full_name,
      phone: profileData.phone,
      profile_photo: profileData.profile_photo,
      timezone: profileData.timezone,
      app_role: role,
      onboarding_completed: true,
      is_approved: false,
      invited_by: validatedCode.created_by,
      invitation_code: validatedCode.code,
      restaurant_ids: validatedCode.restaurant_ids,
      allowed_sections: validatedCode.allowed_sections || []
    });

    navigate(createPageUrl('PendingApproval'));
  };

  const totalSteps = userType === 'manager' ? 3 : 2;
  const canProceedStep1Manager = profileData.full_name.trim().length > 0 && profileData.company_name.trim().length > 0;
  const canProceedStep1Staff = profileData.full_name.trim().length > 0;
  const canProceedStep2 = true; // Foto y teléfono son opcionales
  const canCompleteManager = restaurants.some(r => r.name.trim().length > 0);
  const canCompleteStaff = profileData.full_name.trim().length > 0;

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl"
      >
        <Card className="bg-white/95 backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              ¡Bienvenido/a{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!
            </h1>
            <p className="text-blue-100 text-sm">Completa tu registro para continuar</p>
          </div>

          {/* Progress - solo mostrar si ya eligió tipo */}
          {step > 0 && (
            <div className="px-6 pt-6">
              <div className="flex items-center gap-2 mb-2">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                  <div 
                    key={s}
                    className={`flex-1 h-2 rounded-full transition-colors ${
                      s <= step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 text-center">Paso {step} de {totalSteps}</p>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* Step 0: Elegir tipo de usuario */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <User className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                    <h2 className="text-xl font-semibold text-gray-900">¿Cómo te unes?</h2>
                    <p className="text-gray-500 text-sm">Selecciona tu rol en la plataforma</p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => { setUserType('manager'); setStep(1); }}
                      className="w-full p-4 border-2 rounded-xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                          <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Soy Propietario</p>
                          <p className="text-sm text-gray-500">Quiero registrar mi restaurante</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => { setUserType('staff'); }}
                      className="w-full p-4 border-2 rounded-xl text-left hover:border-green-500 hover:bg-green-50 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                          <User className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Soy Colaborador</p>
                          <p className="text-sm text-gray-500">Tengo un código de invitación</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Input de código para colaborador */}
                  {userType === 'staff' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-4 border-t"
                    >
                      <div className="space-y-2">
                        <Label className="text-gray-700">Código de invitación *</Label>
                        <Input
                          value={invitationCode}
                          onChange={(e) => {
                            setInvitationCode(e.target.value.toUpperCase());
                            setCodeError('');
                          }}
                          placeholder="Ej: ABC12345"
                          className="h-12 text-center font-mono text-lg tracking-wider uppercase"
                          maxLength={8}
                        />
                        {codeError && (
                          <p className="text-sm text-red-500">{codeError}</p>
                        )}
                        <p className="text-xs text-gray-400">Ingresa el código que te compartió tu propietario</p>
                      </div>

                      <Button 
                        onClick={() => validateCodeMutation.mutate(invitationCode)}
                        disabled={invitationCode.length < 6 || validateCodeMutation.isPending}
                        className="w-full h-12 bg-green-600 hover:bg-green-700"
                      >
                        {validateCodeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Validar Código
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Step 1 para COLABORADOR: Datos personales */}
              {step === 1 && userType === 'staff' && (
                <motion.div
                  key="step1-staff"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <User className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h2 className="text-xl font-semibold text-gray-900">Tus datos</h2>
                    <p className="text-gray-500 text-sm">Completa tu información personal</p>
                  </div>

                  {/* Código validado */}
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 font-medium">
                      ✓ Código válido: {validatedCode?.code}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-gray-700">Tu nombre completo *</Label>
                      <Input
                        value={profileData.full_name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="Ej: Juan Carlos Pérez García"
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-700">Teléfono (opcional)</Label>
                      <Input
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+1 234 567 8900"
                        className="h-12"
                      />
                    </div>

                    {/* Zona Horaria */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-gray-700">
                        <Globe className="w-4 h-4 text-gray-400" />
                        Zona horaria *
                      </Label>
                      <Select
                        value={profileData.timezone}
                        onValueChange={(value) => setProfileData(prev => ({ ...prev, timezone: value }))}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecciona tu zona horaria" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {Object.entries(TIMEZONES_BY_REGION).map(([region, timezones]) => (
                            <div key={region}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                                {region}
                              </div>
                              {timezones.map(tz => (
                                <SelectItem key={tz.value} value={tz.value}>
                                  {tz.label}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Foto de perfil */}
                    <div className="flex flex-col items-center pt-4">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                          {profileData.profile_photo ? (
                            <img 
                              src={profileData.profile_photo} 
                              alt="Perfil"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-10 h-10 text-gray-400" />
                          )}
                        </div>
                        <label className="absolute bottom-0 right-0 w-7 h-7 bg-green-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-green-700 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                          {isUploading ? (
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                          ) : (
                            <Camera className="w-3 h-3 text-white" />
                          )}
                        </label>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">Foto (opcional)</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => { setStep(0); setUserType(null); setValidatedCode(null); }}
                      className="flex-1 h-12"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Atrás
                    </Button>
                    <Button 
                      onClick={handleCompleteStaff}
                      disabled={!canCompleteStaff || updateUserMutation.isPending}
                      className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      {updateUserMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Completar
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 1 para GERENTE: Company Info */}
              {step === 1 && userType === 'manager' && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                        <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                        <h2 className="text-xl font-semibold text-gray-900">Tu empresa</h2>
                        <p className="text-gray-500 text-sm">Cuéntanos sobre ti y tu negocio</p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-gray-700">Tu nombre completo *</Label>
                          <Input
                            value={profileData.full_name}
                            onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                            placeholder="Ej: Juan Carlos Pérez García"
                            className="h-12"
                          />
                          <p className="text-xs text-gray-400">Este nombre aparecerá en tu perfil y comunicaciones</p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-gray-700">Nombre de tu empresa o negocio *</Label>
                          <Input
                            value={profileData.company_name}
                            onChange={(e) => setProfileData(prev => ({ ...prev, company_name: e.target.value }))}
                            placeholder="Ej: Grupo Gastronómico XYZ, Restaurante La Esquina..."
                            className="h-12"
                          />
                        </div>

                    <div className="space-y-2">
                      <Label className="text-gray-700">Cuéntanos sobre ti (opcional)</Label>
                      <Textarea
                        value={profileData.bio}
                        onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="¿Cuántos años de experiencia tienes? ¿Qué tipo de cocina manejas?"
                        className="min-h-[100px]"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={() => setStep(2)}
                    disabled={!canProceedStep1Manager}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              )}

              {/* Step 2: Personal Info (solo gerentes) */}
              {step === 2 && userType === 'manager' && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <User className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                    <h2 className="text-xl font-semibold text-gray-900">Tu perfil</h2>
                    <p className="text-gray-500 text-sm">Información de contacto</p>
                  </div>

                  {/* Foto de perfil */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                        {profileData.profile_photo ? (
                          <img 
                            src={profileData.profile_photo} 
                            alt="Perfil"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-12 h-12 text-gray-400" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-blue-700 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Camera className="w-4 h-4 text-white" />
                        )}
                      </label>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Foto de perfil (opcional)</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-gray-400" />
                      Número de teléfono (opcional)
                    </Label>
                    <Input
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 234 567 8900"
                      className="h-12"
                    />
                  </div>

                  {/* Zona Horaria */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-gray-700">
                      <Globe className="w-4 h-4 text-gray-400" />
                      Zona horaria *
                    </Label>
                    <Select
                      value={profileData.timezone}
                      onValueChange={(value) => setProfileData(prev => ({ ...prev, timezone: value }))}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Selecciona tu zona horaria" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {Object.entries(TIMEZONES_BY_REGION).map(([region, timezones]) => (
                          <div key={region}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                              {region}
                            </div>
                            {timezones.map(tz => (
                              <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">Importante para reportes y análisis de ventas</p>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1 h-12"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Atrás
                    </Button>
                    <Button 
                      onClick={() => setStep(3)}
                      className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
                    >
                      Continuar
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Restaurants (solo gerentes) */}
              {step === 3 && userType === 'manager' && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <Store className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                    <h2 className="text-xl font-semibold text-gray-900">Tus restaurantes</h2>
                    <p className="text-gray-500 text-sm">Agrega los locales que vas a gestionar</p>
                  </div>

                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                    {restaurants.map((restaurant, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-xl space-y-3 relative">
                        {restaurants.length > 1 && (
                          <button
                            onClick={() => removeRestaurant(index)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Restaurante {index + 1}</span>
                        </div>

                        <Input
                          value={restaurant.name}
                          onChange={(e) => updateRestaurant(index, 'name', e.target.value)}
                          placeholder="Nombre del restaurante *"
                          className="h-10"
                        />
                        
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Input
                              value={restaurant.location}
                              onChange={(e) => updateRestaurant(index, 'location', e.target.value)}
                              placeholder="Ubicación / Dirección"
                              className="h-10"
                            />
                          </div>
                          <Select 
                            value={restaurant.currency} 
                            onValueChange={(value) => updateRestaurant(index, 'currency', value)}
                          >
                            <SelectTrigger className="w-[130px] h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {currencies.map(c => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    onClick={addRestaurant}
                    className="w-full h-10 border-dashed"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar otro restaurante
                  </Button>

                  <div className="flex gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => setStep(2)}
                      className="flex-1 h-12"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Atrás
                    </Button>
                    <Button 
                      onClick={handleCompleteManager}
                      disabled={!canCompleteManager || updateUserMutation.isPending || createRestaurantMutation.isPending}
                      className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                    >
                      {(updateUserMutation.isPending || createRestaurantMutation.isPending) ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Registrando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Completar Registro
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <p className="text-xs text-center text-gray-400">
              Tu cuenta será revisada por un administrador antes de ser activada
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}