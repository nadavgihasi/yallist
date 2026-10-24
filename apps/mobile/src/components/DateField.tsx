import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={`${label}: יום אחד קודם`}
          disabled={!!min && earlier < min}
          onPress={() => onChange(earlier)}
        >
          <Text style={styles.step}>‹</Text>
        </Pressable>
        <Text style={styles.value}>{formatShort(value)}</Text>
        <Pressable
          accessibilityLabel={`${label}: יום אחד אחרי`}
          onPress={() => onChange(addDays(value, 1))}
        >
          <Text style={styles.step}>›</Text>
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
  step: { fontFamily: fonts.semibold, fontSize: 22, color: colors.accent, paddingHorizontal: 8 },
});
