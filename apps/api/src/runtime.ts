import { Resource } from 'sst';

import { createAuth } from './auth';
import { connect, createDb } from './db/client';
import type { ReceiptStore } from './receipts';

/** The stage's database, for the Lambdas (lambda.ts, realtime-authorizer.ts). */
export const db = createDb(connect());

/**
 * Better Auth as configured for this stage. Only the API passes the web app's URL: the realtime
 * authorizer just looks up sessions, and linking it to the web app would be a cycle (the web
 * build needs the realtime endpoint, which needs the authorizer).
 */
export const liveAuth = (webURL?: string, photos?: ReceiptStore) =>
  createAuth(db, {
    baseURL: Resource.Api.url,
    webURL,
    photos,
    devServer: Resource.App.stage !== 'production',
    secret: Resource.BetterAuthSecret.value,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: Resource.GoogleClientSecret.value,
    },
  });
