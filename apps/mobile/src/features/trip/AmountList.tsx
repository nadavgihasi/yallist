import { parseShekel } from '@yallist/domain';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { colors, fonts, space, type } from '@/theme';

import type { TripView } from './derive';

/**
 * Splitwise's "exact amounts": everyone on a row of their own with their part typed beside them.
 * Someone left empty pays nothing.
 */
export function AmountList({
  view,
  ids,
  amounts,
  onChange,
}: {
  view: TripView;
  /** Who's listed: the trip's members, and anyone who had a part before they left. */
  ids: readonly string[];
  amounts: Record<string, string>;
  onChange: (amounts: Record<string, string>) => void;
}) {
  return (
    <View style={styles.list} {...testId('expense-amounts')}>
      {ids.map((id) => {
        const value = amounts[id] ?? '';
        const bad = !!value.trim() && !parseShekel(value);
        return (
          <View key={id} style={styles.row}>
            <Avatar person={view.avatarOf(id)} size={40} ring={false} />
            <Text style={styles.name} numberOfLines={1}>
              {view.nameOf(id)}
            </Text>
            <View style={[styles.box, bad && styles.boxBad]}>
              <Text style={styles.currency}>₪</Text>
              <TextInput
                value={value}
                onChangeText={(text) => onChange({ ...amounts, [id]: text })}
                inputMode="decimal"
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel={he.addExpense.amountOf(view.displayNameOf(id))}
                {...testId(`expense-amount-${id}`)}
                style={styles.input}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56 },
  name: { ...type.itemTitle, color: colors.ink, flex: 1 },
  box: {
    width: 128,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ground,
    backgroundColor: colors.ground,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boxBad: { borderColor: colors.brandStrong },
  currency: { fontFamily: fonts.bold, fontSize: 18, color: colors.inkMuted },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
});
