import { AwsClient } from 'aws4fetch';

import type { Auth } from './auth';
import { findMember } from './dal/members';
import type { Db } from './db/client';

/**
 * Realtime is AppSync Events: one channel per trip, `/trips/<tripId>`, in the `trips` namespace
 * (infra/app/core.ts). Events say only that the trip changed; clients refetch through the
 * API, which applies the usual access checks. So an event carries no personal data.
 */
const tripChannel = (tripId: string) => `/trips/${tripId}`;
const TRIP_CHANNEL = /^\/trips\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** Tells the trip's subscribers that it changed. Throws when the publish fails. */
export type Publish = (tripId: string) => Promise<void>;

/** Publishes over the Events API's HTTP endpoint, signed with the Lambda's IAM role. */
export function appSyncPublisher(httpHost: string, region: string): Publish {
  const aws = new AwsClient({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    service: 'appsync',
    region,
  });
  return async (tripId) => {
    const res = await aws.fetch(`https://${httpHost}/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: tripChannel(tripId),
        events: [JSON.stringify({ type: 'changed', tripId })],
      }),
      signal: AbortSignal.timeout(3000),
    });
    const body = await res.text();
    if (!res.ok || (JSON.parse(body) as { failed?: unknown[] }).failed?.length) {
      throw new Error(`Realtime publish failed: ${res.status} ${body}`);
    }
  };
}

/** The part of an AppSync Events authorizer request we use. */
export interface AuthorizerEvent {
  authorizationToken: string;
  requestContext: { operation: string; channel?: string };
}

/**
 * Connecting needs a valid session token (with or without `Bearer `); subscribing to a trip's
 * channel needs active membership of the trip. Clients never publish: the API does, with IAM.
 */
export async function authorize(auth: Auth, db: Db, event: AuthorizerEvent): Promise<boolean> {
  const token = event.authorizationToken.replace(/^Bearer /i, '');
  const session = await auth.api.getSession({
    headers: new Headers({ authorization: `Bearer ${token}` }),
  });
  if (!session) return false;

  const { operation, channel } = event.requestContext;
  if (operation === 'EVENT_CONNECT') return true;
  if (operation !== 'EVENT_SUBSCRIBE') return false;
  const tripId = TRIP_CHANNEL.exec(channel ?? '')?.[1];
  if (!tripId) return false;
  const member = await findMember(db, tripId, session.user.id);
  return member?.status === 'active';
}
