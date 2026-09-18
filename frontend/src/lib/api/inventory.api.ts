import apiClient from './client';
import type { InventoryItem, StockMovement } from '@/types';

export const inventoryApi = {
  getAll: async (params?: { page?: number; warehouse_id?: number }) => {
    const { data: resp } = await apiClient.get('/inventory', { params });
    const paginated = resp.data;
    return {
      data: (paginated.data ?? []) as InventoryItem[],
      meta: paginated.meta ?? { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    };
  },
  adjust: async (adjustment: { warehouse_id: number; product_id: number; quantity: number; notes?: string }) => {
    const { data: resp } = await apiClient.post('/inventory/adjust', adjustment);
    return resp.data;
  },
  getMovements: async (params?: { page?: number }) => {
    const { data: resp } = await apiClient.get('/inventory/movements', { params });
    const paginated = resp.data;
    return {
      data: (paginated.data ?? []) as StockMovement[],
      meta: paginated.meta ?? { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    };
  },
};
