import { Stack } from 'expo-router';

import { colors } from '@/theme';

/** Opening a sheet by URL (reload, shared link) still renders the trip underneath it. */
export const unstable_settings = { initialRouteName: 'index' };

const sheet = {
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

export default function TripLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="items/new" options={sheet} />
      <Stack.Screen name="items/[itemId]" options={sheet} />
      <Stack.Screen name="expenses/new" options={sheet} />
      <Stack.Screen name="expenses/[expenseId]/receipt" options={sheet} />
      <Stack.Screen name="categories/new" options={sheet} />
      <Stack.Screen name="categories/[categoryId]" options={sheet} />
      <Stack.Screen name="cover" options={sheet} />
      <Stack.Screen name="delete" options={sheet} />
    </Stack>
  );
}
