import { handle } from 'hono/aws-lambda';
import { Resource } from 'sst';

import { createApp, withBasePath } from './app';
import { feedbackToken } from './feedback-issue';
import { telegramConfig } from './notify/telegram';
import type { PipelineConfig } from './pipeline';
import { appSyncPublisher } from './realtime';
import { s3ReceiptStore } from './receipts';
import { db, liveAuth } from './runtime';
import { initSentry } from './sentry';

initSentry(Resource.SentryDsn.value, Resource.App.stage);

/** An optional secret's value, or null while it has SST's `unset` placeholder (or is empty). */
const optional = (value: string) => (['', 'unset'].includes(value) ? null : value);

const webhookSecret = optional(Resource.SentryWebhookSecret.value);
const telegram = telegramConfig(Resource.TelegramBotToken.value, Resource.TelegramChatId.value);
const telegramSecret = optional(Resource.TelegramWebhookSecret.value);
const fireToken = optional(Resource.RoutineFireToken.value);
const routineId = process.env.BUILD_ROUTINE_ID;
const githubToken = feedbackToken(Resource.GithubFeedbackToken.value);

/**
 * The remote feature pipeline (pipeline.ts): production only, since the bot has one webhook URL,
 * and only once the bot and its webhook secret exist. Without the routine, Approve only records.
 */
const pipeline: PipelineConfig | null =
  Resource.App.stage === 'production' && telegram && telegramSecret && githubToken
    ? {
        telegram,
        telegramSecret,
        githubToken,
        routine:
          fireToken && routineId?.startsWith('trig_') ? { id: routineId, token: fireToken } : null,
        githubSecret: optional(Resource.GithubWebhookSecret.value),
      }
    : null;
const publish = appSyncPublisher(Resource.Realtime.http, process.env.AWS_REGION!);
const photos = s3ReceiptStore(Resource.Receipts.name);

export const handler = handle(
  withBasePath(
    createApp(
      liveAuth(Resource.Web.url, photos),
      db,
      publish,
      { stage: Resource.App.stage, githubToken: Resource.GithubFeedbackToken.value, pipeline },
      photos,
      { secret: webhookSecret, telegram },
    ),
    Resource.Api.url,
  ),
);
