import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  BarChart3,
  FileBarChart,
  Bell,
  ClipboardList,
  Store,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
  User,
  Package,
  ChefHat,
  Star,
  UserCircle,
  Shield,
  Bot,
  Search,
  Wallet,
  FileBarChart2,
  ShoppingCart,
  Receipt } from
"lucide-react";
import CopilotButton from '@/components/copilot/CopilotButton';
import CopilotChat from '@/components/copilot/CopilotChat';
import CopilotTipBubble from '@/components/copilot/CopilotTipBubble';


const navSections = [
{
  title: 'Principal',
  items: [
  { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard }
  // NOA Copilot ahora es el botón flotante (carita IA) abajo a la derecha.
  ]
},
{
  title: 'Operaciones',
  items: [
  { name: 'Ventas', page: 'PanelVentas', icon: BarChart3, ownerOnly: true },
  { name: 'Compras', page: 'Compras', icon: ShoppingCart, ownerOnly: true },
  { name: 'Inventario', page: 'Inventory', icon: Package },
  { name: 'Cocina', page: 'Recipes', icon: ChefHat }]

},
{
  title: 'Finanzas',
  items: [
  { name: 'Estado de Resultado', page: 'Dashboard', query: 'tab=incomeStatement', icon: FileBarChart2, ownerOnly: true },
  { name: 'Flujo de Caja', page: 'Dashboard', query: 'tab=cashflow', icon: Wallet, ownerOnly: true },
  { name: 'Costos Operacionales', page: 'CostosOperacionales', icon: Wallet, ownerOnly: true },
  { name: 'SII (Impuestos mensuales)', page: 'SII', icon: Receipt, ownerOnly: true }]

},
{
  title: 'RRHH',
  items: [
  { name: 'Team / RRHH', page: 'Empleados', icon: UserCircle },
  { name: 'Clientes', page: 'Clientes', icon: User }]

},
{
  title: 'Usuario',
  items: [
  { name: 'Restaurantes', page: 'Restaurants', icon: Store },
  { name: 'Mi Perfil', page: 'MyProfile', icon: UserCircle },
  { name: 'Ajustes', page: 'Settings', icon: Settings, adminOnly: true }]

}];


