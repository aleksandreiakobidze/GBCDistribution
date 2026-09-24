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
  ErpVisit,
  ErpVisitPhoto,
  ErpGalleryPhoto,
  ErpTask,
  ErpVisitSurvey,
  ErpVisitCoaching,
  ErpShelfAudit,
  ErpPlanogramLine,
  ErpPromoPlan,
  ErpDayReport,
  ErpFieldDashboard,
  PresellerReport,
  ErpProductReturn,
  ErpSavedOrder,
  ErpPromotion,
} from '@/types';

function unwrap<T>(payload: { data: T }): T {
  return payload.data;
}

function filenameFromDisposition(header: string | undefined, fallback: string): string {
  const star = header?.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return fallback;
    }
  }
  return fallback;
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
    salesUserId?: number;
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

  visits: async (params?: { customerId?: string; day?: 'today'; salesUserId?: number }) => {
    const { data } = await apiClient.get('/v1/visits', { params });
    return unwrap(data) as ErpVisit[];
  },

  startVisit: async (payload: { customerId: string; latitude?: string; longitude?: string }) => {
    const { data } = await apiClient.post('/v1/visits', payload);
    return unwrap(data) as ErpVisit;
  },

  finishVisit: async (
    id: number,
    payload: { outcome: 'arrived' | 'missed'; latitude?: string; longitude?: string },
  ) => {
    const { data } = await apiClient.patch(`/v1/visits/${id}`, payload);
    return unwrap(data) as ErpVisit;
  },

  visitPhotos: async (customerId: string, salesUserId?: number) => {
    const { data } = await apiClient.get('/v1/visit-photos', {
      params: { customerId, salesUserId },
    });
    return unwrap(data) as ErpVisitPhoto[];
  },

  uploadVisitPhoto: async (payload: {
    customerId: string;
    phase: 'before' | 'end' | 'survey' | 'shelf';
    photo: File;
    comment?: string;
    tags?: string;
    latitude?: string;
    longitude?: string;
  }) => {
    const form = new FormData();
    form.append('customerId', payload.customerId);
    form.append('phase', payload.phase);
    form.append('photo', payload.photo);
    if (payload.comment) form.append('comment', payload.comment);
    if (payload.tags) form.append('tags', payload.tags);
    if (payload.latitude) form.append('latitude', payload.latitude);
    if (payload.longitude) form.append('longitude', payload.longitude);
    const { data } = await apiClient.post('/v1/visit-photos', form, {
      headers: { 'Content-Type': false },
    });
    return unwrap(data) as ErpVisitPhoto;
  },

  visitPhotoBlob: async (id: number) => {
    const { data } = await apiClient.get(`/v1/visit-photos/${id}/file`, { responseType: 'blob' });
    return data as Blob;
  },

  galleryPhotos: async (params: {
    salesUserId?: number | number[];
    customer?: string;
    day?: string;
    tag?: string | string[];
    rating?: number | number[];
    phase?: string | string[];
    reviewed?: '0' | '1';
    q?: string;
  }) => {
    const { data } = await apiClient.get('/v1/gallery/photos', { params });
    return unwrap(data) as ErpGalleryPhoto[];
  },

  updateGalleryPhoto: async (
    id: number,
    payload: {
      signature: string;
      reviewComment: string;
      rating: number | null;
      rotation: number;
      reviewed: boolean;
    },
  ) => {
    const { data } = await apiClient.patch(`/v1/gallery/photos/${id}`, payload);
    return unwrap(data) as ErpGalleryPhoto;
  },

  galleryPhotoBlob: async (id: number) => {
    const { data } = await apiClient.get(`/v1/gallery/photos/${id}/file`, { responseType: 'blob' });
    return data as Blob;
  },

  downloadGalleryPhotos: async (ids: number[]) => {
    const response = await apiClient.post('/v1/gallery/photos/download', { ids }, { responseType: 'blob' });
    const header = response.headers['content-disposition'];
    return {
      blob: response.data as Blob,
      filename: filenameFromDisposition(typeof header === 'string' ? header : undefined, ids.length === 1 ? 'photo.jpg' : 'visit-photos.zip'),
    };
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

  tasks: async (params?: { customerId?: string; status?: string | string[]; salesUserId?: number[] }) => {
    const { data } = await apiClient.get('/v1/tasks', { params });
    return unwrap(data) as ErpTask[];
  },

  createTask: async (payload: {
    salesUserId: number;
    customerId?: string;
    photoId?: number;
    title: string;
    note?: string;
    dueOn?: string;
  }) => {
    const { data } = await apiClient.post('/v1/tasks', payload);
    return unwrap(data) as ErpTask;
  },

  updateTask: async (id: number, action: 'complete' | 'check') => {
    const { data } = await apiClient.patch(`/v1/tasks/${id}`, { action });
    return unwrap(data) as ErpTask;
  },

  visitSurveys: async (customerId?: string) => {
    const { data } = await apiClient.get('/v1/visit-surveys', {
      params: customerId ? { customerId } : undefined,
    });
    return unwrap(data) as ErpVisitSurvey[];
  },

  saveVisitSurvey: async (payload: {
    visitId: number;
    shelfStocked: boolean;
    priceVisible: boolean;
    promoPresent: boolean;
    competitorSeen: boolean;
  }) => {
    const { data } = await apiClient.post('/v1/visit-surveys', payload);
    return unwrap(data) as ErpVisitSurvey;
  },

  visitCoaching: async (customerId?: string) => {
    const { data } = await apiClient.get('/v1/visit-coaching', {
      params: customerId ? { customerId } : undefined,
    });
    return unwrap(data) as ErpVisitCoaching[];
  },

  saveVisitCoaching: async (payload: { visitId: number; rating: number; note?: string }) => {
    const { data } = await apiClient.post('/v1/visit-coaching', payload);
    return unwrap(data) as ErpVisitCoaching;
  },

  shelfAudits: async (customerId?: string) => {
    const { data } = await apiClient.get('/v1/shelf-audits', {
      params: customerId ? { customerId } : undefined,
    });
    return unwrap(data) as ErpShelfAudit[];
  },

  saveShelfAudit: async (payload: {
    customerId: string;
    photoId?: number;
    lines: Array<{
      itemId: string;
      status: 'present' | 'missing' | 'low';
      shelfNo?: number | null;
      facings?: number;
      readPrice?: number | null;
      competitor?: boolean;
      itemName?: string | null;
      boxX?: number | null;
      boxY?: number | null;
      boxW?: number | null;
      boxH?: number | null;
    }>;
  }) => {
    const { data } = await apiClient.post('/v1/shelf-audits', payload);
    return unwrap(data) as ErpShelfAudit;
  },

  planograms: async (params: { customerId?: string; orgCategoryId?: number; stored?: boolean }) => {
    const { data } = await apiClient.get('/v1/planograms', { params });
    return unwrap(data) as ErpPlanogramLine[];
  },

  savePlanogram: async (payload: {
    customerId?: string;
    orgCategoryId?: number;
    shelfNo: number;
    position: number;
    itemId: string;
    itemName?: string | null;
    facings?: number;
    targetPrice?: number | null;
  }) => {
    const { data } = await apiClient.post('/v1/planograms', payload);
    return unwrap(data) as ErpPlanogramLine;
  },

  deletePlanogram: async (id: number) => {
    const { data } = await apiClient.delete(`/v1/planograms/${id}`);
    return unwrap(data) as { deleted: boolean };
  },

  promoPlans: async (params?: {
    from?: string;
    to?: string;
    salesUserId?: number[];
    status?: string[];
  }) => {
    const { data } = await apiClient.get('/v1/promo-plans', { params });
    return unwrap(data) as ErpPromoPlan[];
  },

  createPromoPlan: async (payload: {
    salesUserId: number;
    customerId?: string;
    title: string;
    startsOn: string;
    endsOn: string;
    note?: string;
  }) => {
    const { data } = await apiClient.post('/v1/promo-plans', payload);
    return unwrap(data) as ErpPromoPlan;
  },

  updatePromoPlan: async (
    id: number,
    payload: {
      title?: string;
      startsOn?: string;
      endsOn?: string;
      status?: 'planned' | 'active' | 'done';
      customerId?: string | null;
      note?: string | null;
      photoId?: number | null;
    },
  ) => {
    const { data } = await apiClient.patch(`/v1/promo-plans/${id}`, payload);
    return unwrap(data) as ErpPromoPlan;
  },

  copyPromoPlan: async (id: number) => {
    const { data } = await apiClient.post(`/v1/promo-plans/${id}/copy`);
    return unwrap(data) as ErpPromoPlan;
  },

  dayReport: async (salesUserId?: number[]) => {
    const { data } = await apiClient.get('/v1/day', {
      params: salesUserId && salesUserId.length > 0 ? { salesUserId } : undefined,
    });
    return unwrap(data) as ErpDayReport;
  },

  fieldDashboard: async () => {
    const { data } = await apiClient.get('/v1/dashboard');
    return unwrap(data) as ErpFieldDashboard;
  },

  myReports: async (days: number) => {
    const { data } = await apiClient.get('/v1/my-reports', { params: { days } });
    return unwrap(data) as PresellerReport;
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
