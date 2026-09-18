import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      const user = {
        ...data.user,
        presellerMapped: data.user.presellerMapped ?? data.user.id_gvari != null,
      };
      setAuth(user, data.token);
      navigate(user.role === 'sales_rep' ? '/customers' : user.role === 'supervisor' ? '/routes' : '/');
    },
  });
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth();
      navigate('/login');
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getUser,
    retry: false,
  });
}
