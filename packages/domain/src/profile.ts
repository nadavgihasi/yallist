/** SPEC §9 avatar palette: a new user gets one at random and can pick another in their profile. */
export const AVATAR_COLORS = [
  '#FFD9C2',
  '#D8F0E0',
  '#F1DDF7',
  '#FFF0B3',
  '#D3F1F4',
  '#FFDDE4',
  '#E3E0FF',
] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/**
 * An Israeli mobile number as people type or autofill it ("050-123 4567", "+972 50 1234567",
 * "+972 (0)50-1234567") in E.164 ("+972501234567"), or undefined if it isn't one. Mobile only: Bit and PayBox need one.
 */
export function parseIsraeliMobile(text: string): string | undefined {
  const digits = text.replace(/[\s\-().]/g, '');
  const national = /^(?:\+?9720?|0)(5\d{8})$/.exec(digits)?.[1];
  return national && `+972${national}`;
}

/** "+972501234567" → "050-123-4567", the way people read and type it. */
export function formatIsraeliMobile(e164: string): string {
  const national = `0${e164.replace(/^\+972/, '')}`;
  return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
}
