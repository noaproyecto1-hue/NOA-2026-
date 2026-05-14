import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const TIPS = [
  // 💡 Consejos prácticos
  { text: "¿Ya revisaste tu food cost esta semana? Un control semanal puede ahorrarte sorpresas a fin de mes 📊", type: "tip" },
  { text: "Consejo: haz conteos de inventario al menos 1 vez por semana en tus insumos de alto valor 📦", type: "tip" },
  { text: "¿Tus fichas técnicas están actualizadas? Recetas desactualizadas son la causa #1 de sobre-porcionamiento 🍳", type: "tip" },
  { text: "Tip: compara tus precios de proveedores cada mes. Un 5% de ahorro en insumos impacta directo en tu margen 🚛", type: "tip" },
  { text: "Los restaurantes más rentables revisan su estado de resultados semanalmente, no solo a fin de mes 📈", type: "tip" },
  { text: "¿Registras las mermas diariamente? Documentar todo desperdicio es el primer paso para reducirlo 📉", type: "tip" },
  { text: "Consejo: muestrea al menos 3 recetas por semana para detectar desviaciones temprano 🔬", type: "tip" },
  
  // 🧠 ¿Sabías que...?
  { text: "¿Sabías que el 60% de las pérdidas en restaurantes vienen de sobre-porcionamiento, no de robo? 🤔", type: "fact" },
  { text: "¿Sabías que un food cost ideal está entre 28% y 35%? ¿Cómo va el tuyo este mes? 🎯", type: "fact" },
  { text: "Dato: los restaurantes que hacen muestreos de recetas reducen su merma hasta un 15% 📋", type: "fact" },
  { text: "¿Sabías que el ticket promedio sube hasta 12% cuando los meseros conocen bien el menú? 🍽️", type: "fact" },
  { text: "Un protocolo de recepción de mercadería puede eliminar hasta el 8% de pérdidas por faltante de proveedor ✅", type: "fact" },
  
  // 😄 Humor gastronómico
  { text: "¿Por qué el chef fue al psicólogo? Porque tenía demasiada presión en la cocina 😅", type: "joke" },
  { text: "Un mesero le dice al chef: 'La mesa 5 dice que la comida está fría'. El chef: '¡Pues dile que la sopa es gazpacho!' 🍅😂", type: "joke" },
  { text: "¿Qué le dijo un food cost del 50% al dueño? 'Sorpresa, estoy pagando la renta yo solo' 💸😬", type: "joke" },
  { text: "Hay dos tipos de restauranteros: los que revisan su inventario... y los que se preguntan a dónde se fue todo 🕵️😄", type: "joke" },
  { text: "Mi contador dice que necesito reducir costos. Le dije que empezara por su factura 📄😂", type: "joke" },
  { text: "¿Cuál es el plato favorito de un contador? ¡El balance! ⚖️😄", type: "joke" },
  { text: "El proveedor dijo 'te mando 10 kilos'. Llegaron 8. El kilo fantasma ya es tradición 👻😅", type: "joke" },
  { text: "Un chef optimista: 'No es merma, es una degustación no planificada' 🍽️😂", type: "joke" },
  { text: "EBITDA negativo no es un problema, es una oportunidad de mejora... muy intensa 📉😅", type: "joke" },
  { text: "¿Sabes cuál es el ingrediente secreto de un restaurante exitoso? ¡Revisar los números! Ah, ¿esperabas amor? También 💕📊", type: "joke" },

  // ❓ Preguntas que invitan a explorar
  { text: "¿Cómo va tu EBITDA este mes? Pregúntame y te doy un resumen rápido 💬", type: "question" },
  { text: "¿Cuál es tu insumo más caro? Puedo ayudarte a buscar alternativas 🔍", type: "question" },
  { text: "¿Has comparado tus ventas de este mes vs el anterior? Te puedo mostrar la tendencia 📊", type: "question" },
  { text: "¿Tienes alertas pendientes? Puedo darte un resumen de las más urgentes 🚨", type: "question" },
  { text: "¿Quieres saber qué mesero vendió más esta semana? ¡Pregúntame! 🏆", type: "question" },
  { text: "¿Cómo están tus niveles de stock? Puedo revisar si hay insumos críticos 📦", type: "question" },
  { text: "¿Ya configuraste tu proforma financiera? Es clave para saber si vas por buen camino 🎯", type: "question" },
];

const TIP_INTERVAL = 2 * 60 * 1000; // 2 minutos
const TIP_DISPLAY_DURATION = 8000; // 8 segundos visible
const INITIAL_DELAY = 60000; // 1 minuto después de cargar

export default function CopilotTipBubble({ isOpen, onOpenChat }) {
  const [currentTip, setCurrentTip] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [usedIndices, setUsedIndices] = useState([]);

  const getRandomTip = useCallback(() => {
    let available = TIPS.map((_, i) => i).filter(i => !usedIndices.includes(i));
    if (available.length === 0) {
      setUsedIndices([]);
      available = TIPS.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    setUsedIndices(prev => [...prev, idx]);
    return TIPS[idx];
  }, [usedIndices]);

  const showTip = useCallback(() => {
    if (isOpen) return; // No mostrar si el chat está abierto
    const tip = getRandomTip();
    setCurrentTip(tip);
    setVisible(true);
    setDismissed(false);

    // Auto-hide después de duración
    setTimeout(() => {
      setVisible(false);
    }, TIP_DISPLAY_DURATION);
  }, [isOpen, getRandomTip]);

  useEffect(() => {
    // Primer tip después de delay inicial
    const initialTimer = setTimeout(() => {
      showTip();
    }, INITIAL_DELAY);

    // Tips periódicos
    const interval = setInterval(() => {
      showTip();
    }, TIP_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [showTip]);

  // Ocultar si se abre el chat
  useEffect(() => {
    if (isOpen) {
      setVisible(false);
    }
  }, [isOpen]);

  const handleDismiss = (e) => {
    e.stopPropagation();
    setVisible(false);
    setDismissed(true);
  };

  const handleClick = () => {
    setVisible(false);
    if (onOpenChat) onOpenChat();
  };

  return (
    <AnimatePresence>
      {visible && !isOpen && !dismissed && currentTip && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          onClick={handleClick}
          className="fixed bottom-24 right-4 z-50 max-w-[280px] cursor-pointer group"
        >
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-4 pr-8">
            {/* Puntita del speech bubble */}
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white border-r border-b border-gray-100 transform rotate-45" />
            
            {/* Botón cerrar */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>

            {/* Contenido */}
            <p className="text-sm text-gray-700 leading-relaxed">
              {currentTip.text}
            </p>
            
            {/* Indicador sutil de que es clickeable */}
            <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-indigo-500 font-medium">Abrir chat</span>
              <span className="text-xs text-indigo-400">→</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}