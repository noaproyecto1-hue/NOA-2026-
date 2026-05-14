import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Users,
  CreditCard,
  Settings,
  BarChart3,
  Database,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Bell,
  Home,
  UserCircle
} from "lucide-react";

const navItems = [
  { 
    name: 'Gestión de Usuarios', 
    page: 'SuperadminDashboard', 
    icon: Users,
    description: 'Aprobar y gestionar'
  },
];

const NOA_LOGO_LIGHT = "/images/noa-landing-logo.png";

export default function SuperadminLayout({ children, currentPage }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsersCount'],
    queryFn: async () => {
      const users = await base44.entities.User.filter({ app_role: 'manager' });
      return users.filter(u => u.onboarding_completed && !u.is_approved);
    }
  });

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-zinc-100">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-800 shadow-md px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white hover:bg-white/10"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <img 
              src={NOA_LOGO_LIGHT}
              alt="NOA"
              className="h-14 w-auto object-contain"
            />
          </div>
          
          <div className="relative">
            <Bell className="w-5 h-5 text-white/70" />
            {pendingUsers.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                {pendingUsers.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40 h-full w-72 
        bg-white shadow-xl border-r border-slate-200
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo NOA */}
          <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
            <div className="flex items-center justify-center">
              <img 
                src={NOA_LOGO_LIGHT}
                alt="NOA - Neural Operations Assistant"
                className="h-20 w-auto object-contain"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <p className="px-3 mb-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
              Menú Principal
            </p>
            
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = !item.disabled;
              const isDisabled = item.disabled;

              const isCurrentPage = currentPage === item.page;

              const Wrapper = isDisabled ? 'div' : Link;
              const wrapperProps = isDisabled ? {} : { to: createPageUrl(item.page), onClick: () => setSidebarOpen(false) };

              return (
                <Wrapper
                  key={item.name}
                  {...wrapperProps}
                  className={`
                    group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative no-underline
                    ${isCurrentPage && !isDisabled
                      ? 'bg-indigo-50 border border-indigo-200' 
                      : isDisabled 
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-slate-50 cursor-pointer'
                    }
                  `}
                >
                  <div className={`p-2 rounded-lg ${isCurrentPage && !isDisabled ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                    <Icon className={`w-5 h-5 ${isCurrentPage && !isDisabled ? 'text-indigo-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${isCurrentPage && !isDisabled ? 'text-indigo-700' : 'text-slate-600'}`}>
                      {item.name}
                    </span>
                    <p className="text-xs text-slate-400">{item.description}</p>
                  </div>
                  {item.name === 'Gestión de Usuarios' && pendingUsers.length > 0 && (
                    <Badge className="bg-red-500 text-white text-xs">
                      {pendingUsers.length}
                    </Badge>
                  )}
                  {isDisabled && (
                    <Badge variant="outline" className="text-slate-400 border-slate-300 text-xs">
                      Próximo
                    </Badge>
                  )}
                  {isCurrentPage && !isDisabled && (
                    <ChevronRight className="w-4 h-4 text-indigo-500" />
                  )}
                </Wrapper>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-slate-100">
            <Link
              to={createPageUrl('SuperadminProfile')}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 mb-4 px-3 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
            >
              {user?.profile_photo ? (
                <img 
                  src={user.profile_photo} 
                  alt={user.full_name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 group-hover:border-indigo-300 transition-colors"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">
                  {user?.display_name || user?.full_name || 'Superadmin'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </Link>
            <Button 
              variant="outline" 
              className="w-full justify-start text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}