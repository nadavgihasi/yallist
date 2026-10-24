import { handle } from 'hono/aws-lambda';
import { Resource } from 'sst';

import { createApp } from './app';
import { appSyncPublisher } from './realtime';
import { s3ReceiptStore } from './receipts';
import { db, liveAuth } from './runtime';

const publish = appSyncPublisher(Resource.Realtime.http, process.env.AWS_REGION!);

export const handler = handle(
  createApp(
    liveAuth(Resource.Web.url),
    db,
    publish,
    { stage: Resource.App.stage, githubToken: Resource.GithubFeedbackToken.value },
    s3ReceiptStore(Resource.Receipts.name),
  ),
);
