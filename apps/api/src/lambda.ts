import { handle } from 'hono/aws-lambda';
import { Resource } from 'sst';

import { createApp } from './app';
import { createAuth } from './auth';
import { connect, createDb } from './db/client';

const db = createDb(connect());
const auth = createAuth(db, {
  baseURL: Resource.Api.url,
  webURL: Resource.Web.url,
  secret: Resource.BetterAuthSecret.value,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: Resource.GoogleClientSecret.value,
  },
});

export const handler = handle(createApp(auth, db));
