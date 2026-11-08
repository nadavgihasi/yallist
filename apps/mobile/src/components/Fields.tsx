import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/Icon';
import { formatShort } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { colors, fonts, radius } from '@/theme';

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
  error,
  style,
  ...input
}: TextInputProps & {
  label: string;
  hint?: string;
  /** Shown under the field, e.g. when the text isn't a link it takes. */
  error?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {hint && <Text style={styles.hint}> {hint}</Text>}
      </Text>
      <Input accessibilityLabel={label} {...input} style={[styles.input, style]} />
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
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
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  size?: keyof typeof AMOUNT_SIZES;
  onSubmitEditing?: () => void;
  /** Shown under the field, e.g. when the text isn't a valid amount. */
  error?: string;
  testID?: string;
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
          {...testId(testID)}
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

/**
 * What a DateField shows: its label over the date, a calendar on the end. The whole tile is the
 * tap target; `active` is the hover/pressed look, `focused` the keyboard focus ring.
 */
export function DateTile({
  label,
  value,
  active,
  focused,
}: {
  label: string;
  value: string;
  active?: boolean;
  focused?: boolean;
}) {
  return (
    <>
      <View style={styles.dateTexts}>
        <Text style={styles.dateLabel}>{label}</Text>
        <Text style={styles.dateValue}>{formatShort(value)}</Text>
      </View>
      <Icon
        name="calendar"
        size={20}
        color={active || focused ? colors.primary : colors.inkMuted}
      />
    </>
  );
}

/** The DateField box; `dateTileStyles.active`/`focused` go on top. */
export const dateTileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.input,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.ground,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  active: { backgroundColor: colors.primaryTint },
  focused: { borderColor: colors.primary },
});

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
  dateTexts: { flex: 1, gap: 2 },
  dateLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  dateValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
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
