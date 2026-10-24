import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts } from '@/theme';

/**
 * Text input for Hebrew text. react-native-web sets `dir="auto"`, which makes an empty input LTR
 * (placeholder and caret on the left), so on web it's pinned to RTL. Native follows I18nManager.
 */
export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.inkFaint} {...webRtl} {...props} />;
}

const webRtl = Platform.OS === 'web' ? ({ dir: 'rtl' } as object) : {};

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
      <Input accessibilityLabel={label} {...input} style={[styles.input, style]} />
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
  error,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  size?: keyof typeof AMOUNT_SIZES;
  onSubmitEditing?: () => void;
  /** Shown under the field, e.g. when the text isn't a valid amount. */
  error?: string;
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
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={label}
          style={[styles.amountInput, { fontSize: sz.input }]}
        />
      </View>
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: fieldStyles.label,
  hint: { fontFamily: fonts.regular, color: colors.inkMuted },
  input: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.ground,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.ink,
  },
  amountBox: {
    minHeight: 80,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: colors.ground,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  error: { fontFamily: fonts.bold, fontSize: 13, color: colors.brandStrong },
  currency: { fontFamily: fonts.extraBold, fontSize: 30, color: colors.inkMuted },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.extraBold,
    fontSize: 40,
    color: colors.ink,
  },
});
