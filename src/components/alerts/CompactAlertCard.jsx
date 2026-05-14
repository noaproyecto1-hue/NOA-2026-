import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  TrendingDown, 
  DollarSign, 
  ThumbsDown,
  Bell,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  Clock,
  Lightbulb,
  X,
  Pin,
  PinOff,
  TrendingUp,
  Package,
  ShoppingCart
} from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatDateInUserTz } from '@/components/utils/timezoneHelper';

const alertIcons = {
  cash_flow_negative: DollarSign,
  cost_increase: TrendingDown,
  sales_decline: TrendingDown,
  nps_drop: ThumbsDown,
  opex_spike: AlertTriangle,
  supply_price_increase: TrendingUp,
  supply_price_decrease: TrendingDown,
  unusual_purchase_volume: ShoppingCart,
  supplier_price_trend: TrendingUp,
  low_stock_product: Package,
  low_stock_supply: Package,
  custom: Bell
};

// Sistema semáforo: red=crítico, yellow=atención, green=ok
const severityConfig = {
  // Nuevo sistema semáforo
  red: {
    bg: 'bg-gradient-to-r from-red-500 to-rose-500',
    bgLight: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-800',
    icon: 'text-red-500',
    glow: 'shadow-red-500/20'
  },
  yellow: {
    bg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
    bgLight: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
    icon: 'text-amber-500',
    glow: 'shadow-amber-500/20'
  },
  green: {
    bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800',
    icon: 'text-emerald-500',
    glow: 'shadow-emerald-500/20'
  },
  // Legacy support
  critical: {
    bg: 'bg-gradient-to-r from-red-500 to-rose-500',
    bgLight: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-800',
    icon: 'text-red-500',
    glow: 'shadow-red-500/20'
  },
  high: {
    bg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
    bgLight: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
    icon: 'text-amber-500',
    glow: 'shadow-amber-500/20'
  },
  medium: {
    bg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
    bgLight: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
    icon: 'text-amber-500',
    glow: 'shadow-amber-500/20'
  },
  low: {
    bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800',
    icon: 'text-emerald-500',
    glow: 'shadow-emerald-500/20'
  }
};

const severityLabels = {
  // Nuevo sistema semáforo
  red: '🔴 Rojo',
  yellow: '🟡 Amarillo',
  green: '🟢 Verde',
  // Legacy support
  critical: '🔴 Rojo',
  high: '🟡 Amarillo',
  medium: '🟡 Amarillo',
  low: '🟢 Verde'
};

