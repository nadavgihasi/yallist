import { authorize, type AuthorizerEvent } from './realtime';
import { db, liveAuth } from './runtime';

const auth = liveAuth();

/**
 * AppSync Events Lambda authorizer for the realtime API (infra/app/core.ts). Results are
 * never cached: a cached result would be reused for other channels and outlive a removal.
 */
export const handler = async (event: AuthorizerEvent) => ({
  isAuthorized: await authorize(auth, db, event),
  ttlOverride: 0,
});
