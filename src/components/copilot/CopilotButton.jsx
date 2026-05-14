import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const NOA_AVATAR_URL = "/images/noa-avatar.png";

export default function CopilotButton({ isOpen, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 z-50
        w-14 h-14 rounded-full shadow-2xl
        flex items-center justify-center overflow-hidden
        transition-all duration-300
        ${isOpen 
          ? 'bg-gray-800 hover:bg-gray-700' 
          : 'bg-white hover:bg-gray-50 border border-gray-200'
        }
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-white" />
      ) : (
        <img
          src={NOA_AVATAR_URL}
          alt="NOA"
          className="w-10 h-10 object-contain"
        />
      )}
      
      {/* Pulse animation when closed */}
      {!isOpen && (
        <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-20" />
      )}
    </motion.button>
  );
}