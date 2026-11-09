import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import AdminLayout from './components/AdminLayout';
import Kiosk from './pages/Kiosk';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Employees from './pages/Employees';
import EmployeeForm from './pages/EmployeeForm';
import EmployeeProfile from './pages/EmployeeProfile';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid h-screen place-items-center text-sm text-clay">Loading…</div>;
  return user ? children : <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Kiosk />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<Protected><AdminLayout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/new" element={<EmployeeForm />} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="employees/:id/edit" element={<EmployeeForm />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
