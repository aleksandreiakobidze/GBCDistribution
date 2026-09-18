import apiClient from './client';
import type { ReturnOrder } from '@/types';

export const returnsApi = {
  getAll: async (params?: { page?: number }) => {
    const { data: resp } = await apiClient.get('/returns', { params });
    const paginated = resp.data;
    return {
      data: (paginated.data ?? []) as ReturnOrder[],
      meta: paginated.meta ?? { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    };
  },
  create: async (returnData: { order_id: number; reason: string; items: Array<{ product_id: number; quantity: number; unit_price: number; condition: string }> }) => {
    const { data: resp } = await apiClient.post('/returns', returnData);
    return resp.data as ReturnOrder;
  },
  updateStatus: async (id: number, status: string) => {
    const { data: resp } = await apiClient.patch(`/returns/${id}/status`, { status });
    return resp.data as ReturnOrder;
  },
};
