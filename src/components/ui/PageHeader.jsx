import React from 'react';
import { motion } from 'framer-motion';

// Imágenes temáticas de alta calidad para cada sección
const headerImages = {
  dashboard: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80',
  alerts: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1920&q=80',
  dailyReport: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=80',
  inventory: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&q=80',
  recipes: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80',
  sales: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=1920&q=80',
  restaurants: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80',
  dataManagement: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=80',
  reviews: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&q=80',
  employees: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80',
  clients: 'https://images.unsplash.com/photo-1556742111-a301076d9d18?w=1920&q=80',
  settings: 'https://images.unsplash.com/photo-1581287053822-fd7bf4f4bfec?w=1920&q=80',
  myProfile: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1920&q=80',
  copilot: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1920&q=80',
};

export default function PageHeader({ 
  title, 
  subtitle, 
  icon: Icon,
  imageKey = 'dashboard',
  children,
  compact = false,
  gradient = 'from-slate-900/90 via-slate-900/70 to-slate-900/50'
}) {
  const imageUrl = headerImages[imageKey] || headerImages.dashboard;
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative overflow-hidden ${compact ? 'py-8' : 'py-12 lg:py-16'}`}
    >
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      
      {/* Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />
      
      {/* Animated particles/dots effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white rounded-full animate-pulse delay-100" />
        <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-200" />
        <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-white rounded-full animate-pulse delay-300" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-4"
          >
            {Icon && (
              <div className="w-14 h-14 lg:w-16 lg:h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
                <Icon className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-white tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-white/70 mt-1 text-sm lg:text-base">
                  {subtitle}
                </p>
              )}
            </div>
          </motion.div>
          
          {children && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap items-center gap-3"
            >
              {children}
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent" />
    </motion.div>
  );
}