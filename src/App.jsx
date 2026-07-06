import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CasesPage from './pages/CasesPage';
import ActiveCasesPage from './pages/ActiveCasesPage';
import CaseDetailPage from './pages/CaseDetailPage';
import NewCasePage from './pages/NewCasePage';
import MyTicketsPage from './pages/MyTicketsPage';
import MyPoliciesPage from './pages/MyPoliciesPage';
import PolicyDetailPage from './pages/PolicyDetailPage';
import ConsumptionPage from './pages/ConsumptionPage';
import UsersPage from './pages/admin/UsersPage';
import TasksPage from './pages/admin/TasksPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
