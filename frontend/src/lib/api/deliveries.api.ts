import apiClient from './client';
import type { Delivery } from '@/types';

export const deliveriesApi = {
  getAll: async (params?: { page?: number }) => {
    const { data: resp } = await apiClient.get('/deliveries', { params });
    const paginated = resp.data;
    return {
      data: (paginated.data ?? []) as Delivery[],
      meta: paginated.meta ?? { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    };
  },
  updateStatus: async (id: number, status: string, notes?: string) => {
    const { data: resp } = await apiClient.patch(`/deliveries/${id}/status`, { status, notes });
    return resp.data as Delivery;
  },
  uploadPod: async (id: number, formData: FormData) => {
    const { data: resp } = await apiClient.post(`/deliveries/${id}/pod`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return resp.data as Delivery;
  },
};
