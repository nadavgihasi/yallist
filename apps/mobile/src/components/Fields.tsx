import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts } from '@/theme';

/** Labelled text input on a soft gray field. */
export function TextField({
  label,
  hint,
  style,
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
        accessibilityLabel={label}
        {...input}
        style={[styles.input, style]}
      />
    </View>
  );
}

/** Box height, input, ₪ sign and radius: md = ItemSheetV2 price, lg = AddExpenseV2 amount. */
const AMOUNT_SIZES = {
  md: { box: 76, input: 38, sign: 30, radius: 22 },
  lg: { box: 84, input: 44, sign: 32, radius: 24 },
} as const;

/** Big "₪ 120" amount input. */
export function AmountField({
  label,
  value,
  onChangeText,
  size = 'md',
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  size?: keyof typeof AMOUNT_SIZES;
  onSubmitEditing?: () => void;
}) {
  const sz = AMOUNT_SIZES[size];
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.amountBox, { minHeight: sz.box, borderRadius: sz.radius }]}>
        <Text style={[styles.currency, { fontSize: sz.sign }]}>₪</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          inputMode="decimal"
          returnKeyType="done"
          placeholder="0"
          placeholderTextColor={colors.inkTertiary}
          accessibilityLabel={label}
          style={[styles.amountInput, { fontSize: sz.input }]}
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
