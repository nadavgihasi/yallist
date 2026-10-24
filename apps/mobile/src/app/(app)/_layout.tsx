import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/state/store';
import { colors } from '@/theme';

export default function AppLayout() {
  const { me } = useSession();
  if (!me) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}
    />
  );
}
