import { formatShekel, MAX_WEIGHT } from '@yallist/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { colors, radius, space, type } from '@/theme';

import type { TripView } from './derive';

/**
 * Who shares an expense by weight: each person with how many shares they take (an adult 2, a
 * child 1), a stepper to change it, and what that comes to.
 */
export function WeightList({
  view,
  shares,
  weights,
  owed,
  onChange,
}: {
  view: TripView;
  shares: string[];
  weights: Record<string, number>;
  /** What each person pays, from the same split; empty while the amount is missing. */
  owed: ReadonlyMap<string, number>;
  onChange: (weights: Record<string, number>) => void;
}) {
  const weightOf = (id: string) => weights[id] ?? 1;
  const set = (id: string, weight: number) => {
    const { [id]: _old, ...rest } = weights;
    onChange(weight === 1 ? rest : { ...rest, [id]: weight });
  };
  return (
    <View style={styles.list} {...testId('expense-weights')}>
      {shares.map((id) => {
        const weight = weightOf(id);
        const name = view.displayNameOf(id);
        const amount = owed.get(id);
        return (
          <View key={id} style={styles.row}>
            <Avatar person={view.avatarOf(id)} size={40} ring={false} />
            <View style={styles.who}>
              <Text style={styles.name} numberOfLines={1}>
                {view.nameOf(id)}
              </Text>
              {amount !== undefined && (
                <Text style={[styles.amount, weight > 1 && styles.amountMore]}>
                  {formatShekel(amount)}
                </Text>
              )}
            </View>
            <View style={styles.stepper}>
              <Step
                icon="minus"
                label={he.addExpense.weightLess(name)}
                disabled={weight <= 1}
                onPress={() => set(id, weight - 1)}
                testID={`weight-less-${id}`}
              />
              <Text style={styles.value} {...testId(`weight-${id}`)}>
                {weight}
              </Text>
              <Step
                icon="plus"
                label={he.addExpense.weightMore(name)}
                disabled={weight >= MAX_WEIGHT}
                onPress={() => set(id, weight + 1)}
                testID={`weight-more-${id}`}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Step({
  icon,
  label,
  disabled,
  onPress,
  testID,
}: {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.step,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.75 },
      ]}
      {...testId(testID)}
    >
      <Icon name={icon} size={18} color={colors.primaryStrong} />
    </Pressable>
  );
}

/** "₪60 לחלק", under the list: what one share of the rest comes to. */
export const perWeightText = (
  rest: number | undefined,
  shares: string[],
  weights: Record<string, number>,
) => {
  const total = shares.reduce((sum, id) => sum + (weights[id] ?? 1), 0);
  return rest && total > 0
    ? he.addExpense.weightsTotal(total, formatShekel(Math.floor(rest / total)))
    : undefined;
};

const styles = StyleSheet.create({
  list: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56 },
  who: { flex: 1, gap: 2 },
  name: { ...type.itemTitle, color: colors.ink },
  amount: { ...type.caption, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  amountMore: { fontFamily: type.itemTitle.fontFamily, color: colors.primaryStrong },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    padding: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  value: { ...type.stepNumber, color: colors.primaryStrong, minWidth: 28, textAlign: 'center' },
});
