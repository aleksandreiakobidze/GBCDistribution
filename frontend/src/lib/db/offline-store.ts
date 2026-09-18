import { db } from './database';
import type { OfflineProduct, OfflineCustomer } from './database';

export const offlineStore = {
  async getProducts(search?: string): Promise<OfflineProduct[]> {
    if (search) {
      return db.products
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
        .toArray();
    }
    return db.products.toArray();
  },

  async getCustomers(search?: string): Promise<OfflineCustomer[]> {
    if (search) {
      return db.customers
        .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
        .toArray();
    }
    return db.customers.toArray();
  },

  async getProductById(id: number): Promise<OfflineProduct | undefined> {
    return db.products.get(id);
  },

  async getCustomerById(id: number): Promise<OfflineCustomer | undefined> {
    return db.customers.get(id);
  },
};
