import { timingSafeEqual } from 'node:crypto';

import { Hono } from 'hono';

import type { Db } from '../db/client';
import { callTelegram } from '../notify/telegram';
import { reportError } from '../sentry';
import { answerPrompt, approve, askDetails, reject, type PipelineConfig } from '../pipeline';

type Update = {
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
  };
  message?: {
    from?: { id: number };
    text?: string;
    reply_to_message?: { message_id: number };
  };
};

const ACTIONS = {
  a: (db: Db, pipeline: PipelineConfig, id: string) => approve(db, pipeline, id, null),
  d: askDetails,
  r: reject,
};
const CALLBACK = /^([adr]):([0-9a-f-]{36})$/;

const sameSecret = (given: string | undefined, secret: string) =>
  !!given &&
  given.length === secret.length &&
  timingSafeEqual(Buffer.from(given), Buffer.from(secret));

/**
 * The bot's webhook (setWebhook with `secret_token`, docs/deploy.md): button presses on a feature
 * request and replies to a details prompt. Only the owner counts: in their private chat with the
 * bot, the chat id is their user id. Everything else, and every failure, is answered 200 so
 * Telegram doesn't redeliver; each step is a conditional move, so a redelivery would be a no-op.
 */
export const telegramWebhookRoutes = (db: Db, pipeline: PipelineConfig | null) =>
  new Hono().post('/', async (c) => {
    if (!pipeline) return c.json({ error: 'Not found' }, 404);
    if (!sameSecret(c.req.header('x-telegram-bot-api-secret-token'), pipeline.telegramSecret)) {
      return c.json({ error: 'Bad secret' }, 401);
    }
    const update: Update = await c.req.json<Update>().catch(() => ({}));
    const owner = (from?: { id: number }) => String(from?.id) === pipeline.telegram.chatId;
    try {
      const press = update.callback_query;
      if (press && owner(press.from)) {
        const [, action, id] = CALLBACK.exec(press.data ?? '') ?? [];
        let toast = 'Unknown button';
        try {
          if (action && id) toast = await ACTIONS[action as keyof typeof ACTIONS](db, pipeline, id);
        } finally {
          await callTelegram(pipeline.telegram, 'answerCallbackQuery', {
            callback_query_id: press.id,
            text: toast,
          }).catch((err: unknown) => console.error('answerCallbackQuery failed', err));
        }
      }
      const message = update.message;
      const promptId = message?.reply_to_message?.message_id;
      if (message?.text && promptId && owner(message.from)) {
        await answerPrompt(db, pipeline, promptId, message.text);
      }
    } catch (err) {
      console.error('Telegram update failed', err);
      await reportError(err, 'POST /webhooks/telegram');
    }
    return c.body(null, 200);
  });
