import { afterEach, describe, expect, it, vi } from 'vitest';

import { escapeHtml, sendTelegram } from './telegram';

describe('telegramConfig', () => {
  afterEach(() => vi.restoreAllMocks());

  it('needs both values, and warns once without them', async () => {
    vi.resetModules();
    const { telegramConfig } = await import('./telegram');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(telegramConfig('token', '42')).toEqual({ token: 'token', chatId: '42' });
    expect(warn).not.toHaveBeenCalled();
    for (const [token, chatId] of [
      [undefined, '42'],
      ['token', ''],
      ['unset', '42'],
      ['token', 'unset'],
    ]) {
      expect(telegramConfig(token, chatId)).toBeNull();
    }
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('escapeHtml', () => {
  it('escapes and cuts', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
    expect(escapeHtml('abcdef', 3)).toBe('abc…');
  });
});

describe('sendTelegram', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does nothing without a bot', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await sendTelegram(null, 'hi');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts an HTML message to the chat', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetch);
    await sendTelegram({ token: '1:abc', chatId: '42' }, '<b>hi</b>');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bot1:abc/sendMessage',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual({
      chat_id: '42',
      text: '<b>hi</b>',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  it('throws on failure', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"ok":false}', { status: 400 }));
    await expect(sendTelegram({ token: '1:abc', chatId: '42' }, 'hi')).rejects.toThrow(
      'Telegram sendMessage failed: 400',
    );
  });
});
