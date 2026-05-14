import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';

export default function RefreshButton({ 
  queryKeys = [], 
  label = "Actualizar",
  className = "",
  variant = "outline",
  size = "default",
  showLabel = true,
  onRefresh
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    if (queryKeys.length > 0) {
      // Invalidar queries específicas
      await Promise.all(
        queryKeys.map(key => 
          queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
        )
      );
    } else {
      // Invalidar TODAS las queries
      await queryClient.invalidateQueries();
    }

    if (onRefresh) {
      await onRefresh();
    }

    // Pequeño delay visual para que el usuario vea que se actualizó
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Datos actualizados');
    }, 600);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`gap-2 ${className}`}
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {showLabel && (isRefreshing ? 'Actualizando...' : label)}
    </Button>
  );
}