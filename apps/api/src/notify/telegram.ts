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

/**
 * Posts `html` (Telegram's HTML subset; anything not ours goes through escapeHtml) to the chat with
 * the Bot API's sendMessage. Without a bot (null), does nothing. Throws on any failure; the error
 * never includes the token.
 */
export async function sendTelegram(telegram: Telegram | null, html: string) {
  if (!telegram) return;
  const res = await fetch(`https://api.telegram.org/bot${telegram.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegram.chatId,
      text: html,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage failed: ${res.status} ${await res.text()}`);
}
