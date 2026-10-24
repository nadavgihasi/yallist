import { Pressable, StyleSheet, Text, View } from 'react-native';

import { he } from '@/i18n/he';
import { addDays, formatShort } from '@/lib/dates';
import { colors, fonts } from '@/theme';

/**
 * Native fallback until a date-picker module is added: step a day back or forward.
 * The web build uses DateField.web.tsx with the browser's picker.
 */
export function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (iso: string) => void;
}) {
  const earlier = addDays(value, -1);
  const canGoEarlier = !min || earlier >= min;
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {/* RTL: the first child sits on the right, so "earlier" points right. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${he.dates.dayEarlier}`}
          disabled={!canGoEarlier}
          onPress={() => onChange(earlier)}
          style={[styles.stepButton, !canGoEarlier && { opacity: 0.3 }]}
        >
          <Text style={styles.step}>›</Text>
        </Pressable>
        <Text style={styles.value}>{formatShort(value)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${he.dates.dayLater}`}
          onPress={() => onChange(addDays(value, 1))}
          style={styles.stepButton}
        >
          <Text style={styles.step}>‹</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(14,23,38,0.05)',
    justifyContent: 'center',
    gap: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
  value: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  step: { fontFamily: fonts.semibold, fontSize: 22, color: colors.accent },
});
