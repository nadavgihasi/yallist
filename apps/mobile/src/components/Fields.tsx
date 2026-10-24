import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts } from '@/theme';

/** Labelled text input on a soft gray field. */
export function TextField({
  label,
  hint,
  ...input
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {hint && <Text style={styles.hint}> {hint}</Text>}
      </Text>
      <TextInput
        placeholderTextColor={colors.inkTertiary}
        style={styles.input}
        accessibilityLabel={label}
        {...input}
      />
    </View>
  );
}

/** Big "₪ 120" amount input. */
export function AmountField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.amountBox}>
        <Text style={styles.currency}>₪</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          inputMode="decimal"
          placeholder="0"
          placeholderTextColor={colors.inkTertiary}
          accessibilityLabel={label}
          style={styles.amountInput}
        />
      </View>
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: fieldStyles.label,
  hint: { fontFamily: fonts.regular, color: colors.inkSecondary },
  input: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(14,23,38,0.05)',
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.ink,
  },
  amountBox: {
    minHeight: 80,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(14,23,38,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currency: { fontFamily: fonts.display, fontSize: 30, color: colors.inkSecondary },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.ink,
  },
});
