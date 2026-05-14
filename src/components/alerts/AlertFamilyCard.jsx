import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from "@/components/ui/badge";
import { Settings, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

const FAMILY_IMAGES = {
  food_cost: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=600&q=80',
  costo_personal: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=600&q=80',
  opex: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80',
  ebitda: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80',
};

const FAMILY_GRADIENTS = {
  food_cost: 'from-amber-950/90 via-orange-900/80 to-amber-800/70',
  costo_personal: 'from-violet-950/90 via-purple-900/80 to-violet-800/70',
  opex: 'from-slate-950/90 via-blue-900/80 to-slate-800/70',
  ebitda: 'from-emerald-950/90 via-teal-900/80 to-emerald-800/70',
};

const SEVERITY_DOTS = {
  red: 'bg-red-500',
  yellow: 'bg-amber-400',
  green: 'bg-emerald-500',
};

export default function AlertFamilyCard({
  familyId,
  label,
  icon: Icon,
  alerts = [],
  isSelected,
  onClick,
  onConfigClick,
}) {
  const redCount = alerts.filter(a => a.severity === 'red' || a.severity === 'critical').length;
  const yellowCount = alerts.filter(a => a.severity === 'yellow' || a.severity === 'medium' || a.severity === 'high').length;
  const greenCount = alerts.filter(a => a.severity === 'green' || a.severity === 'low').length;
  const totalAlerts = alerts.length;

  const imageSrc = FAMILY_IMAGES[familyId] || FAMILY_IMAGES.opex;
  const gradient = FAMILY_GRADIENTS[familyId] || FAMILY_GRADIENTS.opex;

  const overallStatus = redCount > 0 ? 'red' : yellowCount > 0 ? 'yellow' : 'green';
  const statusBorder = {
    red: 'ring-2 ring-red-400/60',
    yellow: 'ring-2 ring-amber-400/60',
    green: 'ring-2 ring-emerald-400/40',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300
        ${isSelected ? `${statusBorder[overallStatus]} shadow-xl ring-offset-2` : 'shadow-md hover:shadow-lg'}
      `}
    >
      {/* Background image */}
      <div className="absolute inset-0">
        <img src={imageSrc} alt="" className="w-full h-full object-cover" />
        <div className={`absolute inset-0 bg-gradient-to-t ${gradient}`} />
      </div>

      {/* Content */}
      <div className="relative z-10 p-4 flex flex-col justify-between h-full" style={{ minHeight: 130 }}>
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onConfigClick(familyId); }}
            className="w-7 h-7 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/25 transition-colors border border-white/20"
          >
            <Settings className="w-3.5 h-3.5 text-white/80" />
          </button>
        </div>

        {/* Bottom */}
        <div className="mt-auto">
          <h3 className="text-white font-extrabold text-lg tracking-tight leading-tight drop-shadow-lg">{label}</h3>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md rounded-lg px-2.5 py-1.5">
              {[
                { count: redCount, color: SEVERITY_DOTS.red },
                { count: yellowCount, color: SEVERITY_DOTS.yellow },
                { count: greenCount, color: SEVERITY_DOTS.green },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color} ${s.count > 0 ? 'shadow-lg' : 'opacity-25'}`} />
                  <span className={`text-xs font-bold ${s.count > 0 ? 'text-white' : 'text-white/25'}`}>{s.count}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {totalAlerts === 0 ? (
                <Badge className="bg-emerald-500/90 text-white text-[10px] border-0 backdrop-blur-sm shadow-lg px-2 py-0.5">
                  <CheckCircle2 className="w-3 h-3 mr-0.5" /> OK
                </Badge>
              ) : (
                <Badge className="bg-red-500/90 text-white text-[10px] border-0 backdrop-blur-sm shadow-lg px-2 py-0.5">
                  <AlertTriangle className="w-3 h-3 mr-0.5" /> {totalAlerts}
                </Badge>
              )}
              <ChevronRight className={`w-4 h-4 text-white/70 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
            </div>
          </div>
        </div>
      </div>

      {isSelected && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/80" />}
    </motion.div>
  );
}