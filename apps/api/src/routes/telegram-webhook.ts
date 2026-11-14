import { timingSafeEqual } from 'node:crypto';

import { Hono } from 'hono';

import type { Db } from '../db/client';
import { callTelegram } from '../notify/telegram';
import { reportError } from '../sentry';
import {
  answerPrompt,
  approve,
  askDetails,
  merge,
  notNow,
  reject,
  type Actor,
  type PipelineConfig,
} from '../pipeline';

type Chat = { id: number };
type Update = {
  callback_query?: {
    id: string;
    from: Actor;
    message?: { chat: Chat };
    data?: string;
  };
  message?: {
    chat: Chat;
    from?: Actor;
    text?: string;
    reply_to_message?: { message_id: number };
  };
};

/** Buttons on a request (approvers) and on a merge offer (mergers). */
const ACTIONS = {
  a: (db: Db, pipeline: PipelineConfig, id: string, by: Actor) =>
    approve(db, pipeline, id, by, null),
  d: askDetails,
  r: reject,
  m: merge,
  n: notNow,
};
const MERGE_ACTIONS = new Set(['m', 'n']);
const CALLBACK = /^([adrmn]):([0-9a-f-]{36})$/;

const sameSecret = (given: string | undefined, secret: string) =>
  !!given &&
  given.length === secret.length &&
  timingSafeEqual(Buffer.from(given), Buffer.from(secret));

/**
 * The bot's webhook (setWebhook with `secret_token`, docs/deploy.md): button presses on a feature
 * request and replies to a details prompt, in the pipeline chat, from an approver, and Merge /
 * Not now on a merge offer, from a merger; everything else is ignored. `/chatid` in any chat answers with the chat's id and the sender's user id, for
 * setting up the pipeline chat and the approvers. Every update, and every failure, is answered 200
 * so Telegram doesn't redeliver; each step is a conditional move, so a redelivery would be a no-op.
 */
export const telegramWebhookRoutes = (db: Db, pipeline: PipelineConfig | null) =>
  new Hono().post('/', async (c) => {
    if (!pipeline) return c.json({ error: 'Not found' }, 404);
    if (!sameSecret(c.req.header('x-telegram-bot-api-secret-token'), pipeline.telegramSecret)) {
      return c.json({ error: 'Bad secret' }, 401);
    }
    const update: Update = await c.req.json<Update>().catch(() => ({}));
    const here = (chat?: Chat) => String(chat?.id) === pipeline.telegram.chatId;
    const approver = (from?: Actor): from is Actor =>
      !!from && pipeline.approvers.includes(String(from.id));
    const merger = (from?: Actor): from is Actor =>
      !!from && pipeline.mergers.includes(String(from.id));
    try {
      const press = update.callback_query;
      if (press) {
        const [, action, id] = CALLBACK.exec(press.data ?? '') ?? [];
        const merging = !!action && MERGE_ACTIONS.has(action);
        const allowed =
          here(press.message?.chat) && (merging ? merger(press.from) : approver(press.from));
        let toast = merging ? 'Only the owner can merge' : 'Only approvers can decide';
        try {
          if (allowed) {
            toast = 'Unknown button';
            if (action && id) {
              toast = await ACTIONS[action as keyof typeof ACTIONS](db, pipeline, id, press.from);
            }
          }
        } finally {
          await callTelegram(pipeline.telegram, 'answerCallbackQuery', {
            callback_query_id: press.id,
            text: toast,
          }).catch((err: unknown) => console.error('answerCallbackQuery failed', err));
        }
      }
      const message = update.message;
      if (message?.text && /^\/chatid(@\w+)?$/.test(message.text.trim())) {
        await callTelegram(pipeline.telegram, 'sendMessage', {
          chat_id: message.chat.id,
          text: `Chat id: ${message.chat.id}\nYour user id: ${message.from?.id ?? '?'}`,
        });
      }
      const promptId = message?.reply_to_message?.message_id;
      if (message?.text && promptId && here(message.chat) && approver(message.from)) {
        await answerPrompt(db, pipeline, promptId, message.from, message.text);
      }
    } catch (err) {
      console.error('Telegram update failed', err);
      await reportError(err, 'POST /webhooks/telegram');
    }
    return c.body(null, 200);
  });
