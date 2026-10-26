import { handle } from 'hono/aws-lambda';
import { Resource } from 'sst';

import { createApp } from './app';
import { telegramConfig } from './notify/telegram';
import { appSyncPublisher } from './realtime';
import { s3ReceiptStore } from './receipts';
import { db, liveAuth } from './runtime';
import { initSentry } from './sentry';

initSentry(Resource.SentryDsn.value, Resource.App.stage);

const webhookSecret = Resource.SentryWebhookSecret.value;
const publish = appSyncPublisher(Resource.Realtime.http, process.env.AWS_REGION!);
const photos = s3ReceiptStore(Resource.Receipts.name);

export const handler = handle(
  createApp(
    liveAuth(Resource.Web.url, photos),
    db,
    publish,
    { stage: Resource.App.stage, githubToken: Resource.GithubFeedbackToken.value },
    photos,
    {
      secret: ['', 'unset'].includes(webhookSecret) ? null : webhookSecret,
      telegram: telegramConfig(Resource.TelegramBotToken.value, Resource.TelegramChatId.value),
    },
  ),
);
