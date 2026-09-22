import axios from 'axios';
import apiClient from './client';
import type {
  ErpCursorPage,
  ErpCustomer,
  ErpItem,
  ErpProductTaxonomyGroup,
  ErpQuote,
  ErpOrderReceipt,
  ErpSubmittedOrder,
  ErpCollection,
  ErpProductReturn,
  ErpSavedOrder,
  ErpPromotion,
} from '@/types';

function unwrap<T>(payload: { data: T }): T {
  return payload.data;
}

/**
 * Binary responses deliver the JSON error envelope as an ArrayBuffer, which the
 * shared error reader cannot inspect. Decode it back into an object in place.
 */
function decodeArrayBufferError(error: unknown): unknown {
  if (!axios.isAxiosError(error) || !(error.response?.data instanceof ArrayBuffer)) {
    return error;
  }
  try {
    error.response.data = JSON.parse(new TextDecoder().decode(error.response.data));
  } catch {
    error.response.data = undefined;
  }
  return error;
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

  customers: async (params?: {
    search?: string;
    cursor?: string;
    limit?: number;
    day?: 'today' | 'all';
    salesUserId?: number;
  }) => {
    const { data } = await apiClient.get('/v1/customers', { params });
    return unwrap(data) as ErpCursorPage<ErpCustomer>;
  },

  customer: async (customerId: string, params?: { salesUserId?: number }) => {
    const { data } = await apiClient.get(`/v1/customers/${encodeURIComponent(customerId)}`, {
      params: params?.salesUserId ? { salesUserId: params.salesUserId } : undefined,
    });
    return unwrap(data) as ErpCustomer;
  },

  teamReps: async () => {
    const { data } = await apiClient.get('/v1/team-reps');
    return unwrap(data) as Array<{ id: number; name: string; presellerId: string }>;
  },

  items: async (params?: {
    customerId?: string;
    search?: string;
    cursor?: string;
    limit?: number;
    prodS?: string;
    prodT?: string;
    prodG?: string;
    category?: string;
  }) => {
    const { data } = await apiClient.get('/v1/items', { params });
    return unwrap(data) as ErpCursorPage<ErpItem>;
  },

  item: async (itemId: string, customerId?: string) => {
    const { data } = await apiClient.get(`/v1/items/${encodeURIComponent(itemId)}`, {
      params: customerId ? { customerId } : undefined,
    });
    return unwrap(data) as ErpItem;
  },

  itemGroups: async () => {
    const { data } = await apiClient.get('/v1/items/groups');
    return unwrap(data) as Array<{ name: string; count: number }>;
  },

  itemTaxonomy: async () => {
    const { data } = await apiClient.get('/v1/items/taxonomy');
    return unwrap(data) as ErpProductTaxonomyGroup[];
  },

  promotions: async (customerId: string) => {
    const { data } = await apiClient.get('/v1/promotions', { params: { customerId } });
    return unwrap(data) as { state: string; items: ErpPromotion[] };
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

  submittedOrders: async () => {
    const { data } = await apiClient.get('/v1/orders');
    return unwrap(data) as ErpSubmittedOrder[];
  },

  savedOrders: async () => {
    const { data } = await apiClient.get('/v1/saved-orders');
    return unwrap(data) as ErpSavedOrder[];
  },

  savedOrder: async (id: number) => {
    const { data } = await apiClient.get(`/v1/saved-orders/${id}`);
    return unwrap(data) as ErpSavedOrder;
  },

  saveOrder: async (payload: {
    customerId: string;
    note?: string;
    lines: Array<{ itemId: string; quantity: string }>;
  }) => {
    const { data } = await apiClient.post('/v1/saved-orders', payload);
    return unwrap(data) as ErpSavedOrder;
  },

  updateSavedOrder: async (
    id: number,
    payload: {
      customerId?: string;
      note?: string;
      lines: Array<{ itemId: string; quantity: string }>;
    },
  ) => {
    const { data } = await apiClient.patch(`/v1/saved-orders/${id}`, payload);
    return unwrap(data) as ErpSavedOrder;
  },

  status: async (erpOrderId: string) => {
    const { data } = await apiClient.get(`/v1/orders/${encodeURIComponent(erpOrderId)}/status`);
    return unwrap(data) as { erpOrderId: string; status: string; message: string };
  },

  collections: async (customerId?: string) => {
    const { data } = await apiClient.get('/v1/collections', {
      params: customerId ? { customerId } : undefined,
    });
    return unwrap(data) as ErpCollection[];
  },

  collection: async (id: number) => {
    const { data } = await apiClient.get(`/v1/collections/${id}`);
    return unwrap(data) as ErpCollection;
  },

  collect: async (payload: { customerId: string; amount: string; method?: string; note?: string }) => {
    const { data } = await apiClient.post('/v1/collections', payload);
    return unwrap(data) as ErpCollection;
  },

  updateCollection: async (
    id: number,
    payload: { amount?: string; method?: string; note?: string },
  ) => {
    const { data } = await apiClient.patch(`/v1/collections/${id}`, payload);
    return unwrap(data) as ErpCollection;
  },

  productReturns: async (customerId?: string) => {
    const { data } = await apiClient.get('/v1/product-returns', {
      params: customerId ? { customerId } : undefined,
    });
    return unwrap(data) as ErpProductReturn[];
  },

  productReturn: async (id: number) => {
    const { data } = await apiClient.get(`/v1/product-returns/${id}`);
    return unwrap(data) as ErpProductReturn;
  },

  createProductReturn: async (payload: {
    customerId: string;
    note?: string;
    lines: Array<{ itemId: string; quantity: string; reason: string }>;
  }) => {
    const { data } = await apiClient.post('/v1/product-returns', payload);
    return unwrap(data) as ErpProductReturn;
  },

  updateProductReturn: async (
    id: number,
    payload: {
      customerId?: string;
      note?: string;
      lines: Array<{ itemId: string; quantity: string; reason: string }>;
    },
  ) => {
    const { data } = await apiClient.patch(`/v1/product-returns/${id}`, payload);
    return unwrap(data) as ErpProductReturn;
  },

  priceList: async () => {
    const { data } = await apiClient.get('/v1/price-list');
    return unwrap(data) as {
      available: boolean;
      filename: string | null;
      sizeBytes: number | null;
      updatedAt: string | null;
    };
  },

  priceListFile: async () => {
    try {
      const { data } = await apiClient.get<ArrayBuffer>('/v1/price-list/file', {
        responseType: 'arraybuffer',
        headers: { Accept: 'application/pdf' },
      });
      return data;
    } catch (error) {
      throw decodeArrayBufferError(error);
    }
  },
};
