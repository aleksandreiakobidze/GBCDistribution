import { useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api/auth.api';
import { erpApi } from '@/lib/api/erp.api';
import type { User } from '@/types';

function withPreseller(user: User, me: { presellerId: string | null; presellerMapped: boolean; provider: string }): User {
  return {
    ...user,
    id_gvari: me.presellerId !== null ? Number(me.presellerId) : null,
    presellerMapped: me.presellerMapped,
    provider: me.provider,
  };
}

export function AuthGuard() {
  const { isAuthenticated, clearAuth, updateUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const user = await authApi.getUser();
        if (cancelled) return;
        updateUser(user);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          clearAuth();
          navigate('/login', { replace: true });
        }
        return;
      }

      try {
        const me = await erpApi.me();
        if (cancelled) return;
        const current = useAuthStore.getState().user;
        if (current) {
          updateUser(withPreseller(current, me));
        }
      } catch {
        // /v1/me is not required to keep the session; 403 must not log out.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, clearAuth, navigate, updateUser]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
