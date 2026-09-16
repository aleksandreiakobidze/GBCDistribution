import apiClient from './client';
import type { ErpCursorPage, ErpCustomer, ErpItem, ErpQuote, ErpOrderReceipt } from '@/types';

function unwrap<T>(payload: { data: T }): T {
  return payload.data;
}

export const erpApi = {
  me: async () => {
    const { data } = await apiClient.get('/v1/me');
    return unwrap(data) as {
      id: number;
      name: string;
      email: string;
      role: string;
      presellerId: string | null;
      presellerMapped: boolean;
      provider: string;
    };
  },

  customers: async (params?: { search?: string; cursor?: string; limit?: number }) => {
    const { data } = await apiClient.get('/v1/customers', { params });
    return unwrap(data) as ErpCursorPage<ErpCustomer>;
  },

  customer: async (customerId: string) => {
    const { data } = await apiClient.get(`/v1/customers/${encodeURIComponent(customerId)}`);
    return unwrap(data) as ErpCustomer;
  },

  items: async (params: { customerId: string; search?: string; cursor?: string; limit?: number }) => {
    const { data } = await apiClient.get('/v1/items', { params });
    return unwrap(data) as ErpCursorPage<ErpItem>;
  },

  item: async (itemId: string, customerId: string) => {
    const { data } = await apiClient.get(`/v1/items/${encodeURIComponent(itemId)}`, {
      params: { customerId },
    });
    return unwrap(data) as ErpItem;
  },

  promotions: async (customerId: string) => {
    const { data } = await apiClient.get('/v1/promotions', { params: { customerId } });
    return unwrap(data) as { state: string; items: Array<{ id: string; name: string; state: string }> };
  },

  quote: async (payload: { customerId: string; lines: Array<{ itemId: string; quantity: string }> }) => {
    const { data } = await apiClient.post('/v1/orders/quote', payload);
    return unwrap(data) as ErpQuote;
  },

  submit: async (payload: {
    externalId: string;
    customerId: string;
    quoteId: string;
    note?: string;
    location?: { latitude: string; longitude: string };
    lines: Array<{ itemId: string; quantity: string }>;
  }) => {
    const { data } = await apiClient.post('/v1/orders', payload);
    return unwrap(data) as ErpOrderReceipt;
  },

  status: async (erpOrderId: string) => {
    const { data } = await apiClient.get(`/v1/orders/${encodeURIComponent(erpOrderId)}/status`);
    return unwrap(data) as { erpOrderId: string; status: string; message: string };
  },
};
