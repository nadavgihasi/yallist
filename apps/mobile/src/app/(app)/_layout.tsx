import { Redirect, Stack, usePathname } from 'expo-router';

import { useSession } from '@/state/store';
import { colors } from '@/theme';

export default function AppLayout() {
  const { me } = useSession();
  const pathname = usePathname();
  // Opened signed out on a deep link: sign in, then come back here.
  if (!me) {
    return (
      <Redirect
        href={pathname === '/' ? '/login' : { pathname: '/login', params: { next: pathname } }}
      />
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
