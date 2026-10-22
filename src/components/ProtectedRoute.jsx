import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoginPath } from '@/lib/brand';

const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  // Sin sesión → login de la empresa recordada (/login o /loginst).
  return user ? <Outlet /> : <Navigate to={getLoginPath()} replace />;
};

export default ProtectedRoute;
