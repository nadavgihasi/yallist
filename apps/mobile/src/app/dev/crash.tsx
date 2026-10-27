import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/PillButton';
import { testId } from '@/lib/testId';
import { colors } from '@/theme';

/**
 * Throws while rendering when tapped, to show the error boundary (e2e/flows/crash.yaml). Dev
 * builds and UI-test builds (`EXPO_PUBLIC_E2E`) only; anywhere else it sends you home.
 */
export default function Crash() {
  const [crashed, setCrashed] = useState(false);
  if (!__DEV__ && !process.env.EXPO_PUBLIC_E2E) return <Redirect href="/" />;
  if (crashed) throw new Error('Test crash (/dev/crash)');
  return (
    <View style={styles.screen}>
      <PillButton label="Crash" onPress={() => setCrashed(true)} {...testId('dev-crash')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ground,
  },
});
