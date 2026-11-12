import type { BulkItem, ListKind } from '@yallist/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';

import { api } from '@/lib/api';

import { tripKey, tripsKey } from './trips';

type Added = { added: { list: ListKind }[]; skipped: string[] };

/**
 * A request that adds many items to the trip. Unlike the one-item `addItem`, the sheet waits for
 * the answer: it closes only once the items are in, and on a failure it stays open with
 * everything as it was. So it doesn't wait offline either: it fails at once, and the user retries.
 */
function useAddMany<T>(tripId: string, send: (input: T) => Promise<Added>) {
  const queryClient = useQueryClient();
  const key = tripKey(tripId);
  return useMutation({
    // Under the trip's key: its realtime refresh waits while this is pending.
    mutationKey: [...key, 'bulk'],
    networkMode: 'always',
    mutationFn: send,
    // Returned, so the sheet closes onto a list that already shows them.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: tripsKey }),
      ]),
  });
}

/** Adds typed and ticked items (POST /trips/:id/items/bulk). */
export const useBulkAdd = (tripId: string) =>
  useAddMany(tripId, (items: BulkItem[]) =>
    parseResponse(api.trips[':tripId'].items.bulk.$post({ param: { tripId }, json: { items } })),
  );

/** Copies items of another trip of mine (POST /trips/:id/items/copy). */
export const useCopyItems = (tripId: string) =>
  useAddMany(tripId, (json: { fromTripId: string; itemIds: string[] }) =>
    parseResponse(api.trips[':tripId'].items.copy.$post({ param: { tripId }, json })),
  );

/** Another trip of mine, to copy from: the same query (and cache) as its own screen. */
export const useSourceTrip = (tripId: string | undefined) =>
  useQuery({
    queryKey: tripKey(tripId ?? ''),
    queryFn: () => parseResponse(api.trips[':tripId'].$get({ param: { tripId: tripId! } })),
    enabled: !!tripId,
  });
