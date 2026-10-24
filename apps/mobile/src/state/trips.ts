import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseResponse, type InferRequestType } from 'hono/client';

import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { api, statusOf } from '@/lib/api';

import { applyAction, type Action } from './reducer';
import { useMe } from './store';
import type { TripData } from './types';

/**
 * Query keys. Everything about one trip is one query, so a "trip changed" event (realtime)
 * only needs to invalidate `tripKey(id)`, plus `tripsKey` for the home screen.
 */
export const tripsKey = ['trips'] as const;
export const tripKey = (tripId: string) => ['trip', tripId] as const;

export const useTrips = () =>
  useQuery({ queryKey: tripsKey, queryFn: () => parseResponse(api.trips.$get()) });

export const useTripQuery = (tripId: string) =>
  useQuery({
    queryKey: tripKey(tripId),
    queryFn: () => parseResponse(api.trips[':tripId'].$get({ param: { tripId } })),
  });

/** The trip, once loaded. The trip screen handles loading and errors; sheets above it use this. */
export const useTrip = (tripId: string): TripData | undefined => useTripQuery(tripId).data;

type NewTrip = InferRequestType<typeof api.trips.$post>['json'];

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: NewTrip) => parseResponse(api.trips.$post({ json })),
    onSuccess: (data) => {
      // Opens without another round trip; a new trip has nothing to settle.
      queryClient.setQueryData(tripKey(data.trip.id), { ...data, balances: {}, transfers: [] });
      queryClient.invalidateQueries({ queryKey: tripsKey });
    },
    onError: () => showToast(he.errors.failed),
  });
}

export const useInvite = (token: string) =>
  useQuery({
    queryKey: ['invite', token],
    queryFn: () => parseResponse(api.invites[':token'].$get({ param: { token } })),
  });

export const joinTrip = (token: string) =>
  parseResponse(api.invites[':token'].join.$post({ param: { token }, json: {} }));

async function send(tripId: string, action: Action): Promise<unknown> {
  const trip = api.trips[':tripId'];
  const param = { tripId };
  const claim = (itemId: string, quantity: number) =>
    parseResponse(
      trip.items[':itemId'].claim.$put({ param: { ...param, itemId }, json: { quantity } }),
    );
  switch (action.type) {
    case 'setClaim':
      return claim(action.itemId, action.quantity);
    case 'addItem': {
      const item = await parseResponse(trip.items.$post({ param, json: action.item }));
      return action.claim > 0 && claim(item.id, action.claim);
    }
    case 'deleteItem':
      return parseResponse(
        trip.items[':itemId'].$delete({ param: { ...param, itemId: action.itemId } }),
      );
    case 'setNote':
      return parseResponse(
        trip.items[':itemId'].$patch({
          param: { ...param, itemId: action.itemId },
          json: { note: action.note || null },
        }),
      );
    case 'addExpense':
      return parseResponse(trip.expenses.$post({ param, json: action.expense }));
    case 'deleteExpense':
      return parseResponse(
        trip.expenses[':expenseId'].$delete({ param: { ...param, expenseId: action.expenseId } }),
      );
    case 'markPayment': {
      const { toUser, amountAgorot } = action;
      return parseResponse(trip.payments.$post({ param, json: { toUser, amountAgorot } }));
    }
    case 'deletePayment':
      return parseResponse(
        trip.payments[':paymentId'].$delete({ param: { ...param, paymentId: action.paymentId } }),
      );
    case 'approveMember':
    case 'declineMember':
    case 'removeMember': {
      const member = trip.members[':userId'];
      const memberParam = { param: { ...param, userId: action.userId } };
      if (action.type === 'approveMember') return parseResponse(member.approve.$post(memberParam));
      if (action.type === 'declineMember') return parseResponse(member.decline.$post(memberParam));
      return parseResponse(member.$delete(memberParam));
    }
  }
}

/**
 * Changes to one trip: shown at once where possible (`applyAction`), sent in order, rolled back
 * with a short message if the API refuses. Offline, they wait and go out on reconnect.
 */
export function useTripAction(tripId: string) {
  const me = useMe().userId;
  const queryClient = useQueryClient();
  const key = tripKey(tripId);
  const { mutate } = useMutation({
    mutationKey: key,
    // One at a time per trip: "+1, +1" must reach the server in that order.
    scope: { id: key.join('/') },
    mutationFn: (action: Action) => send(tripId, action),
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<TripData>(key);
      if (before) queryClient.setQueryData(key, applyAction(before, action, me));
      return { before };
    },
    onError: (error, action, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before);
      showToast(
        action.type === 'setClaim' && statusOf(error) === 409
          ? he.errors.claimTaken
          : he.errors.failed,
      );
    },
    // Refetch after the last queued change only; an earlier refetch would undo later ones.
    // Returning the refetch keeps the change pending until the screen shows the server's state.
    onSettled: () =>
      queryClient.isMutating({ mutationKey: key }) > 1
        ? undefined
        : Promise.all([
            queryClient.invalidateQueries({ queryKey: key }),
            queryClient.invalidateQueries({ queryKey: tripsKey }),
          ]),
  });
  return mutate;
}
