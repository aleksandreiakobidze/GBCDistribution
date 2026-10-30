import apiClient from './client';

export type PlanRow = {
  region: string;
  supervisor: string;
  presale: string;
  channel: string;
  category: string;
  brand: string;
  plan: number;
  real: number;
  return: number;
  net: number;
  percent: number | null;
  startsOn: string;
  endsOn: string;
  factKey: string;
};

export type PlanRank = {
  rank: number;
  presale: string;
  plan: number;
  real: number;
  return: number;
  net: number;
  percent: number | null;
  self: boolean;
};

export type PlanCatalogPair = {
  category: string;
  brand: string;
};

export type PlanChoices = {
  regions: string[];
  supervisors: string[];
  presales: string[];
  channels: string[];
  categories: string[];
  brands: string[];
  catalog: PlanCatalogPair[];
};

export type PlanFilters = {
  region: string[];
  supervisor: string[];
  presale: string;
  presales: string[];
  presaleChosen: boolean;
  channel: string[];
  category: string[];
  brand: string[];
};

export type PlanPayload = {
  upload: { id: number; name: string; uploadedAt: string | null; computedAt: string | null } | null;
  canUpload: boolean;
  canRefresh: boolean;
  scope: 'all' | 'presale' | 'unmapped' | 'supervisor';
  anchor: string | null;
  ranking: PlanRank[];
  choices: PlanChoices;
  rows: PlanRow[];
  totals?: {
    plan: number;
    real: number;
    return: number;
    net: number;
    percent: number | null;
  };
};

function unwrap<T>(payload: { data: T }): T {
  return payload.data;
}

export const planApi = {
  show: async (filters: PlanFilters) => {
    const { data } = await apiClient.get('/v1/plans', {
      params: {
        region: filters.region,
        supervisor: filters.supervisor,
        presale: filters.presaleChosen ? filters.presales : filters.presale,
        presaleChosen: filters.presaleChosen ? '1' : '',
        channel: filters.channel,
        category: filters.category,
        brand: filters.brand,
      },
    });
    return unwrap(data) as PlanPayload;
  },
  upload: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    const { data } = await apiClient.post('/v1/plans', body, {
      timeout: 300000,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(data) as PlanPayload;
  },
  refresh: async () => {
    const { data } = await apiClient.post('/v1/plans/refresh', null, { timeout: 300000 });
    return unwrap(data) as PlanPayload;
  },
};
