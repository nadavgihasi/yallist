/**
 * The invite link people share: an https page on the stage's site on every platform, so friends
 * without the app can open it and chat apps linkify it. The app handles the same /j/<token> path.
 */
export function inviteUrl(webOrigin: string, token: string): string {
  return `${webOrigin.replace(/\/+$/, '')}/j/${encodeURIComponent(token)}`;
}
