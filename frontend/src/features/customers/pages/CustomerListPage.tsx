import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { CustomerRouteBoard } from '../components/CustomerRouteBoard';

export default function CustomerListPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'supervisor' || role === 'manager') {
    return <Navigate to="/routes" replace />;
  }
  return <CustomerRouteBoard />;
}
