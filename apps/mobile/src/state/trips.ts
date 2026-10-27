import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { parseResponse, type InferRequestType, type InferResponseType } from 'hono/client';
import { useCallback, useEffect } from 'react';

import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { api, sessionToken, statusOf } from '@/lib/api';
import { REALTIME_HOST, subscribe } from '@/lib/realtime';

import { essentialsKey } from './essentials';
import { uploadReceipt } from './receipts';
import { applyAction, type Action, type NewItemInput } from './reducer';
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

/**
 * Keeps the trip fresh while its screen is open: other members' changes arrive as events on its
 * realtime channel, and each one refetches the trip (and the home screen's list). Only while the
 * trip loads fine: not for a trip we can't open, and offline the refetch on reconnect re-enables it.
 */
export function useTripUpdates(tripId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!REALTIME_HOST || !enabled) return;
    const key = tripKey(tripId);
    const refresh = () => {
      // Our own changes publish events too. While one is pending, its onSettled refetches after
      // the last; refetching now would briefly show the server without the queued changes.
      if (queryClient.isMutating({ mutationKey: key })) return;
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: tripsKey });
    };
    return subscribe({
      host: REALTIME_HOST,
      channel: `/trips/${tripId}`,
      token: sessionToken,
      onEvent: refresh,
      onSubscribed: refresh,
    });
  }, [queryClient, tripId, enabled]);
}

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
      void queryClient.invalidateQueries({ queryKey: tripsKey });
    },
    onError: () => showToast(he.errors.failed, 'error'),
  });
}

/** Home, and the trip out of the caches: what's left once it's gone (deleted, or we were removed). */
export function useLeaveTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    (message: string) => {
      router.dismissTo('/');
      showToast(message);
      // After leaving the screen, so its query isn't refetched for a trip that's gone.
      setTimeout(() => {
        queryClient.removeQueries({ queryKey: tripKey(tripId) });
        void queryClient.invalidateQueries({ queryKey: tripsKey });
      });
    },
    [queryClient, tripId],
  );
}

