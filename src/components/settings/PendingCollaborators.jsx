import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Clock,
  UserCheck,
  UserX,
  Store
} from "lucide-react";
import { motion } from "framer-motion";

export default function PendingCollaborators({ pendingUsers, restaurants }) {
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      queryClient.invalidateQueries({ queryKey: ['pendingCollaborators'] });
    }
  });

  const handleApprove = (userId) => {
    updateUserMutation.mutate({ userId, data: { is_approved: true } });
  };

  const handleReject = (userId) => {
    updateUserMutation.mutate({ userId, data: { is_approved: false } });
  };

  const getRestaurantNames = (restaurantIds) => {
    if (!restaurantIds?.length) return [];
    return restaurantIds.map(id => {
      const r = restaurants.find(rest => rest.id === id);
      return r?.name || id;
    });
  };

  if (pendingUsers.length === 0) {
    return (
      <Card className="bg-white border-0 shadow-lg">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">No hay colaboradores pendientes de aprobación</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader className="bg-amber-50 border-b border-amber-100">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          Colaboradores Pendientes
          <Badge className="ml-2 bg-amber-100 text-amber-700">
            {pendingUsers.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Colaboradores que usaron un código de invitación y esperan aprobación
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {pendingUsers.map((u, index) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 border border-amber-100 bg-amber-50/50 rounded-xl"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {u.profile_photo ? (
                    <img 
                      src={u.profile_photo} 
                      alt={u.display_name || u.full_name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-amber-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{u.display_name || u.full_name}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    {u.phone && (
                      <p className="text-xs text-gray-400">{u.phone}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleReject(u.id)}
                    disabled={updateUserMutation.isPending}
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleApprove(u.id)}
                    disabled={updateUserMutation.isPending}
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    Aprobar
                  </Button>
                </div>
              </div>
              
              {/* Restaurantes asignados */}
              {u.restaurant_ids?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500">Restaurantes:</span>
                  {getRestaurantNames(u.restaurant_ids).map((name, i) => (
                    <Badge key={i} variant="secondary" className="bg-white text-xs">
                      <Store className="w-3 h-3 mr-1" />
                      {name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Secciones permitidas */}
              {u.allowed_sections?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-xs text-gray-500">Secciones:</span>
                  {u.allowed_sections.map((section, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {section}
                    </Badge>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}