// Colores corporativos NOA (BrandBook v1.1 · 2026)
// Naranja firma + navy dominante. Solo UN elemento naranja por pantalla.
const BRAND_PRIMARY = '#F59E0B';     // naranja firma — acentos / activo
const BRAND_SECONDARY = '#0C1B33';   // navy dominante

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const navigate = useNavigate();

  // Bloquear scroll del body cuando sidebar está abierto en móvil
  React.useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {document.body.style.overflow = '';};
  }, [sidebarOpen]);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 2,
    retryDelay: 1000
  });

  // Obtener restaurantes del usuario actual - respeta restaurant_ids si existen
  const { data: myRestaurants = [] } = useQuery({
    queryKey: ['myRestaurants', user?.email, user?.restaurant_ids],
    queryFn: async () => {
      // Si el usuario tiene restaurant_ids asignados, usar SOLO esos
      if (user?.restaurant_ids?.length > 0) {
        const allActive = await base44.entities.Restaurant.filter({ is_active: true });
        return allActive.filter((r) => user.restaurant_ids.includes(r.id));
      }
      // Si no, buscar por created_by (propietario)
      return base44.entities.Restaurant.filter({ is_active: true, created_by: user?.email });
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000
  });

  const myRestaurantIds = myRestaurants.map((r) => r.id);

  // Alertas: usar solo las que ya vienen del Dashboard (vía queryClient cache)
  // para evitar llamadas redundantes que causan rate limiting
  const { data: alerts = [] } = useQuery({
    queryKey: ['myPendingAlerts', myRestaurantIds],
    queryFn: async () => {
      if (myRestaurantIds.length === 0) return [];
      const allAlerts = await base44.entities.Alert.filter({ is_resolved: false });
      return allAlerts.filter((a) => myRestaurantIds.includes(a.restaurant_id));
    },
    enabled: myRestaurantIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min para no refrescar tan seguido
    refetchInterval: 5 * 60 * 1000, // cada 5 min en vez de 1 min
    retry: 1,
    retryDelay: 2000
  });

  // Solo contar alertas no leídas (resolved alerts are now deleted, not kept)
  const unreadAlertsCount = alerts.filter((a) => !a.is_read).length;
  const criticalAlertsCount = alerts.filter((a) => (a.severity === 'critical' || a.severity === 'red') && !a.is_read).length;
  const isManager = user?.role === 'admin' || user?.app_role === 'manager';
  const isStaff = user?.app_role === 'staff';
  const isSuperadmin = user?.role === 'admin';
  const allowedSections = user?.allowed_sections || [];

  const filteredNavSections = navSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      // Admins ven todo excepto items marcados adminOnly si no son admin
      if (item.adminOnly && !isManager) return false;

      // Items ownerOnly solo visibles para propietarios/managers (no staff)
      if (item.ownerOnly && isStaff) return false;

      // Staff (colaborador): solo ve secciones permitidas + su perfil
      if (isStaff) {
        if (item.page === 'MyProfile') return true;
        return allowedSections.includes(item.page);
      }

      return true;
    })
  })).filter((section) => section.items.length > 0);

  const handleLogout = () => {
    base44.auth.logout(createPageUrl('Landing'));
  };

  const primaryColor = BRAND_PRIMARY;
  const secondaryColor = BRAND_SECONDARY;

  // Redirecciones basadas en estado del usuario (via useEffect para no romper React)
  useEffect(() => {
    if (!user) return;

    if (currentPageName === 'Landing') {
      if (isSuperadmin) {
        navigate(createPageUrl('SuperadminDashboard'));
      } else if (!user.onboarding_completed) {
        navigate(createPageUrl('Onboarding'));
      } else if (!user.is_approved) {
        navigate(createPageUrl('PendingApproval'));
      } else {
        navigate(createPageUrl('Dashboard'));
      }
      return;
    }

    // Páginas sin restricción
    if (currentPageName === 'Onboarding' || currentPageName === 'PendingApproval') return;

    // Verificar estado de aprobación para usuarios no-admin
    if (user.role !== 'admin') {
      if (!user.onboarding_completed) {
        navigate(createPageUrl('Onboarding'));
        return;
      }
      if (!user.is_approved) {
        navigate(createPageUrl('PendingApproval'));
        return;
      }
    }

    // Superadmin solo puede ver sus páginas
    if (isSuperadmin && currentPageName !== 'SuperadminDashboard' && currentPageName !== 'SuperadminProfile') {
      navigate(createPageUrl('SuperadminDashboard'));
    }
  }, [currentPageName, user, isSuperadmin, navigate]);

  // Páginas públicas sin layout
  if (currentPageName === 'Landing') {
    if (user) return null; // se redirige via useEffect
    return children;
  }

  // Página de Onboarding sin layout - siempre permitir acceso
  if (currentPageName === 'Onboarding') {
    return children;
  }

  // Página de Pendiente de Aprobación sin layout - siempre permitir acceso
  if (currentPageName === 'PendingApproval') {
    return children;
  }

  // Si el usuario no está cargado aún, mostrar contenido sin layout
  if (!user) {
    return children;
  }

  // Si es superadmin, mostrar solo el contenido sin el layout de gerentes
  if (isSuperadmin) {
    if (currentPageName === 'SuperadminDashboard' || currentPageName === 'SuperadminProfile') {
      return children;
    }
    return null;
  }

  // Si el usuario no está aprobado o no completó onboarding, no mostrar layout
  if (user.role !== 'admin' && (!user.onboarding_completed || !user.is_approved)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100" translate="no">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-white/10 text-white">
            
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <img
            src="/images/noa-logo.png"
            alt="NOA"
            className="h-14 w-auto object-contain" />
          
          <div className="w-9" /> {/* Spacer para centrar el logo */}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen &&
      <div
        className="lg:hidden fixed inset-0 bg-black/50 z-[60]"
        onClick={() => setSidebarOpen(false)} />

      }

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-[60] h-full w-72 bg-white border-r border-slate-200 shadow-xl
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo - NOA */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-8 shadow-md">
            <div className="flex items-center justify-center">
              <img
                src="/images/noa-logo.png"
                alt="NOA - Copiloto de Administración Gastronómica"
                className="h-28 w-auto object-contain drop-shadow-lg" />
            </div>
          </div>

          {/* Navigation - Modernizado */}
          <nav className="flex-1 px-4 pt-4 pb-5 space-y-6 overflow-y-auto custom-scrollbar">
            {filteredNavSections.map((section) =>
            <div key={section.title}>
                <p className="px-4 mb-3 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {section.title}
                </p>
                <div className="space-y-1.5">
                  {section.items.map((item) => {
                  const isActive = currentPageName === item.page;
                  const Icon = item.icon;
                  const hasAlerts = item.page === 'Alerts' && unreadAlertsCount > 0;
                  const hasCriticalAlerts = item.page === 'Alerts' && criticalAlertsCount > 0;

                  return (
                    <Link
                      key={item.name}
                      to={createPageUrl(item.page) + (item.query ? `?${item.query}` : '')}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                          group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative
                          ${isActive ?
                      'font-semibold shadow-lg' :
                      'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'}
                        `
                      }
                      style={isActive ? {
                        background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)`,
                        borderLeft: `3px solid ${primaryColor}`,
                        color: primaryColor
                      } : {}}>
                      
                        <div className={`p-2 rounded-lg transition-all ${isActive ? 'shadow-sm' : 'group-hover:bg-white'}`}
                      style={isActive ? { backgroundColor: `${primaryColor}20` } : {}}>
                        
                          <Icon className="w-5 h-5" style={isActive ? { color: primaryColor } : {}} />
                        </div>
                        <span className="text-sm flex-1">{item.name}</span>
                        {hasAlerts && unreadAlertsCount > 0 && !isActive &&
                      <Badge className={`${hasCriticalAlerts ? 'bg-red-500 animate-pulse' : 'bg-blue-500'} text-white text-xs px-2 shadow-lg`}>
                            {unreadAlertsCount}
                          </Badge>
                      }
                        {isActive &&
                      <ChevronRight className="w-4 h-4" style={{ color: primaryColor }} />
                      }
                      </Link>);

                })}
                </div>
              </div>
            )}
          </nav>

          <style dangerouslySetInnerHTML={{ __html: `
            .custom-scrollbar::-webkit-scrollbar {
              width: 8px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
              border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%);
              border-radius: 10px;
              border: 2px solid #f1f5f9;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
            }
          ` }} />

          {/* User Section - Mejorado */}
          <div className="p-5 border-t border-gray-100 bg-gradient-to-r from-white to-gray-50/50">
            <Link
              to={createPageUrl('MyProfile')}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 mb-4 px-3 py-3 rounded-xl hover:bg-white transition-all duration-200 hover:shadow-md group">
              
              {user?.profile_photo ?
              <img
                src={user.profile_photo}
                alt={user.full_name}
                className="w-11 h-11 rounded-full object-cover border-2 border-gray-100 shadow-md group-hover:border-blue-200 transition-colors" /> :


              <div className="w-11 h-11 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center shadow-md">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">
                      {user?.display_name || user?.full_name || 'Usuario'}
                    </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </Link>
            <Button
              variant="outline"
              className="w-full justify-start text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              onClick={handleLogout}>
              
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen pt-16 lg:pt-0">
        {/* Barra de búsqueda global (desktop) */}
        <div className="hidden lg:flex sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-3 justify-center">
          <GlobalSearch />
        </div>
        {children}
      </main>

      {/* Copilot Floating Button, Tip Bubble & Chat - Solo propietarios/managers, no staff */}
      {currentPageName !== 'Copilot' && !isStaff &&
      <>
          <CopilotTipBubble isOpen={copilotOpen} onOpenChat={() => setCopilotOpen(true)} />
          <CopilotButton isOpen={copilotOpen} onClick={() => setCopilotOpen(!copilotOpen)} />
          <CopilotChat isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} />
        </>
      }
    </div>);

}

