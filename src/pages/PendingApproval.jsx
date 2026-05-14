import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Clock, 
  Mail, 
  LogOut,
  CheckCircle,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";

export default function PendingApproval() {
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    refetchInterval: 10000 // Revisar cada 10 segundos si ya fue aprobado
  });

  // Si ya fue aprobado, redirigir al Dashboard
  React.useEffect(() => {
    if (user?.is_approved) {
      navigate(createPageUrl('Dashboard'));
    }
  }, [user, navigate]);

  // Si es admin, redirigir
  React.useEffect(() => {
    if (user?.role === 'admin') {
      navigate(createPageUrl('SuperadminDashboard'));
    }
  }, [user, navigate]);

  // Si no ha completado onboarding, redirigir
  React.useEffect(() => {
    if (user && !user.onboarding_completed) {
      navigate(createPageUrl('Onboarding'));
    }
  }, [user, navigate]);

  const handleLogout = () => {
    base44.auth.logout(createPageUrl('Landing'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-amber-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="bg-white/90 backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden border-0">
          {/* Header con animación */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-8 text-center relative overflow-hidden">
            
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 relative"
            >
              <Clock className="w-10 h-10 text-white" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-2">
              Solicitud en Revisión
            </h1>
            <p className="text-amber-100 text-sm">
              Estamos verificando tu información
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="text-center mb-8">
              <p className="text-gray-600 leading-relaxed">
                ¡Gracias por registrarte, <span className="font-semibold text-gray-900">{user?.full_name}</span>! 
                Tu solicitud ha sido recibida y está siendo revisada por nuestro equipo.
              </p>
            </div>

            {/* Status steps */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-3 bg-green-50 rounded-xl">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-green-800">Registro completado</p>
                  <p className="text-sm text-green-600">Tu información fue recibida</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-amber-50 rounded-xl border-2 border-amber-200">
                <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Clock className="w-5 h-5 text-white" />
                  </motion.div>
                </div>
                <div>
                  <p className="font-medium text-amber-800">En revisión</p>
                  <p className="text-sm text-amber-600">24-48 horas aproximadamente</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl opacity-50">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-500">Cuenta activa</p>
                  <p className="text-sm text-gray-400">Pendiente de aprobación</p>
                </div>
              </div>
            </div>

            {/* Email notice */}
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">Te notificaremos por email</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Recibirás un correo en <span className="font-medium">{user?.email}</span> cuando tu cuenta sea aprobada.
                  </p>
                </div>
              </div>
            </div>

            {/* Logout button */}
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full h-12 text-gray-600 hover:bg-gray-100"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6">
            <p className="text-xs text-center text-gray-400">
              ¿Tienes preguntas? Contáctanos en soporte@restaurantcopilot.com
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}