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

// Hero unificado NOA (Brand Book): navy dominante + foto + overlay navy 0.72,
// icon box, título Bricolage, subtítulo DM Sans, acciones a la derecha.
export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  imageKey = 'dashboard',
  children,
  compact = false,
  gradient, // ignorado: el overlay siempre es navy 0.72 por Brand Book
}) {
  const imageUrl = headerImages[imageKey] || headerImages.dashboard;

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: '#0C1B33', padding: compact ? '24px 0' : '32px 0', minHeight: compact ? 96 : 120 }}
    >
      {/* Foto del módulo */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${imageUrl})` }} />
      {/* Overlay navy 72% (obligatorio Brand Book) */}
      <div className="absolute inset-0" style={{ background: 'rgba(12, 27, 51, 0.72)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-center gap-5">
            {Icon && (
              <div className="rounded-xl p-3 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Icon className="w-7 h-7 text-white" />
              </div>
            )}
            <div>
              <h1
                className="text-white m-0"
                style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700, fontSize: '28px', letterSpacing: '-0.5px' }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  className="m-0 mt-0.5"
                  style={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 300, fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {children && (
            <div className="flex flex-wrap items-center gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}