import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api/auth.api';
import { erpApi } from '@/lib/api/erp.api';
import type { User } from '@/types';

function withPreseller(
  user: User,
  me: {
    presellerId: string | null;
    presellerMapped: boolean;
    provider: string;
    fieldRules?: User['fieldRules'];
    menus?: string[];
  },
): User {
  return {
    ...user,
    id_gvari: me.presellerId !== null ? Number(me.presellerId) : null,
    presellerMapped: me.presellerMapped,
    provider: me.provider,
    fieldRules: me.fieldRules,
    menus: me.menus,
  };
}

export function AuthGuard() {
  const { isAuthenticated, clearAuth, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const user = await authApi.getUser();
        if (cancelled) return;
        const current = useAuthStore.getState().user;
        updateUser({
          ...user,
          menus: user.menus ?? current?.menus,
          fieldRules: user.fieldRules ?? current?.fieldRules,
        });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          clearAuth();
          navigateRef.current('/login', { replace: true });
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
  }, [isAuthenticated, clearAuth, updateUser]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
