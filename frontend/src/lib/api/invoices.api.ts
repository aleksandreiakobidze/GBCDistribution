import apiClient from './client';
import type { Invoice } from '@/types';

export const invoicesApi = {
  getAll: async (params?: { page?: number; status?: string }) => {
    const { data: resp } = await apiClient.get('/invoices', { params });
    const paginated = resp.data;
    return {
      data: (paginated.data ?? []) as Invoice[],
      meta: paginated.meta ?? { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    };
  },
  getById: async (id: number) => {
    const { data: resp } = await apiClient.get(`/invoices/${id}`);
    return resp.data as Invoice;
  },
  recordPayment: async (id: number, payment: { amount: number; method: string; reference?: string }) => {
    const { data: resp } = await apiClient.post(`/invoices/${id}/payment`, payment);
    return resp.data as Invoice;
  },
};
