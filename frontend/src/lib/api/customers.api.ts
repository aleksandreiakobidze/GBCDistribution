import apiClient from './client';
import type { Customer } from '@/types';

export const customersApi = {
  getAll: async (params?: { page?: number; search?: string; per_page?: number }) => {
    const { data: resp } = await apiClient.get('/customers', { params });
    const paginated = resp.data;
    return {
      data: (paginated.data ?? []) as Customer[],
      meta: paginated.meta ?? { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    };
  },
  getById: async (id: number) => {
    const { data: resp } = await apiClient.get(`/customers/${id}`);
    return resp.data as Customer;
  },
  create: async (customer: Partial<Customer>) => {
    const { data: resp } = await apiClient.post('/customers', customer);
    return resp.data as Customer;
  },
  update: async (id: number, customer: Partial<Customer>) => {
    const { data: resp } = await apiClient.put(`/customers/${id}`, customer);
    return resp.data as Customer;
  },
};
