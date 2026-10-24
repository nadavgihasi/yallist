import type { InferResponseType } from 'hono/client';

import type { api } from '@/lib/api';

/** The signed-in user. */
export interface Me {
  userId: string;
  name: string;
}

/** Everything the trip screens show: GET /trips/:tripId, with balances and suggested transfers. */
export type TripData = InferResponseType<(typeof api.trips)[':tripId']['$get'], 200>;
export type Trip = TripData['trip'];
export type TripMember = TripData['members'][number];

/** One card on the home screen: GET /trips. */
export type TripSummary = InferResponseType<(typeof api.trips)['$get'], 200>['trips'][number];

/** What an invite link shows before joining: GET /invites/:token. */
export type InvitePreview = InferResponseType<(typeof api.invites)[':token']['$get'], 200>;
