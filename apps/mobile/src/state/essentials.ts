import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseResponse, type InferResponseType } from 'hono/client';

import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { api } from '@/lib/api';

import { useMe } from './store';

/** GET /me/essentials: הקבועים שלי, and my past private items' names (for suggestions). */
type Essentials = InferResponseType<typeof api.me.essentials.$get, 200>;

/** Per user, like the profile. */
export const essentialsKey = (userId: string) => ['essentials', userId] as const;

export function useEssentials() {
  const { userId } = useMe();
  return useQuery({
    queryKey: essentialsKey(userId),
    queryFn: () => parseResponse(api.me.essentials.$get()),
  });
}

/** Saves the whole list (set_essentials), showing it at once; a refusal rolls back with a toast. */
export function useSetEssentials() {
  const queryClient = useQueryClient();
  const key = essentialsKey(useMe().userId);
  return useMutation({
    mutationKey: key,
    // In order: a quick delete then reorder must reach the server in that order.
    scope: { id: key.join('/') },
    mutationFn: (names: string[]) => parseResponse(api.me.essentials.$put({ json: { names } })),
    onMutate: async (names) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Essentials>(key);
      if (previous) queryClient.setQueryData<Essentials>(key, { ...previous, essentials: names });
      return { previous };
    },
    onError: (_error, _names, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      showToast(he.errors.failed, 'error');
    },
    onSettled: () =>
      queryClient.isMutating({ mutationKey: key }) > 1
        ? undefined
        : queryClient.invalidateQueries({ queryKey: key }),
  });
}
