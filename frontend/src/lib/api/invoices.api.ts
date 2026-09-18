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
  update: async (id: number, payload: { amount?: number; due_date?: string; status?: string; invoice_number?: string }) => {
    const { data: resp } = await apiClient.patch(`/invoices/${id}`, payload);
    return resp.data as Invoice;
  },
  recordPayment: async (id: number, payment: { amount: number; method: string; reference?: string }) => {
    const { data: resp } = await apiClient.post(`/invoices/${id}/payment`, payment);
    return resp.data as Invoice;
  },
};
