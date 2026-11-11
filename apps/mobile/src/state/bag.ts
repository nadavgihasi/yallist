import type { BagItem } from '@yallist/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';

import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { api } from '@/lib/api';

import { useMe } from './store';
import { tripsKey } from './trips';

/** Per user, like the profile. */
const bagKey = (userId: string) => ['bag', userId] as const;

/** My bag (GET /me/bag): what I always have at home. */
export function useBag() {
  const { userId } = useMe();
  return useQuery({
    queryKey: bagKey(userId),
    queryFn: async () => (await parseResponse(api.me.bag.$get())).items,
  });
}

type BagChange =
  | { type: 'add'; items: { name: string; quantity: number }[] }
  | { type: 'setQuantity'; id: string; quantity: number }
  | { type: 'remove'; id: string };

async function send(change: BagChange): Promise<BagItem[] | undefined> {
  switch (change.type) {
    case 'add':
      return (await parseResponse(api.me.bag.$post({ json: { items: change.items } }))).items;
    case 'setQuantity':
      await parseResponse(
        api.me.bag[':id'].$patch({
          param: { id: change.id },
          json: { quantity: change.quantity },
        }),
      );
      return undefined;
    case 'remove':
      await parseResponse(api.me.bag[':id'].$delete({ param: { id: change.id } }));
      return undefined;
  }
}

function apply(bag: BagItem[], change: BagChange): BagItem[] {
  switch (change.type) {
    case 'add': {
      const have = new Set(bag.map((b) => b.name));
      const added = change.items
        .filter((i) => !have.has(i.name))
        .map((i) => ({ ...i, id: `new-${i.name}` }));
      return [...bag, ...added];
    }
    case 'setQuantity':
      return bag.map((b) => (b.id === change.id ? { ...b, quantity: change.quantity } : b));
    case 'remove':
      return bag.filter((b) => b.id !== change.id);
  }
}

/**
 * Changes to my bag: shown at once, sent one at a time ("+1, +1" in order), rolled back with a
 * toast if refused. Adding or removing an item changes what my trips mark as mine, so they reload.
 */
export function useBagChange() {
  const queryClient = useQueryClient();
  const key = bagKey(useMe().userId);
  return useMutation({
    mutationKey: key,
    scope: { id: key.join('/') },
    mutationFn: send,
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<BagItem[]>(key);
      if (before) queryClient.setQueryData(key, apply(before, change));
      return { before };
    },
    onError: (_error, _change, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before);
      showToast(he.errors.failed, 'error');
    },
    onSuccess: (bag, change) => {
      if (bag) queryClient.setQueryData(key, bag);
      if (change.type === 'setQuantity') return;
      void queryClient.invalidateQueries({ queryKey: ['trip'] });
      void queryClient.invalidateQueries({ queryKey: tripsKey });
    },
    onSettled: () =>
      queryClient.isMutating({ mutationKey: key }) > 1
        ? undefined
        : queryClient.invalidateQueries({ queryKey: key }),
  });
}
