/**
 * Bump when the shape of API data changes and the build has no commit SHA (local dev).
 * Deploy builds key the cache on their commit instead.
 */
export const CACHE_VERSION = '1';

/**
 * The persisted query cache's buster: a cache saved under another value is discarded on
 * restore, so a new build never renders data shaped for an older API.
 */
export function cacheBuster(gitSha: string | undefined): string {
  return gitSha || `v${CACHE_VERSION}`;
}
