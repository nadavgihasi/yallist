import type { ShareContent } from 'react-native';

/**
 * The invite link people share: an https page on the stage's site on every platform, so friends
 * without the app can open it and chat apps linkify it. The app handles the same /j/<token> path.
 */
export function inviteUrl(webOrigin: string, token: string): string {
  return `${webOrigin.replace(/\/+$/, '')}/j/${encodeURIComponent(token)}`;
}

/**
 * What the share sheet gets for an invite link: the link once. Android shares only `message`; iOS
 * and the web (navigator.share) take `url` and append it to any `message`, which doubled the link.
 */
export function invitePayload(url: string, os: string): ShareContent {
  return os === 'android' ? { message: url } : { url };
}