// ───────── Barra de búsqueda global ─────────
function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), staleTime: 5 * 60 * 1000 });

  // Indexa insumos, proveedores y recetas para búsqueda en vivo.
  const { data: index = { items: [], suppliers: [], recipes: [] } } = useQuery({
    queryKey: ['global-search-index', user?.restaurant_ids],
    queryFn: async () => {
      const rid = user?.restaurant_ids?.[0];
      const [costs, recipes] = await Promise.all([
        rid ? base44.entities.SupplyCost.filter({ restaurant_id: rid }) : base44.entities.SupplyCost.list(),
        rid ? base44.entities.Recipe.filter({ restaurant_id: rid }) : base44.entities.Recipe.list(),
      ]);
      const items = new Set(), suppliers = new Set();
      for (const c of costs || []) {
        const n = c.supply_item_name || c.supply_name; if (n) items.add(n);
        if (c.supplier) suppliers.add(c.supplier);
      }
      return { items: [...items], suppliers: [...suppliers], recipes: (recipes || []).map((r) => r.name).filter(Boolean) };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const results = React.useMemo(() => {
    if (!q.trim()) return [];
    const term = q.toLowerCase();
    const out = [];
    for (const n of index.items) if (n.toLowerCase().includes(term)) out.push({ type: 'Insumo', label: n, page: 'Productos' });
    for (const n of index.suppliers) if (n.toLowerCase().includes(term)) out.push({ type: 'Proveedor', label: n, page: 'Productos' });
    for (const n of index.recipes) if (n.toLowerCase().includes(term)) out.push({ type: 'Elaborado', label: n, page: 'Productos' });
    return out.slice(0, 8);
  }, [q, index]);

  function go(page) { setOpen(false); setQ(''); navigate(createPageUrl(page)); }

  return (
    <div className="relative w-full max-w-xl">
      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter') go('Productos'); }}
        placeholder="Buscar insumos, proveedores, elaborados…"
        className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-noa-orange/40 focus:bg-white font-sans"
      />
      {open && q.trim() && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">Sin resultados para "{q}"</div>
          ) : results.map((r, i) => (
            <button key={i} onMouseDown={() => go(r.page)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left">
              <span className="text-sm text-gray-800">{r.label}</span>
              <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}