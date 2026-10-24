import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatRange, formatShort } from '@/lib/dates';
import { colors, fonts } from '@/theme';

/** Web: a native date input laid transparently over the formatted label, so the whole tile opens the picker. */
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
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{formatShort(value)}</Text>
      {createElement('input', {
        type: 'date',
        value,
        min,
        'aria-label': `${label}: ${formatRange(value, value)}`,
        // `min` only limits the picker; typed dates still need clamping.
        onChange: (e: { target: { value: string } }) => {
          const next = e.target.value;
          if (next) onChange(min && next < min ? min : next);
        },
        style: {
          position: 'absolute',
          inset: 0,
          opacity: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          border: 'none',
        },
      })}
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
    backgroundColor: colors.ground,
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  value: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
});
