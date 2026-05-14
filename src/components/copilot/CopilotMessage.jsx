import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Loader2 } from 'lucide-react';

const NOA_AVATAR_URL = "/images/noa-avatar.png";
import { cn } from "@/lib/utils";

// Solo mostrar indicador de carga cuando está procesando
const ToolCallDisplay = ({ toolCall, showOnlyLoading = true, isFullPage = false }) => {
  const status = toolCall?.status || 'pending';
  
  const isLoading = status === 'running' || status === 'in_progress' || status === 'pending';
  
  if (showOnlyLoading && !isLoading) {
    return null;
  }

  return (
    <div className={cn(
      "flex items-center gap-2 text-xs mt-1",
      isFullPage ? "text-white/60" : "text-slate-500"
    )}>
      <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
      <span>Analizando datos...</span>
    </div>
  );
};

// Función para limpiar el contexto de zona horaria del mensaje del usuario
const cleanUserMessage = (content) => {
  if (!content) return content;
  // Remover el contexto interno (zona horaria + identidad) que se añade automáticamente
  return content.replace(/\[Contexto del usuario:.*?\]\n\n/s, '');
};

export default function CopilotMessage({ message, isFullPage = false }) {
  const isUser = message.role === 'user';
  
  // Limpiar el contenido del mensaje si es del usuario
  const displayContent = isUser ? cleanUserMessage(message.content) : message.content;

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-10 w-10 rounded-xl flex-shrink-0 shadow-lg overflow-hidden bg-white flex items-center justify-center border border-gray-100">
          <img 
            src={NOA_AVATAR_URL} 
            alt="NOA" 
            className="h-8 w-8 object-contain"
          />
        </div>
      )}

      <div className={cn("max-w-[80%]", isUser && "flex flex-col items-end")}>
        {message.content && (
          <div className={cn(
            "rounded-2xl px-5 py-3",
            isUser
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
              : isFullPage 
                ? "bg-white/10 border border-white/20 text-white backdrop-blur-sm"
                : "bg-white border border-slate-200 shadow-sm"
          )}>
            {isUser ? (
              <p className="text-sm leading-relaxed">{displayContent}</p>
            ) : (
              <ReactMarkdown
                className={cn(
                  "text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                  isFullPage ? "prose-invert" : "prose-slate"
                )}
                components={{
                    p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                    strong: ({ children }) => <strong className={cn("font-semibold", isFullPage ? "text-white" : "text-gray-900")}>{children}</strong>,
                    code: ({ children }) => (
                      <code className={cn(
                        "px-1.5 py-0.5 rounded text-xs",
                        isFullPage ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                      )}>
                        {children}
                      </code>
                    ),
                    table: ({ children }) => (
                      <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-xs">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className={cn(isFullPage ? "bg-white/10" : "bg-slate-50")}>{children}</thead>,
                    tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
                    tr: ({ children }) => <tr>{children}</tr>,
                    th: ({ children }) => <th className={cn("px-3 py-1.5 text-left font-semibold", isFullPage ? "text-white/80" : "text-slate-600")}>{children}</th>,
                    td: ({ children }) => <td className={cn("px-3 py-1.5", isFullPage ? "text-white/70" : "text-slate-700")}>{children}</td>,
                  }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}

        {message.tool_calls?.length > 0 && message.tool_calls.some(tc => tc.status === 'running' || tc.status === 'in_progress') && (
          <div className="mt-2">
            <ToolCallDisplay toolCall={message.tool_calls.find(tc => tc.status === 'running' || tc.status === 'in_progress')} isFullPage={isFullPage} />
          </div>
        )}
      </div>

      {isUser && (
        <div className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
          isFullPage ? "bg-white/20" : "bg-slate-200"
        )}>
          <User className={cn("h-5 w-5", isFullPage ? "text-white" : "text-slate-600")} />
        </div>
      )}
    </div>
  );
}