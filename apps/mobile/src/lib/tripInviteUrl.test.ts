import { afterEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ OS: 'ios' }));
vi.mock('react-native', () => ({ Platform: platform }));

const { tripInviteUrl } = await import('./tripInviteUrl');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('tripInviteUrl', () => {
  // #210: the hero's WhatsApp message carried `yallist:///j/<token>`, which chat apps don't linkify.
  it('is the stage site https link on native, not the app scheme', () => {
    platform.OS = 'android';
    vi.stubEnv('EXPO_PUBLIC_WEB_URL', 'https://yallist.example');
    expect(tripInviteUrl('YeelpBiA7qATZlf9FrkfJQ')).toBe(
      'https://yallist.example/j/YeelpBiA7qATZlf9FrkfJQ',
    );
  });

  it('falls back to the local Expo web server on native', () => {
    platform.OS = 'ios';
    vi.stubEnv('EXPO_PUBLIC_WEB_URL', undefined);
    expect(tripInviteUrl('abc')).toBe('http://localhost:8081/j/abc');
  });

  it("is the page's own site on web, under its base path", () => {
    platform.OS = 'web';
    vi.stubGlobal('window', { location: { origin: 'https://router.example' } });
    vi.stubEnv('EXPO_BASE_URL', '/pr-7');
    expect(tripInviteUrl('abc')).toBe('https://router.example/pr-7/j/abc');
  });
});
