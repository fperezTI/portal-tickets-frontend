import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';

// Cada página se carga bajo demanda (code-splitting por ruta) en vez de ir
// todas en el bundle inicial — un usuario cliente, por ejemplo, nunca
// descarga el código de las páginas de administración.
const LoginPage              = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage     = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage      = lazy(() => import('./pages/ResetPasswordPage'));
const DashboardPage          = lazy(() => import('./pages/DashboardPage'));
const CasesPage              = lazy(() => import('./pages/CasesPage'));
const ActiveCasesPage        = lazy(() => import('./pages/ActiveCasesPage'));
const CaseDetailPage         = lazy(() => import('./pages/CaseDetailPage'));
const NewCasePage            = lazy(() => import('./pages/NewCasePage'));
const MyTicketsPage          = lazy(() => import('./pages/MyTicketsPage'));
const MyPoliciesPage         = lazy(() => import('./pages/MyPoliciesPage'));
const PolicyDetailPage       = lazy(() => import('./pages/PolicyDetailPage'));
const SupportReportPage      = lazy(() => import('./pages/SupportReportPage'));
const UsersPage              = lazy(() => import('./pages/admin/UsersPage'));
const TasksPage              = lazy(() => import('./pages/admin/TasksPage'));
const GeneralConsumptionPage = lazy(() => import('./pages/admin/GeneralConsumptionPage'));

// Link base de Satustec (2026-11-23): https://www.onehubdesk.com/satustec
// (local http://localhost:5173/satustec). Funciona como la página base "/":
// con sesión → /dashboard; sin sesión → login de Satustec (/loginst), en vez
// del login de la empresa recordada. No es un login: /loginst sigue igual.
const SatustecEntry = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={user ? '/dashboard' : '/loginst'} replace />;
};

// /support-report fue la ruta original del reporte; redirige a /consumption
// conservando los filtros de la URL (?client=&year=) para no romper enlaces.
const SupportReportRedirect = () => {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/consumption', search }} replace />;
};

const RouteLoading = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Login de Satustec (2026-10-10): mismo login con colores de Satustec, siempre en inglés. */}
            <Route path="/loginst" element={<LoginPage brand="satustec" />} />
            {/* Link base de Satustec (2026-11-23): equivale a "/" pero con el login de Satustec. */}
            <Route path="/satustec" element={<SatustecEntry />} />
            {/* "¿Olvidaste tu contraseña?" (2026-11-23): públicas. /reset-password es el link del correo. */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"    element={<DashboardPage />} />
                <Route path="/cases/active" element={<ActiveCasesPage />} />
                <Route path="/cases"        element={<CasesPage />} />
                <Route path="/cases/new"    element={<NewCasePage />} />
                <Route path="/cases/mine"   element={<MyTicketsPage />} />
                <Route path="/policies/mine" element={<MyPoliciesPage />} />
                <Route path="/policies/:id"  element={<PolicyDetailPage />} />
                {/* "Consumo" = Reporte de soporte (2026-10-06, reemplazó a la ConsumptionPage anterior). */}
                <Route path="/consumption"  element={<SupportReportPage />} />
                <Route path="/support-report" element={<SupportReportRedirect />} />
                <Route path="/cases/:id"    element={<CaseDetailPage />} />

                {/* Rutas de administración */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/tasks" element={<TasksPage />} />
                  <Route path="/admin/general-consumption" element={<GeneralConsumptionPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
