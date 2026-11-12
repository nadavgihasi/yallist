import type { ShareContent } from 'react-native';

import { andMore, he, joinNames } from '@/i18n/he';

/**
 * The invite link people share: an https page on the stage's site on every platform, so friends
 * without the app can open it and chat apps linkify it. The app handles the same /j/<token> path.
 */
export function inviteUrl(webOrigin: string, token: string): string {
  return `${webOrigin.replace(/\/+$/, '')}/j/${encodeURIComponent(token)}`;
}

/**
 * What the share sheet gets for an invite: the message alone, its link inside it, on every
 * platform. iOS and the web (navigator.share) append a separate `url` to the message, which
 * doubled the link and made what's sent differ from the invite sheet's preview.
 */
export function invitePayload(message: string): ShareContent {
  return { message };
}

/**
 * Who's in, on the join page: `דנה כבר בטיול` / `דנה, רון ושירה כבר בטיול` / `דנה, רון ועוד 5 כבר
 * בטיול`. `names` are the preview's (the first to join), `total` counts everyone.
 */
export function whoIsIn(names: string[], total: number): string {
  if (names.length === 0) return '';
  const shown = total <= 3 && names.length === total ? names : names.slice(0, 2);
  const rest = total - shown.length;
  return he.join.whoIsIn(rest > 0 ? `${shown.join(', ')} ${andMore(rest)}` : joinNames(shown));
}
