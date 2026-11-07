/** Where notifications go: a Telegram bot and the chat it posts to. */
export type Telegram = { token: string; chatId: string };

let warned = false;

/**
 * The stage's Telegram bot, or null without one: either value unset, empty or SST's `unset`
 * placeholder. Warns (once per process) then, so missing alerts show in the logs.
 */
export function telegramConfig(token: string | undefined, chatId: string | undefined) {
  const set = (value: string | undefined) => value && value !== 'unset';
  if (set(token) && set(chatId)) return { token: token!, chatId: chatId! } satisfies Telegram;
  if (!warned) console.warn('No TelegramBotToken/TelegramChatId: notifications are not sent');
  warned = true;
  return null;
}

/**
 * Text that isn't ours, safe in a message (and in an href) sent with `parse_mode: 'HTML'`: escaped, and cut to
 * `max` characters so a message stays under Telegram's 4096.
 */
export const escapeHtml = (text: string, max = 500) =>
  (text.length > max ? `${text.slice(0, max)}…` : text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** A Bot API method's `result`; throws on any failure, and the error never includes the token. */
export async function callTelegram<T = unknown>(
  telegram: Telegram,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${telegram.token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Telegram ${method} failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { result: T }).result;
}

/** Inline keyboard buttons, one row; `data` comes back in the button's callback query. */
export type Buttons = { text: string; data: string }[];

/**
 * Posts `html` (Telegram's HTML subset; anything not ours goes through escapeHtml) to the chat with
 * the Bot API's sendMessage, optionally with `buttons` or as a reply to `replyTo`; returns the new
 * message's id. Without a bot (null), does nothing. Throws on any failure.
 */
export async function sendTelegram(
  telegram: Telegram | null,
  html: string,
  {
    buttons,
    replyTo,
    forceReply,
  }: { buttons?: Buttons; replyTo?: number; forceReply?: boolean } = {},
) {
  if (!telegram) return;
  const message = await callTelegram<{ message_id: number }>(telegram, 'sendMessage', {
    chat_id: telegram.chatId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(replyTo && {
      reply_parameters: { message_id: replyTo, allow_sending_without_reply: true },
    }),
    ...(buttons && { reply_markup: keyboard(buttons) }),
    ...(forceReply && { reply_markup: { force_reply: true, selective: true } }),
  });
  return message.message_id;
}

/** Replaces a message's text and buttons (none: removes them). */
export async function editTelegram(
  telegram: Telegram,
  messageId: number,
  html: string,
  buttons: Buttons = [],
) {
  await callTelegram(telegram, 'editMessageText', {
    chat_id: telegram.chatId,
    message_id: messageId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard(buttons),
  });
}

const keyboard = (buttons: Buttons) => ({
  inline_keyboard: buttons.length
    ? [buttons.map(({ text, data }) => ({ text, callback_data: data }))]
    : [],
});
