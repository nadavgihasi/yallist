import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatShort } from '@/lib/dates';
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
        'aria-label': label,
        onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
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
    backgroundColor: 'rgba(14,23,38,0.05)',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
  value: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
});
