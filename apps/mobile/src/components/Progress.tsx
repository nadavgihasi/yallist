import { StyleSheet, View } from 'react-native';

import { progress } from '@/theme';

/** Brand-orange progress bar on a `line` track. */
export function Progress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <View style={[styles.fill, { width: `${(100 * done) / total}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: progress.track, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: progress.fill },
});
