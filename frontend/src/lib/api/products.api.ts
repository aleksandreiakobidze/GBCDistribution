import apiClient from './client';
import type { Product, Category } from '@/types';

export const productsApi = {
  getAll: async (params?: { page?: number; category_id?: number; search?: string }) => {
    const { data: resp } = await apiClient.get('/products', { params });
    const paginated = resp.data;
    return {
      data: (paginated.data ?? []) as Product[],
      meta: paginated.meta ?? { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    };
  },
  getById: async (id: number) => {
    const { data: resp } = await apiClient.get(`/products/${id}`);
    return resp.data as Product;
  },
  getCategories: async () => {
    const { data: resp } = await apiClient.get('/categories');
    return resp.data as Category[];
  },
};
