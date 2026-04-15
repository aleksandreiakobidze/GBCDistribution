import { db } from './database';
import { syncApi } from '@/lib/api/sync.api';
import { productsApi } from '@/lib/api/products.api';
import { customersApi } from '@/lib/api/customers.api';
import { useSyncStore } from '@/stores/syncStore';

export class SyncManager {
  private static instance: SyncManager;
  private syncing = false;

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  async syncPendingOrders(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    useSyncStore.getState().setIsSyncing(true);

    try {
      const pendingOrders = await db.orders.where('synced').equals(0).toArray();
      if (pendingOrders.length === 0) {
        this.syncing = false;
        useSyncStore.getState().setIsSyncing(false);
        return;
      }

      const ordersToSync = pendingOrders.map((o) => ({
        customer_id: o.customer_id,
        warehouse_id: o.warehouse_id,
        notes: o.notes,
        offline_id: o.offline_id,
        items: o.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_percent: i.discount_percent,
        })),
      }));

      await syncApi.pushOrders(ordersToSync);

      await db.orders.where('synced').equals(0).modify({ synced: true });
      useSyncStore.getState().setPendingCount(0);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncing = false;
      useSyncStore.getState().setIsSyncing(false);
      useSyncStore.getState().setLastSyncAt(new Date().toISOString());
    }
  }

  async pullLatestData(): Promise<void> {
    try {
      await productsApi.getCategories();
      const productsResult = await productsApi.getAll({ page: 1 });
      const customersResult = await customersApi.getAll({ page: 1 });

      if (productsResult.data.length > 0) {
        await db.products.clear();
        await db.products.bulkPut(
          productsResult.data.map((p) => ({
            id: p.id,
            name: p.name,
            name_ka: p.name_ka,
            sku: p.sku,
            barcode: p.barcode,
            unit: p.unit,
            price: p.price,
            category_id: p.category?.id ?? 0,
            category_name: p.category?.name ?? '',
            is_active: p.is_active,
          }))
        );
      }

      if (customersResult.data.length > 0) {
        await db.customers.clear();
        await db.customers.bulkPut(
          customersResult.data.map((c) => ({
            id: c.id,
            name: c.name,
            contact_person: c.contact_person,
            phone: c.phone,
            address: c.address,
            city: c.city,
            category: c.category,
            credit_limit: c.credit_limit,
          }))
        );
      }
    } catch (error) {
      console.error('Pull failed:', error);
    }
  }

  async getPendingCount(): Promise<number> {
    return db.orders.where('synced').equals(0).count();
  }

  async addOfflineOrder(order: {
    customer_id: number;
    customer_name: string;
    warehouse_id: number;
    items: Array<{ product_id: number; product_name: string; quantity: number; unit_price: number; discount_percent: number }>;
    notes: string;
    total: number;
  }): Promise<void> {
    await db.orders.add({
      offline_id: crypto.randomUUID(),
      ...order,
      created_at: new Date().toISOString(),
      synced: false,
    });
    const count = await this.getPendingCount();
    useSyncStore.getState().setPendingCount(count);
  }
}

export const syncManager = SyncManager.getInstance();
