import { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoginPath } from '@/lib/brand';

const ForcePasswordChangePage = lazy(() => import('../pages/ForcePasswordChangePage'));

const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  // Sin sesión → login de la empresa recordada (/login o /loginst).
  if (!user) return <Navigate to={getLoginPath()} replace />;
  // Cambio de contraseña obligatorio pendiente (2026-11-23): en lugar del
  // portal, la pantalla para cambiarla (el backend además bloquea la API).
  if (user.mustChangePassword) return <ForcePasswordChangePage />;
  return <Outlet />;
};

export default ProtectedRoute;
