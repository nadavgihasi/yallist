import { router, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { StateScreen } from './EmptyState';

import { he } from '@/i18n/he';
import { reportError } from '@/lib/sentry';
import { webDir } from '@/theme';

/**
 * What a render crash shows instead of a blank page (Expo Router's `ErrorBoundary` export, on the
 * root and `(app)` layouts): report it, then offer to try again or go home.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => reportError(error), [error]);
  return (
    // Under the root layout's boundary, the root's `dir` is gone with the rest of it.
    <View style={styles.root} {...webDir}>
      <StateScreen
        spot="signpost"
        {...he.states.crash}
        actions={[
          { label: he.errors.retry, onPress: () => void retry(), testID: 'error-retry' },
          {
            label: he.states.toTrips,
            onPress: () => {
              router.replace('/');
              void retry();
            },
            testID: 'error-home',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
