import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/** Brand-orange progress bar on a `ground` track. */
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
  track: { height: 8, borderRadius: 4, backgroundColor: colors.ground, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.brand },
});
