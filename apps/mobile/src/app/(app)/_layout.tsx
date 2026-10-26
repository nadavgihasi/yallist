import { Redirect, Stack, useGlobalSearchParams, usePathname, useSegments } from 'expo-router';

import { useSession } from '@/state/store';
import { colors } from '@/theme';

// A crash in this layout keeps the root (toasts, the session) around the error screen; screens
// have their own (the root layout's `screenErrorBoundary`).
export { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AppLayout() {
  const { me } = useSession();
  const href = useHref();
  // Opened signed out on a deep link: sign in, then come back here.
  if (!me) {
    return (
      <Redirect href={href === '/' ? '/login' : { pathname: '/login', params: { next: href } }} />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Screen
        name="feedback"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}

/** The current path with its query (?tab=money): the params that aren't already in the path. */
function useHref() {
  const pathname = usePathname();
  const segments = useSegments();
  const params = useGlobalSearchParams();
  // Route params ([tripId]) are in the path already.
  const inPath = new Set(segments.map((s) => /^\[(?:\.\.\.)?(.+)\]$/.exec(s)?.[1]));
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (!inPath.has(key)) for (const v of [value ?? []].flat()) query.append(key, v);
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}
