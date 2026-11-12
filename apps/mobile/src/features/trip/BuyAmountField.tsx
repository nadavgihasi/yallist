import { BUY_UNITS, type BuyAmount } from '@yallist/domain';
import { StyleSheet, Text, View } from 'react-native';

import { ChipGroup, FilterChip } from '@/components/Chips';
import { Input, fieldStyles } from '@/components/Fields';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { colors, fonts } from '@/theme';

/**
 * The buy form's "how much": a number and a unit chip (`2` + `ק״ג`). Both are optional; tapping
 * the picked unit again unpicks it. A unit the item already had that isn't a chip (a template's
 * `שישיות`) is offered as one more chip, so editing keeps it.
 */
export function BuyAmountField({
  value,
  error,
  onChange,
  onSubmitEditing,
}: {
  value: BuyAmount;
  /** Why the amount can't be saved, shown under it. */
  error?: string;
  onChange: (value: BuyAmount) => void;
  onSubmitEditing?: () => void;
}) {
  const units: string[] = [...BUY_UNITS];
  if (value.unit && !units.includes(value.unit)) units.push(value.unit);
  return (
    <View style={styles.wrap}>
      <Text style={fieldStyles.label}>{he.addItem.howMany}</Text>
      <Input
        value={value.amount}
        onChangeText={(amount) => onChange({ ...value, amount })}
        onSubmitEditing={onSubmitEditing}
        inputMode="decimal"
        returnKeyType="done"
        placeholder={he.addItem.amountPlaceholder}
        accessibilityLabel={he.addItem.amount}
        {...testId('item-form-amount')}
        style={styles.input}
      />
      <ChipGroup label={he.addItem.unit}>
        {units.map((unit) => (
          <FilterChip
            key={unit}
            label={unit}
            selected={unit === value.unit}
            onPress={() => onChange({ ...value, unit: unit === value.unit ? undefined : unit })}
          />
        ))}
      </ChipGroup>
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  input: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.ground,
    fontFamily: fonts.regular,
    fontSize: 19,
    color: colors.ink,
  },
  error: { fontFamily: fonts.bold, fontSize: 13, color: colors.brandStrong },
});
