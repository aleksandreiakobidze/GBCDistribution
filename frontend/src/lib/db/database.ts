import Dexie, { type Table } from 'dexie';

export interface OfflineProduct {
  id: number;
  name: string;
  name_ka: string | null;
  sku: string;
  barcode: string | null;
  unit: string;
  price: number;
  category_id: number;
  category_name: string;
  is_active: boolean;
}

export interface OfflineCustomer {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  city: string;
  category: string;
  credit_limit: number;
}

export interface OfflineOrder {
  id?: number;
  offline_id: string;
  customer_id: number;
  customer_name: string;
  warehouse_id: number;
  items: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
  }>;
  notes: string;
  total: number;
  created_at: string;
  synced: boolean;
}

export interface OfflineVisit {
  id?: number;
  offline_id: string;
  customer_id: number;
  customer_name: string;
  latitude: number | null;
  longitude: number | null;
  notes: string;
  has_order: boolean;
  created_at: string;
  synced: boolean;
}

export class BscDatabase extends Dexie {
  products!: Table<OfflineProduct, number>;
  customers!: Table<OfflineCustomer, number>;
  orders!: Table<OfflineOrder, number>;
  visits!: Table<OfflineVisit, number>;

  constructor() {
    super('bsc-distribution');
    this.version(1).stores({
      products: 'id, sku, category_id, name',
      customers: 'id, name, category',
      orders: '++id, offline_id, customer_id, synced, created_at',
      visits: '++id, offline_id, customer_id, synced, created_at',
    });
  }
}

export const db = new BscDatabase();
