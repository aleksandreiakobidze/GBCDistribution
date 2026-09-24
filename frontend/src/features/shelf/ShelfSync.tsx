import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushShelfOutbox } from './outbox';

export function ShelfSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const run = () => {
      void flushShelfOutbox().then((sent) => {
        if (sent > 0) {
          void queryClient.invalidateQueries({ queryKey: ['erp-shelf'] });
          void queryClient.invalidateQueries({ queryKey: ['erp-visit-photos'] });
          void queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
        }
      });
    };
    run();
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [queryClient]);

  return null;
}
