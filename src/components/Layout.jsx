import { useState, useEffect } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Ticket, LogOut, Users, ChevronLeft, ChevronRight, ChevronsUpDown, CircleDot, LayoutDashboard, Plus, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStats } from '../api/cases';
import { resolveAccount, resolveContact } from '../api/d365';

const NAV_ITEMS = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Inicio',          roles: ['admin', 'support', 'client'], end: true },
  { to: '/cases/new',    icon: Plus,            label: 'Nuevo Ticket',    roles: ['client'], end: true },
  { to: '/cases/mine',   icon: ListChecks,      label: 'Mis Tickets',     roles: ['client'], end: true },
  { to: '/cases/active', icon: CircleDot,       label: 'Tickets Activos', roles: ['admin', 'support', 'client'] },
  { to: '/cases',        icon: Ticket,          label: 'Tickets',         roles: ['admin', 'support', 'client'], end: true },
  { to: '/admin/users',  icon: Users,           label: 'Usuarios',        roles: ['admin'], end: true },
];

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('gs-sidebar') === '1'
  );
  const [activeCount, setActiveCount] = useState(null);
  const [customerLabel, setCustomerLabel] = useState('');

  useEffect(() => {
    getStats().then((s) => setActiveCount(s.activeCases)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== 'client') return;
    if (user?.d365AccountId) {
      resolveAccount(user.d365AccountId).then((a) => setCustomerLabel(a.name || '')).catch(() => {});
    } else if (user?.d365ContactId) {
      resolveContact(user.d365ContactId).then((c) => setCustomerLabel(c.name || '')).catch(() => {});
    }
  }, [user?.role, user?.d365AccountId, user?.d365ContactId]);

  const toggle = () =>
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('gs-sidebar', next ? '1' : '0');
      return next;
    });

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = (user?.fullName || user?.email || 'U')
    .split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const visibleNav = NAV_ITEMS.filter((i) => i.roles.includes(user?.role));

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Sidebar izquierda ─────────────────────────────────── */}
      <aside
        className="shrink-0 sticky top-0 h-screen flex flex-col overflow-hidden"
        style={{
          width: collapsed ? 56 : 220,
          transition: 'width 280ms cubic-bezier(0.4,0,0.2,1)',
          background: 'linear-gradient(175deg, var(--gs-navy) 0%, oklch(0.19 0.065 258) 100%)',
          boxShadow: '2px 0 24px oklch(0 0 0 / 0.16)',
        }}
      >
        {/* ── Encabezado con isotipo ────────────────── */}
        <div
          className="shrink-0 flex items-center"
          style={{ borderBottom: '1px solid var(--gs-border)', minHeight: 56 }}
        >
          {collapsed ? (
            /* Colapsado: solo isotipo, click expande */
            <button
              onClick={toggle}
              title="Expandir menú"
              className="w-full h-14 flex items-center justify-center transition-colors duration-150 hover:bg-white/[0.07]"
            >
              <img src="/isotipo.png" alt="GS" className="h-9 w-9 object-contain" />
            </button>
          ) : (
            /* Expandido: isotipo + texto + botón toggle */
            <div className="flex items-center w-full pl-3 pr-2 gap-2.5">
              <img src="/isotipo.png" alt="GS" className="h-9 w-9 object-contain shrink-0" />
              <span className="flex-1 text-sm font-semibold text-white whitespace-nowrap tracking-wide">
                Portal de Tickets
              </span>
              <button
                onClick={toggle}
                title="Minimizar menú"
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 text-white/35 hover:text-white hover:bg-white/[0.07]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Navegación ────────────────────────────── */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-hidden">
          <p
            className="text-[9px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap overflow-hidden"
            style={{
              color: 'oklch(1 0 0 / 0.28)',
              padding: collapsed ? '0' : '0 12px 8px',
              maxHeight: collapsed ? 0 : 28,
              opacity: collapsed ? 0 : 1,
              transition: 'opacity 200ms ease, max-height 200ms ease, padding 200ms ease',
            }}
          >
            Menú
          </p>

          {visibleNav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap overflow-hidden',
                  collapsed ? 'w-10 h-10 mx-auto justify-center' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'text-white'
                    : 'gs-nav-inactive'
                )
              }
              style={({ isActive }) => isActive ? { background: 'var(--gs-cyan)' } : {}}
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span>{label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                      )}
                    </>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Footer: conteo de tickets activos ────── */}
        {activeCount !== null && (
          <div
            className="shrink-0 mx-2 mb-2 rounded-lg overflow-hidden"
            style={{
              background: 'oklch(0.68 0.11 208 / 0.14)',
              border: '1px solid oklch(0.68 0.11 208 / 0.22)',
            }}
          >
            {collapsed ? (
              <div
                className="flex flex-col items-center justify-center h-10 gap-0.5"
                title={`${activeCount} tickets activos`}
              >
                <span className="text-xs font-bold leading-none" style={{ color: 'var(--gs-cyan)' }}>
                  {activeCount}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <CircleDot className="h-4 w-4 shrink-0" style={{ color: 'var(--gs-cyan)' }} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white leading-tight">{activeCount}</p>
                  <p className="text-[10px] leading-tight whitespace-nowrap" style={{ color: 'oklch(1 0 0 / 0.45)' }}>
                    tickets activos
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Usuario ───────────────────────────────── */}
        <div
          className="shrink-0 px-2 py-3"
          style={{ borderTop: '1px solid var(--gs-border)' }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title={collapsed ? (user?.fullName || user?.email) : undefined}
                className={cn(
                  'flex items-center rounded-lg transition-colors duration-150 text-white/75 hover:text-white hover:bg-white/[0.07]',
                  collapsed ? 'w-10 h-10 mx-auto justify-center' : 'gap-3 px-3 py-2.5 w-full'
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className="text-xs font-bold"
                    style={{ background: 'var(--gs-cyan)', color: 'white' }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate leading-tight">
                        {user?.fullName || user?.email}
                      </p>
                      <p
                        className="text-[10px] truncate capitalize leading-tight mt-0.5"
                        style={{ color: 'oklch(1 0 0 / 0.40)' }}
                      >
                        {user?.role}
                      </p>
                    </div>
                    <ChevronsUpDown
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: 'oklch(1 0 0 / 0.30)' }}
                    />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side={collapsed ? 'right' : 'top'}
              sideOffset={8}
              className="w-52"
            >
              <div className="px-2 py-2">
                <p className="text-sm font-semibold">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Contenido principal ────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Barra superior con logo */}
        <header
          className="shrink-0 flex items-center justify-end gap-4 px-8 border-b"
          style={{
            height: 56,
            background: 'oklch(1 0 0)',
            boxShadow: '0 1px 4px oklch(0 0 0 / 0.06)',
          }}
        >
          {customerLabel && (
            <span className="text-sm font-semibold text-foreground truncate max-w-[240px]">
              {customerLabel}
            </span>
          )}
          <img
            src="/LOGO%20GS%20Color_240x54.png"
            alt="Grupo Staff"
            className="h-9 w-auto object-contain"
          />
        </header>

        {/* Área de contenido con scroll */}
        <div className="flex-1 min-h-0 overflow-auto px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
