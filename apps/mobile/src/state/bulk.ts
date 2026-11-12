import type { BulkItem } from '@yallist/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';

import { api } from '@/lib/api';

import { tripKey, tripsKey } from './trips';

/**
 * Adds many items at once (POST /trips/:id/items/bulk). Unlike the one-item `addItem`, the sheet
 * waits for the answer: it closes only once the items are in, and on a failure it stays open with
 * everything typed. So it doesn't wait offline either: it fails at once, and the user retries.
 */
export function useBulkAdd(tripId: string) {
  const queryClient = useQueryClient();
  const key = tripKey(tripId);
  return useMutation({
    // Under the trip's key: its realtime refresh waits while this is pending.
    mutationKey: [...key, 'bulk'],
    networkMode: 'always',
    mutationFn: (items: BulkItem[]) =>
      parseResponse(api.trips[':tripId'].items.bulk.$post({ param: { tripId }, json: { items } })),
    // Returned, so the sheet closes onto a list that already shows them.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: tripsKey }),
      ]),
  });
}
