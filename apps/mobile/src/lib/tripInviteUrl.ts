import { Platform } from 'react-native';

import { inviteOrigin, inviteUrl } from './invite';

/** A trip's invite link, the same everywhere it's shared: the invite sheet and the hero (#210). */
export function tripInviteUrl(token: string): string {
  const origin = inviteOrigin(Platform.OS, {
    pageOrigin: Platform.OS === 'web' ? window.location.origin : undefined,
    basePath: process.env.EXPO_BASE_URL,
    webUrl: process.env.EXPO_PUBLIC_WEB_URL,
  });
  return inviteUrl(origin, token);
}
