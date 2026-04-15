import apiClient from './client';
import type { User, LoginCredentials } from '@/types';

export const authApi = {
  login: async (credentials: LoginCredentials) => {
    const { data } = await apiClient.post<{ success: boolean; data: { user: User; token: string } }>('/auth/login', credentials);
    return data.data;
  },
  logout: async () => {
    await apiClient.post('/auth/logout');
  },
  getUser: async () => {
    const { data } = await apiClient.get<{ success: boolean; data: User }>('/auth/user');
    return data.data;
  },
};