function CategoryBreakdown({ categories, itemsByCategory, label, itemLabel = 'item' }) {
  const [expandedCat, setExpandedCat] = useState(null);
  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="space-y-1">
        {sorted.map(([cat, amount]) => {
          const items = itemsByCategory?.[cat] || [];
          const hasItems = items.length > 0;
          const isExpanded = expandedCat === cat;

          return (
            <div key={cat}>
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${hasItems ? 'cursor-pointer hover:bg-gray-100' : ''} ${isExpanded ? 'bg-gray-100' : 'bg-gray-50'}`}
                onClick={() => hasItems && setExpandedCat(isExpanded ? null : cat)}
              >
                <div className="flex items-center gap-2">
                  {hasItems && (
                    <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  )}
                  <span className="text-sm font-medium text-gray-800">{cat}</span>
                </div>
                <span className="text-sm font-semibold text-gray-600">{Number(amount).toLocaleString()}</span>
              </div>
              <AnimatePresence>
                {isExpanded && items.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-6 mt-1 mb-1 space-y-1">
                      {items.sort((a, b) => b.amount - a.amount).slice(0, 10).map((it, i) => (
                        <div key={i} className="flex items-center justify-between bg-blue-50/50 rounded-md px-3 py-1.5 border border-blue-100/50">
                          <span className="text-xs text-gray-600">{it[itemLabel] || it.description || it.item || 'Detalle'}</span>
                          <span className="text-xs font-medium text-gray-700">{Number(it.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CompactAlertCard({ 
  alert, 
  onResolve, 
  onMarkRead,
  onTogglePin,
  showRestaurant = false,
  getRestaurantName,
  showPinButton = false,
  maxPinsReached = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  
  const Icon = alertIcons[alert.type] || AlertTriangle;
  const config = severityConfig[alert.severity] || severityConfig.medium;
  const isUnread = !alert.is_read && !alert.is_resolved;
  const isPinned = alert.is_pinned;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.95 }}
      className={`
        relative overflow-hidden rounded-2xl border transition-all duration-300
        ${config.bgLight} ${config.border}
        ${isUnread ? `ring-2 ring-offset-2 ${config.glow} shadow-lg` : 'shadow-sm'}
        hover:shadow-md
      `}
    >
      {/* Severity indicator bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${config.bg}`} />
      
      {/* Pin badge */}
      {isPinned && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-indigo-100 text-indigo-700 text-xs">
            <Pin className="w-3 h-3 mr-1" />
            Destacada
          </Badge>
        </div>
      )}
      
      {/* Main content - Always visible */}
      <div 
        className="pl-5 pr-4 py-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`p-2.5 rounded-xl ${config.bgLight} border ${config.border}`}>
            <Icon className={`w-5 h-5 ${config.icon}`} />
          </div>
          
          {/* Title and brief info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">
                {alert.title}
              </h3>
              <Badge className={`${config.badge} text-xs font-medium`}>
                {severityLabels[alert.severity]}
              </Badge>
              {isUnread && (
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{formatDateInUserTz(alert.created_date, "d MMM, HH:mm", currentUser)}</span>
              {showRestaurant && getRestaurantName && (
                <>
                  <span>•</span>
                  <span className="font-medium">{getRestaurantName(alert.restaurant_id)}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Actions and expand button */}
          <div className="flex items-center gap-2">
            {/* Pin button */}
            {showPinButton && !alert.is_resolved && onTogglePin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (!isPinned && maxPinsReached) return;
                  onTogglePin(alert.id, isPinned); 
                }}
                disabled={!isPinned && maxPinsReached}
                className={`h-8 px-2 ${isPinned ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-600'}`}
                title={isPinned ? 'Quitar de dashboard' : maxPinsReached ? 'Máximo 3 alertas destacadas' : 'Mostrar en dashboard'}
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </Button>
            )}
            {!alert.is_resolved && (
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onResolve(alert.id); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Resuelto
              </Button>
            )}
            <button 
              className={`p-1.5 rounded-lg transition-colors ${config.bgLight} hover:bg-white`}
            >
              {isExpanded ? (
                <ChevronUp className={`w-4 h-4 ${config.icon}`} />
              ) : (
                <ChevronDown className={`w-4 h-4 ${config.icon}`} />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Expandable details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-0 space-y-3 border-t border-gray-100 ml-1.5">
              {/* Full message */}
              <div className="pt-3">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {alert.message}
                </p>
              </div>

              {/* Category breakdown with expandable items */}
              {alert.metadata?.categories && Object.keys(alert.metadata.categories).length > 0 && (
                <CategoryBreakdown 
                  categories={alert.metadata.categories} 
                  itemsByCategory={alert.metadata.items_by_category}
                  label="Desglose por categoría"
                />
              )}

              {/* Cost centers breakdown with expandable items */}
              {alert.metadata?.cost_centers && Object.keys(alert.metadata.cost_centers).length > 0 && (
                <CategoryBreakdown 
                  categories={Object.fromEntries(
                    Object.entries(alert.metadata.cost_centers).filter(([name]) => {
                      const n = name.toUpperCase();
                      return !n.includes('PAYROLL') && !n.includes('RRHH') && !n.includes('PERSONAL');
                    })
                  )}
                  itemsByCategory={alert.metadata.items_by_center}
                  label="Desglose por centro de costo"
                  itemLabel="category"
                />
              )}

              {/* EBITDA cost breakdown — shows all cost families impacting EBITDA */}
              {alert.metadata?.cost_breakdown && Object.keys(alert.metadata.cost_breakdown).length > 0 && (
                <CategoryBreakdown 
                  categories={alert.metadata.cost_breakdown}
                  itemsByCategory={alert.metadata.cost_items}
                  label="Centros de costo que impactan EBITDA"
                  itemLabel="category"
                />
              )}
              
              {/* Suggested action */}
              {alert.suggested_action && (
                <div className="flex items-start gap-2 p-3 bg-white rounded-xl border border-gray-100">
                  <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Acción sugerida
                    </p>
                    <p className="text-sm text-gray-700">
                      {alert.suggested_action}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Additional actions */}
              <div className="flex items-center justify-between pt-2">
                {!alert.is_read && !alert.is_resolved && onMarkRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onMarkRead(alert.id); }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Marcar como leída
                  </Button>
                )}
                {alert.is_resolved && alert.resolved_at && (
                  <p className="text-xs text-emerald-600">
                    ✓ Resuelta el {formatDateInUserTz(alert.resolved_at, "d MMM, HH:mm", currentUser)}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}