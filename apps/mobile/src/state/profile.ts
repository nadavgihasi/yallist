import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseResponse, type InferRequestType, type InferResponseType } from 'hono/client';

import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { api } from '@/lib/api';

import { useMe } from './store';

/** GET /me: the profile, and whether the user is a guest or signed in with Google. */
export type Profile = InferResponseType<typeof api.me.$get, 200>;
export type ProfileChanges = InferRequestType<typeof api.me.$patch>['json'];

/** Per user, so linking Google (a new user id) loads the account's profile. */
const meKey = (userId: string) => ['me', userId] as const;

export function useProfile() {
  const { userId } = useMe();
  return useQuery({ queryKey: meKey(userId), queryFn: () => parseResponse(api.me.$get()) });
}

/** Saves profile changes, showing them at once; a rejected change rolls back with a toast. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const key = meKey(useMe().userId);
  return useMutation({
    mutationFn: (json: ProfileChanges) => parseResponse(api.me.$patch({ json })),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile>(key);
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, ...changes } as Profile);
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      showToast(he.errors.failed);
    },
    onSuccess: (profile) => queryClient.setQueryData(key, profile),
  });
}
