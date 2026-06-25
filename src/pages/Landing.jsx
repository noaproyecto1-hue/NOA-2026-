import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  BarChart3,
  Shield,
  Users,
  TrendingUp,
  ChefHat,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle } from
"lucide-react";

const features = [
{
  icon: BarChart3,
  title: "Análisis en Tiempo Real",
  description: "Visualiza ventas, costos y márgenes al instante"
},
{
  icon: ChefHat,
  title: "Gestión de Recetas",
  description: "Controla ingredientes y costos de cada plato"
},
{
  icon: TrendingUp,
  title: "Proyecciones Inteligentes",
  description: "Anticipa tendencias y toma mejores decisiones"
},
{
  icon: Users,
  title: "Gestión de Equipos",
  description: "Administra empleados y colaboradores fácilmente"
}];


const benefits = [
"Control total de tu inventario",
"Alertas automáticas de stock bajo",
"Reportes detallados de ventas",
"Análisis de rentabilidad por producto",
"Gestión multi-restaurante",
"Encuestas NPS integradas"];


export default function Landing() {
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('cesar');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = () => {
    setLoginOpen(true);
    setLoginError(null);
  };

  const submitLogin = async (e) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await base44.auth.loginViaEmailPassword({ email, password });
      setLoginOpen(false);
      navigate(createPageUrl('Dashboard'));
      // recarga para que AuthContext lea la sesión nueva
      setTimeout(() => window.location.reload(), 50);
    } catch (err) {
      setLoginError(err.message || 'Error al iniciar sesión');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-noa-navy text-white">
      {/* Header */}
      <header className="relative z-10">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/images/noa-landing-logo.png" 
                alt="NOA - Neural Operations Assistant"
                className="h-20 w-auto object-contain"
              />
            </div>
            <Button
              onClick={handleLogin}
              className="bg-noa-orange text-noa-navy hover:bg-noa-orange-dark font-display font-bold px-6 rounded-lg">

              Iniciar Sesión
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-noa-orange/15 rounded-full blur-3xl" />
          <div className="absolute top-60 -left-40 w-80 h-80 bg-noa-orange/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}>

              <div className="inline-flex items-center gap-2 bg-noa-orange/15 text-noa-orange px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Shield className="w-4 h-4" />
                Plataforma segura y confiable
              </div>
              <h1 className="text-4xl lg:text-6xl font-display font-extrabold text-white leading-tight mb-6 tracking-tight">
                Tu restaurante,{' '}
                <span className="text-noa-orange">
                  bajo control total
                </span>
              </h1>
              <p className="text-lg text-white/80 mb-8 max-w-xl">
                La plataforma inteligente que te ayuda a gestionar ventas, costos, inventario 
                y equipo de trabajo en un solo lugar. Toma decisiones basadas en datos reales.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={handleLogin}
                  size="lg"
                  className="bg-noa-orange text-noa-navy hover:bg-noa-orange-dark font-display font-bold px-8 py-6 text-lg rounded-lg shadow-xl">

                  Comenzar Ahora
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="lg" className="bg-transparent text-white border border-white/30 hover:bg-white/10 px-8 py-6 text-lg font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-10 border-white/30 hover:bg-white/10"

                  onClick={handleLogin}>

                  Ya tengo cuenta
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block">

              <div className="relative">
                <div className="absolute inset-0 bg-noa-orange/10 rounded-3xl blur-2xl" />
                <img
                  src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80"
                  alt="Restaurant Dashboard"
                  className="relative rounded-3xl shadow-2xl border border-white/10" />

                {/* Floating card */}
                <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 max-w-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Ventas del mes</p>
                      <p className="text-xl font-bold text-gray-900">+24.5%</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16">

            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Todo lo que necesitas para gestionar tu negocio
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto">
              Herramientas poderosas diseñadas específicamente para restaurantes
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) =>
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:bg-white/15 transition-colors">

                <div className="w-14 h-14 bg-noa-orange rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-white/70 text-sm">{feature.description}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}>

              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                Simplifica la gestión de tu restaurante
              </h2>
              <p className="text-white/70 mb-8">
                Olvídate de las hojas de cálculo y los procesos manuales. 
                Nuestra plataforma automatiza y centraliza todo lo que necesitas.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) =>
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3">

                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-white/90">{benefit}</span>
                  </motion.div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative">

              <img
                src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80"
                alt="Restaurant"
                className="rounded-3xl shadow-2xl" />

            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-noa-navy-mid rounded-3xl p-12 border border-white/10">

            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              ¿Listo para transformar tu negocio?
            </h2>
            <p className="text-white/70 mb-8 max-w-xl mx-auto">
              Únete a cientos de restaurantes que ya optimizan sus operaciones con nuestra plataforma.
            </p>
            <Button
              onClick={handleLogin}
              size="lg"
              className="bg-noa-orange text-noa-navy hover:bg-noa-orange-dark font-display font-bold px-10 py-6 text-lg rounded-lg shadow-xl">

              Registrarme como Propietario
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img 
                src="/images/noa-landing-logo.png" 
                alt="NOA"
                className="h-14 w-auto object-contain"
              />
            </div>
            <p className="text-noa-orange/60 text-sm">
              © 2026 NOA - Neural Operations Assistant. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* Dialog de Login */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Iniciar Sesión</DialogTitle>
            <DialogDescription>
              Ingresa con tu usuario y contraseña. Por defecto: <code className="px-1 bg-gray-100 rounded">cesar</code> / <code className="px-1 bg-gray-100 rounded">1234</code>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitLogin} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label htmlFor="login-email">Usuario o email</Label>
              <Input
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cesar"
                autoFocus
                disabled={isLoggingIn}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="login-password">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                disabled={isLoggingIn}
              />
            </div>
            {loginError && (
              <div className="flex items-start gap-2 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isLoggingIn} className="w-full">
                {isLoggingIn ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Entrando...</>) : 'Entrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

}