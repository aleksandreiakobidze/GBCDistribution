import apiClient from './client';
import type { SalesReport } from '@/types';

export const reportsApi = {
  sales: async (params?: { date_from?: string; date_to?: string }) => {
    const { data: resp } = await apiClient.get('/reports/sales', { params });
    return resp.data as SalesReport;
  },
  inventory: async () => {
    const { data: resp } = await apiClient.get('/reports/inventory');
    return resp.data;
  },
  performance: async (params?: { date_from?: string; date_to?: string }) => {
    const { data: resp } = await apiClient.get('/reports/performance', { params });
    return resp.data;
  },
};
