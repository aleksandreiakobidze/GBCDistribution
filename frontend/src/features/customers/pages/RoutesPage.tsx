import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { CustomerRouteBoard } from '../components/CustomerRouteBoard';

export default function RoutesPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'sales_rep') {
    return <Navigate to="/customers" replace />;
  }
  return <CustomerRouteBoard teamMode />;
}
