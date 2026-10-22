import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoginPath } from '@/lib/brand';

const AdminRoute = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to={getLoginPath()} replace />;
  if (user.role !== 'admin') return <Navigate to="/cases" replace />;
  return <Outlet />;
};

export default AdminRoute;
