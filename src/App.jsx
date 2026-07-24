import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';

// Cada página se carga bajo demanda (code-splitting por ruta) en vez de ir
// todas en el bundle inicial — un usuario cliente, por ejemplo, nunca
// descarga el código de las páginas de administración.
const LoginPage              = lazy(() => import('./pages/LoginPage'));
const DashboardPage          = lazy(() => import('./pages/DashboardPage'));
const CasesPage              = lazy(() => import('./pages/CasesPage'));
const ActiveCasesPage        = lazy(() => import('./pages/ActiveCasesPage'));
const CaseDetailPage         = lazy(() => import('./pages/CaseDetailPage'));
const NewCasePage            = lazy(() => import('./pages/NewCasePage'));
const MyTicketsPage          = lazy(() => import('./pages/MyTicketsPage'));
const MyPoliciesPage         = lazy(() => import('./pages/MyPoliciesPage'));
const PolicyDetailPage       = lazy(() => import('./pages/PolicyDetailPage'));
const ConsumptionPage        = lazy(() => import('./pages/ConsumptionPage'));
const UsersPage              = lazy(() => import('./pages/admin/UsersPage'));
const TasksPage              = lazy(() => import('./pages/admin/TasksPage'));
const GeneralConsumptionPage = lazy(() => import('./pages/admin/GeneralConsumptionPage'));

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
                <Route path="/consumption"  element={<ConsumptionPage />} />
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
