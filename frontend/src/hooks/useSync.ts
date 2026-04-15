import { useEffect, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { useSyncStore } from '@/stores/syncStore';
import { syncManager } from '@/lib/db/sync-manager';

export function useSync() {
  const isOnline = useOnlineStatus();
  const { pendingCount, isSyncing, lastSyncAt } = useSyncStore();

  useEffect(() => {
    syncManager.getPendingCount().then((count) => {
      useSyncStore.getState().setPendingCount(count);
    });
  }, []);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncManager.syncPendingOrders();
    }
  }, [isOnline, pendingCount]);

  useEffect(() => {
    if (isOnline) {
      syncManager.pullLatestData();
    }
  }, [isOnline]);

  const triggerSync = useCallback(() => {
    if (isOnline) {
      syncManager.syncPendingOrders();
    }
  }, [isOnline]);

  return { pendingCount, isSyncing, lastSyncAt, triggerSync, isOnline };
}
