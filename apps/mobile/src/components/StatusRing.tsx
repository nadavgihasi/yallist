import { StyleSheet, View } from 'react-native';

import { Icon } from './Icon';

import { colors } from '@/theme';

export type RingState = 'open' | 'held' | 'done';

/**
 * The 28px check at the start of a list row (HANDOFF.md item states): dashed when nobody has it,
 * a solid ring when someone does, a filled brand circle with a check when it's done.
 */
export function StatusRing({ state, label }: { state: RingState; label?: string }) {
  if (state === 'done') {
    return (
      <View style={[styles.ring, styles.done]} accessibilityRole="image" accessibilityLabel={label}>
        <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={3} />
      </View>
    );
  }
  return (
    <View
      style={[styles.ring, styles.outline, state === 'open' && styles.dashed]}
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { backgroundColor: colors.brand },
  outline: { borderWidth: 2, borderColor: colors.inkMuted },
  dashed: { borderStyle: 'dashed' },
});
