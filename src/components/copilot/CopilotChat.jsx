import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Send, Loader2, Maximize2, Sparkles, Bot, X } from 'lucide-react';

const NOA_AVATAR_URL = "/images/noa-avatar.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import CopilotMessage from './CopilotMessage';
import { getTimezoneContextForAgent } from '@/components/utils/timezoneHelper';

export default function CopilotChat({ isOpen, onClose, isFullPage = false, conversationId, onConversationUpdate }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load specific conversation when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    } else if ((isOpen || isFullPage) && user && !conversation) {
      loadOrCreateConversation();
    }
  }, [conversationId, isOpen, isFullPage, user]);

  // Subscribe to conversation updates
  useEffect(() => {
    if (!conversation?.id) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const msgs = data.messages || [];
      setMessages(msgs);
      
      // Check if AI is still responding
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg) {
        const hasRunningTools = lastMsg.tool_calls?.some(tc => 
          tc.status === 'running' || tc.status === 'in_progress' || tc.status === 'pending'
        );
        const isAssistantThinking = lastMsg.role === 'assistant' && !lastMsg.content && hasRunningTools;
        const isWaitingForResponse = lastMsg.role === 'user'; // Just sent, waiting for assistant
        setIsLoading(isAssistantThinking || isWaitingForResponse);
      }
      
      // Notificar actualización para refrescar el historial
      if (onConversationUpdate) {
        onConversationUpdate();
      }
    });

    return () => unsubscribe();
  }, [conversation?.id]);

  const loadConversation = async (convId) => {
    try {
      const existingConv = await base44.agents.getConversation(convId);
      setConversation(existingConv);
      setMessages(existingConv.messages || []);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const loadOrCreateConversation = async () => {
    try {
      // Try to find existing conversation
      const conversations = await base44.agents.listConversations({
        agent_name: 'restaurant_copilot'
      });

      if (conversations?.length > 0) {
        // Load most recent
        const sorted = conversations.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        const existingConv = await base44.agents.getConversation(sorted[0].id);
        setConversation(existingConv);
        setMessages(existingConv.messages || []);
      } else {
        // Create new conversation
        const newConv = await base44.agents.createConversation({
          agent_name: 'restaurant_copilot',
          metadata: {
            name: `Nueva consulta`,
            user_email: user.email
          }
        });
        setConversation(newConv);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !conversation || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Recargar la conversación para tener el objeto más actualizado
      let freshConversation = conversation;
      try {
        freshConversation = await base44.agents.getConversation(conversation.id);
        setConversation(freshConversation);
      } catch (e) {
        console.warn('Could not refresh conversation, using cached version');
      }

      // Incluir contexto del usuario (zona horaria + identidad) para que el agente filtre correctamente
      let messageWithContext = userMessage;
      try {
        const tzContext = getTimezoneContextForAgent(user);
        const userTz = user?.timezone || 'America/Santiago';
        messageWithContext = `[Contexto del usuario: Email=${user.email}, Nombre=${user.display_name || user.full_name || ''}, Rol=${user.role || ''}, Zona horaria IANA=${userTz}, Zona horaria label=${tzContext.timezone_label}, Fecha actual (en SU zona horaria)=${tzContext.current_date}, Hora actual=${tzContext.current_time}, Día=${tzContext.day_of_week}. IMPORTANTE: Cuando llames a noaCopilotData, incluye "userTimezone": "${userTz}" en los parámetros.]\n\n${userMessage}`;
      } catch (e) {
        messageWithContext = `[Contexto del usuario: Email=${user?.email || ''}, Nombre=${user?.display_name || user?.full_name || ''}]\n\n${userMessage}`;
      }
      
      await base44.agents.addMessage(freshConversation, {
        role: 'user',
        content: messageWithContext
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-crear conversación cuando no hay conversationId y estamos en fullPage
  useEffect(() => {
    if (isFullPage && user && !conversation && !conversationId) {
      loadOrCreateConversation();
    }
  }, [isFullPage, user, conversation, conversationId]);

  if (!isOpen && !isFullPage) return null;

  const suggestedQuestionsData = [
    { text: "¿Cómo van mis ventas este mes?", icon: "📈" },
    { text: "¿Cuál es mi food cost actual?", icon: "🍽️" },
    { text: "¿Qué productos están por agotarse?", icon: "📦" },
    { text: "Dame recomendaciones para mejorar", icon: "💡" }
  ];

  const chatContent = (
    <div className={`flex flex-col ${isFullPage ? 'h-full' : 'h-[500px]'}`}>
      {/* Header - Solo para el popup flotante */}
      {!isFullPage && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden">
              <img src={NOA_AVATAR_URL} alt="NOA" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h3 className="font-bold text-white">NOA Copilot</h3>
              <p className="text-xs text-indigo-200">Tu asistente de gestión</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to={createPageUrl('Copilot')}>
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/20">
                <Maximize2 className="w-4 h-4" />
              </Button>
            </Link>
            {onClose && (
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar ${
        isFullPage ? 'bg-transparent' : 'bg-gray-50'
      }`}>
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 rounded-3xl mx-auto mb-6 shadow-xl overflow-hidden bg-white flex items-center justify-center">
              <img 
                src={NOA_AVATAR_URL} 
                alt="NOA" 
                className="h-20 w-20 object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <h4 className={`font-bold text-xl mb-3 ${isFullPage ? 'text-white' : 'text-gray-900'}`}>
              ¡Hola! Soy NOA
            </h4>
            <p className={`text-sm mb-8 max-w-md mx-auto ${isFullPage ? 'text-white/70' : 'text-gray-500'}`}>
              Tu asistente experto en gestión de restaurantes. Pregúntame sobre ventas, costos, inventario o pide recomendaciones.
            </p>
            <div className={`grid gap-3 max-w-xl mx-auto ${isFullPage ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {suggestedQuestionsData.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputValue(item.text)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all ${
                    isFullPage 
                      ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20' 
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-200'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="flex-1">{item.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, idx) => (
              <CopilotMessage key={idx} message={msg} isFullPage={isFullPage} />
            ))}
          </div>
        )}
        
        {isLoading && (
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-xl flex-shrink-0 shadow-lg overflow-hidden bg-white flex items-center justify-center">
                <img src={NOA_AVATAR_URL} alt="NOA" className="h-8 w-8 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
              <div className={`rounded-2xl px-5 py-4 ${
                isFullPage 
                  ? 'bg-white/10 border border-white/20' 
                  : 'bg-white border border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className={`text-sm ${isFullPage ? 'text-white/70' : 'text-gray-500'}`}>
                    Consultando información...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-4 flex-shrink-0 ${
        isFullPage 
          ? 'bg-slate-900/50 border-t border-white/10' 
          : 'bg-white border-t'
      }`}>
        <div className="flex gap-3 max-w-3xl mx-auto">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Pregunta sobre tu negocio..."
            className={`flex-1 h-12 text-base ${
              isFullPage 
                ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15' 
                : ''
            }`}
            disabled={isLoading || !conversation}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || !conversation}
            className="h-12 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (isFullPage) {
    return chatContent;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-24 right-6 z-50 w-96 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
      >
        {chatContent}
      </motion.div>
    </AnimatePresence>
  );
}