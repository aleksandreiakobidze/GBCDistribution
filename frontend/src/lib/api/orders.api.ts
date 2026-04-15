import apiClient from './client';
import type { Order, OrderFormItem } from '@/types';

export const ordersApi = {
  getAll: async (params?: { page?: number; status?: string }) => {
    const { data: resp } = await apiClient.get('/orders', { params });
    const paginated = resp.data;
    return {
      data: (paginated.data ?? []) as Order[],
      meta: paginated.meta ?? { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    };
  },
  getById: async (id: number) => {
    const { data: resp } = await apiClient.get(`/orders/${id}`);
    return resp.data as Order;
  },
  create: async (order: { customer_id: number; warehouse_id: number; notes?: string; offline_id?: string; items: OrderFormItem[] }) => {
    const { data: resp } = await apiClient.post('/orders', order);
    return resp.data as Order;
  },
  updateStatus: async (id: number, status: string) => {
    const { data: resp } = await apiClient.patch(`/orders/${id}/status`, { status });
    return resp.data as Order;
  },
};
