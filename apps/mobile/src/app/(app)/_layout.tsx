import { Redirect, Stack } from 'expo-router';

import { useAppState } from '@/state/store';
import { colors } from '@/theme';

const sheet = {
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

export default function AppLayout() {
  const { me } = useAppState();
  if (!me) return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Screen name="trips/[tripId]/items/new" options={sheet} />
      <Stack.Screen name="trips/[tripId]/items/[itemId]" options={sheet} />
      <Stack.Screen name="trips/[tripId]/expenses/new" options={sheet} />
    </Stack>
  );
}
