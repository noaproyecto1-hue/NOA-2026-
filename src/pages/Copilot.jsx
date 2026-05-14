import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, MessageSquare, Plus, Clock, MessageCircle, Sparkles, History, X, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import CopilotChat from '@/components/copilot/CopilotChat';

const MAX_CONVERSATIONS = 10;

export default function Copilot() {
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['copilotConversations'],
    queryFn: async () => {
      const convs = await base44.agents.listConversations({ agent_name: 'restaurant_copilot' });
      const hiddenIds = (() => { try { return JSON.parse(localStorage.getItem('noa_hidden_convs') || '[]'); } catch { return []; } })();
      return convs
        .filter(c => !c.metadata?.archived && !hiddenIds.includes(c.id))
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!user
  });

  const handleNewConversation = async () => {
    try {
      const newConv = await base44.agents.createConversation({
        agent_name: 'restaurant_copilot',
        metadata: {
          name: `Nueva consulta`,
          user_email: user.email,
          created_at: new Date().toISOString()
        }
      });
      setSelectedConversationId(newConv.id);
      refetchConversations();
      setHistoryOpen(false);
      toast.success('Nueva conversación iniciada');
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const getHiddenIds = () => {
    try {
      return JSON.parse(localStorage.getItem('noa_hidden_convs') || '[]');
    } catch { return []; }
  };

  const saveHiddenIds = (ids) => {
    localStorage.setItem('noa_hidden_convs', JSON.stringify(ids));
  };

  const handleDeleteConversation = (convId, e) => {
    e.stopPropagation();
    const hidden = getHiddenIds();
    hidden.push(convId);
    saveHiddenIds(hidden);
    if (selectedConversationId === convId) {
      setSelectedConversationId(null);
    }
    refetchConversations();
    toast.success('Conversación eliminada');
  };

  const handleDeleteAll = () => {
    const allIds = conversations.map(c => c.id);
    const hidden = [...getHiddenIds(), ...allIds];
    saveHiddenIds(hidden);
    setSelectedConversationId(null);
    refetchConversations();
    setHistoryOpen(false);
    toast.success('Historial limpiado');
  };

  const getConversationTitle = (conv) => {
    if (conv.metadata?.custom_name) return conv.metadata.custom_name;
    if (conv.metadata?.name && conv.metadata.name !== 'Nueva consulta') return conv.metadata.name;
    
    const firstUserMsg = conv.messages?.find(m => m.role === 'user');
    if (firstUserMsg?.content) {
      const content = firstUserMsg.content;
      if (content.length > 40) {
        return content.substring(0, 40) + '...';
      }
      return content;
    }
    
    return 'Nueva consulta';
  };

  const getMessageCount = (conv) => {
    return conv.messages?.length || 0;
  };

  const selectConversation = (convId) => {
    setSelectedConversationId(convId);
    setHistoryOpen(false);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 overflow-hidden relative">
      {/* Ocultar scrollbar pero mantener funcionalidad */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      {/* Header compacto */}
      <div className="flex-shrink-0 px-6 py-3 relative z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">NOA Copilot</h1>
              <p className="text-xs text-white/60">Tu asistente inteligente</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost"
              onClick={() => setHistoryOpen(true)}
              className="text-white/70 hover:text-white hover:bg-white/10 relative"
            >
              <History className="w-4 h-4 mr-2" />
              Historial
              {conversations.length > 0 && (
                <span className="ml-2 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                  {conversations.length}
                </span>
              )}
            </Button>
            <Button 
              onClick={handleNewConversation}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area - Compacto y elegante */}
      <div className="flex-1 overflow-hidden relative z-10 px-6 py-4">
        <div className="h-full max-w-2xl mx-auto">
          <div className="h-full bg-white/[0.07] backdrop-blur-md rounded-2xl border border-white/15 shadow-2xl overflow-hidden">
            <CopilotChat 
              isOpen={true} 
              isFullPage={true} 
              conversationId={selectedConversationId}
              onConversationUpdate={refetchConversations}
            />
          </div>
        </div>
      </div>

      {/* Slide Panel - Historial */}
      <AnimatePresence>
        {historyOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            
            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white">Historial</h2>
                    <p className="text-xs text-white/70">{conversations.length} conversaciones</p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Nueva conversación + Limpiar */}
              <div className="p-4 border-b space-y-2">
                <Button 
                  onClick={handleNewConversation}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Conversación
                </Button>
                {conversations.length > 0 && (
                  <Button 
                    variant="outline"
                    onClick={handleDeleteAll}
                    className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpiar todo el historial
                  </Button>
                )}
              </div>

              {/* Lista de conversaciones */}
              <div className="flex-1 overflow-y-auto p-4">
                {conversations.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-indigo-600" />
                    </div>
                    <p className="font-medium text-gray-900">Sin conversaciones</p>
                    <p className="text-sm text-gray-500 mt-1">Inicia tu primera consulta con NOA</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.length >= MAX_CONVERSATIONS && (
                      <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Las conversaciones más antiguas se reemplazarán automáticamente
                      </div>
                    )}
                    
                    {conversations.slice(0, MAX_CONVERSATIONS).map((conv) => {
                      const msgCount = getMessageCount(conv);
                      const isRecent = new Date() - new Date(conv.created_date) < 24 * 60 * 60 * 1000;
                      const isSelected = selectedConversationId === conv.id;
                      
                      return (
                        <motion.button
                          key={conv.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => selectConversation(conv.id)}
                          className={`
                            w-full p-4 rounded-xl transition-all text-left group
                            ${isSelected 
                              ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-sm' 
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isSelected 
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
                                : 'bg-gray-200 group-hover:bg-gray-300'
                            }`}>
                              <MessageCircle className={`w-5 h-5 ${
                                isSelected ? 'text-white' : 'text-gray-500'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm truncate ${
                                isSelected ? 'text-indigo-900' : 'text-gray-900'
                              }`}>
                                {getConversationTitle(conv)}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {isRecent 
                                    ? formatDistanceToNow(new Date(conv.created_date), { locale: es, addSuffix: true })
                                    : format(new Date(conv.created_date), "d MMM yyyy", { locale: es })
                                  }
                                </span>
                                {msgCount > 0 && (
                                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                    {msgCount} msg
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleDeleteConversation(conv.id, e)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100 text-gray-400 hover:text-red-500"
                              title="Eliminar conversación"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}