/** Deletes the trip for everyone (organizers), then goes home. */
export function useDeleteTrip(tripId: string) {
  const leave = useLeaveTrip(tripId);
  return useMutation({
    // Under the trip's key: its realtime refresh waits while this is pending.
    mutationKey: [...tripKey(tripId), 'delete'],
    mutationFn: () => parseResponse(api.trips[':tripId'].$delete({ param: { tripId } })),
    onSuccess: () => leave(he.deleteTrip.deleted),
    onError: () => showToast(he.errors.failed, 'error'),
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
  /** The item, put into a category created for it first when `newCategory` is given. */
  const withNewCategory = async (item: NewItemInput, newCategory?: string) => {
    if (!newCategory) return item;
    const json = { list: item.list, name: newCategory };
    const category = await parseResponse(trip.categories.$post({ param, json }));
    return { ...item, categoryId: category.id };
  };
  const claim = (itemId: string, quantity: number) =>
    parseResponse(
      trip.items[':itemId'].claim.$put({ param: { ...param, itemId }, json: { quantity } }),
    );
  switch (action.type) {
    case 'setClaim':
      return claim(action.itemId, action.quantity);
    case 'setPacked':
      return parseResponse(
        trip.items[':itemId'].packed.$put({
          param: { ...param, itemId: action.itemId },
          json: { packed: action.packed },
        }),
      );
    case 'addItem': {
      const json = await withNewCategory(action.item, action.newCategory);
      const item = await parseResponse(trip.items.$post({ param, json }));
      return action.claim > 0 && claim(item.id, action.claim);
    }
    case 'addPrivateItem': {
      const { name, saveAsEssential } = action;
      return parseResponse(trip.bag.$post({ param, json: { name, saveAsEssential } }));
    }
    case 'deleteItem':
      return parseResponse(
        trip.items[':itemId'].$delete({ param: { ...param, itemId: action.itemId } }),
      );
    case 'editItem':
      return parseResponse(
        trip.items[':itemId'].$patch({
          param: { ...param, itemId: action.itemId },
          json: await withNewCategory(action.changes, action.newCategory),
        }),
      );
    case 'addCategory': {
      const { list, name } = action;
      return parseResponse(trip.categories.$post({ param, json: { list, name } }));
    }
    case 'renameCategory':
      return parseResponse(
        trip.categories[':categoryId'].$patch({
          param: { ...param, categoryId: action.categoryId },
          json: { name: action.name },
        }),
      );
    case 'reorderCategories': {
      const { list, categoryIds } = action;
      return parseResponse(trip.categories.order.$put({ param, json: { list, categoryIds } }));
    }
    case 'deleteCategory':
      return parseResponse(
        trip.categories[':categoryId'].$delete({
          param: { ...param, categoryId: action.categoryId },
        }),
      );
    case 'setNote':
      return parseResponse(
        trip.items[':itemId'].$patch({
          param: { ...param, itemId: action.itemId },
          json: { note: action.note || null },
        }),
      );
    case 'addExpense': {
      const expense = await parseResponse(trip.expenses.$post({ param, json: action.expense }));
      // Not awaited: the expense is saved either way; the money tab shows progress and retry.
      if (action.receipt) {
        void uploadReceipt(tripId, expense.id, action.receipt).then(
          (ok) => ok || showToast(he.receipt.failedToast, 'error'),
        );
      }
      return expense;
    }
    case 'deleteExpense':
      return parseResponse(
        trip.expenses[':expenseId'].$delete({ param: { ...param, expenseId: action.expenseId } }),
      );
    case 'deleteReceipt':
      return parseResponse(
        trip.expenses[':expenseId'].receipt.$delete({
          param: { ...param, expenseId: action.expenseId },
        }),
      );
    case 'markPayment': {
      const { toUser, amountAgorot, fromUser } = action;
      return parseResponse(
        trip.payments.$post({ param, json: { toUser, amountAgorot, fromUser } }),
      );
    }
    case 'deletePayment':
      return parseResponse(
        trip.payments[':paymentId'].$delete({ param: { ...param, paymentId: action.paymentId } }),
      );
    case 'confirmPayment':
      return parseResponse(
        trip.payments[':paymentId'].confirm.$post({
          param: { ...param, paymentId: action.paymentId },
        }),
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
    case 'setCover':
      return parseResponse(trip.$patch({ param, json: { cover: action.cover } }));
    case 'startRun':
      return parseResponse(trip.runs.$post({ param, json: { itemIds: action.itemIds } }));
    case 'addToRun':
      return parseResponse(
        trip.runs[':runId'].items.$post({
          param: { ...param, runId: action.runId },
          json: { itemId: action.itemId },
        }),
      );
    case 'setInCart':
      return parseResponse(
        trip.items[':itemId'].cart.$put({
          param: { ...param, itemId: action.itemId },
          json: { inCart: action.inCart },
        }),
      );
    case 'finishRun': {
      const { runId, amountAgorot, shares, receipt } = action;
      const expense = await parseResponse(
        trip.runs[':runId'].finish.$post({
          param: { ...param, runId },
          json: { amountAgorot, shares },
        }),
      );
      if (receipt) {
        void uploadReceipt(tripId, expense.id, receipt).then(
          (ok) => ok || showToast(he.receipt.failedToast, 'error'),
        );
      }
      return expense;
    }
    case 'cancelRun':
      return parseResponse(
        trip.runs[':runId'].cancel.$post({ param: { ...param, runId: action.runId } }),
      );
  }
}

/** What `startRun` answers: the run, and the items someone else got first. */
export type StartedRun = InferResponseType<(typeof api.trips)[':tripId']['runs']['$post'], 200>;

/**
 * Changes to one trip: shown at once where possible (`applyAction`), sent in order, rolled back
 * with a short message if the API refuses. Offline, they wait and go out on reconnect (while the
 * app stays open: queued changes aren't persisted).
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
      const conflict = statusOf(error) === 409;
      const message = !conflict
        ? he.errors.failed
        : action.type === 'setClaim' || action.type === 'addToRun'
          ? he.errors.claimTaken
          : action.type === 'addCategory' || action.type === 'renameCategory'
            ? he.errors.categoryExists
            : action.type === 'editItem'
              ? he.errors.itemEditRefused
              : action.type === 'setInCart' || action.type === 'cancelRun'
                ? he.errors.runOver
                : he.errors.failed;
      showToast(message, 'error');
    },
    // Refetch after the last queued change only; an earlier refetch would undo later ones.
    // Returning the refetch keeps the change pending until the screen shows the server's state.
    onSettled: (_data, _error, action) => {
      if (action.type === 'addPrivateItem') {
        void queryClient.invalidateQueries({ queryKey: essentialsKey(me) });
      }
      return queryClient.isMutating({ mutationKey: key }) > 1
        ? undefined
        : Promise.all([
            queryClient.invalidateQueries({ queryKey: key }),
            queryClient.invalidateQueries({ queryKey: tripsKey }),
          ]);
    },
  });
  return mutate;
}

/** A finished run that is still waiting to reach the API (offline): label it until it syncs. */
export const useFinishWaiting = (tripId: string) =>
  useMutationState({
    filters: {
      mutationKey: tripKey(tripId),
      predicate: (m) => m.state.isPaused && (m.state.variables as Action).type === 'finishRun',
    },
  }).length > 0;
