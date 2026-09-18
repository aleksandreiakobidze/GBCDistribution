import apiClient from './client';

export const syncApi = {
  pushOrders: async (orders: Array<Record<string, unknown>>) => {
    const { data } = await apiClient.post('/sync/orders', { orders });
    return data.data;
  },
  pull: async () => {
    const { data } = await apiClient.get('/sync/pull');
    return data.data;
  },
};
