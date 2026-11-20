import { formatShekel } from '@yallist/domain';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { ListGroup } from '@/components/ListGroup';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import type { TripData } from '@/state/types';
import { colors, radius, space, type } from '@/theme';

import { balanceBreakdown } from './balanceDetail';
import type { TripView } from './derive';

/** Owed money is teal, owing orange, settled muted; each also says it in words. */
export function balanceState(balance: number) {
  if (balance > 0) return { label: he.balances.gets, color: colors.owed };
  if (balance < 0) return { label: he.balances.owes, color: colors.brandStrong };
  return { label: he.balances.settled, color: colors.inkMuted };
}

/**
 * Everyone's balance, with what they paid and their share; mine stands out. Former members show
 * while they still have one. Each row opens what the balance is made of.
 */
export function BalanceList({ data, view, me }: { data: TripData; view: TripView; me: string }) {
  const ids = [
    ...view.activeIds,
    ...data.members
      .filter((m) => m.status === 'removed' && (data.balances[m.userId] ?? 0) !== 0)
      .map((m) => m.userId),
  ];
  return (
    <ListGroup title={he.balances.title}>
      {ids.map((id) => {
        const balance = data.balances[id] ?? 0;
        const parts = balanceBreakdown(id, data.expenses, data.payments);
        const state = balanceState(balance);
        const amount = formatShekel(Math.abs(balance));
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={he.balances.open(view.displayNameOf(id), amount, state.label)}
            onPress={() =>
              router.push({
                pathname: '/trips/[tripId]/balances/[userId]',
                params: { tripId: data.trip.id, userId: id },
              })
            }
            style={({ pressed }) => [
              styles.row,
              id === me && styles.mine,
              pressed && { opacity: 0.75 },
            ]}
            {...testId(`balance-${id}`)}
          >
            <Avatar person={view.avatarOf(id)} size={40} ring={false} />
            <View style={styles.who}>
              <Text style={styles.name} numberOfLines={1}>
                {view.nameOf(id)}
              </Text>
              <Text style={styles.caption} numberOfLines={2}>
                {he.balances.paidAndShare(
                  formatShekel(parts.paidTotal),
                  formatShekel(parts.owedTotal),
                )}
              </Text>
            </View>
            <View style={styles.end}>
              {/* What's left to do, then how much: ״להעביר ₪551.03״ reads in order. */}
              <Text style={[styles.state, { color: state.color }]}>{state.label}</Text>
              <Text style={[styles.amount, { color: state.color }]}>{amount}</Text>
            </View>
            <Icon
              name="chevronEnd"
              size={18}
              color={id === me ? colors.primaryStrong : colors.inkFaint}
            />
          </Pressable>
        );
      })}
      <Text style={styles.hint}>{he.balances.hint}</Text>
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 56,
    paddingHorizontal: space[2],
    marginHorizontal: -space[2],
    borderRadius: radius.input,
  },
  mine: { backgroundColor: colors.primaryTint },
  who: { flex: 1, gap: 2 },
  name: { ...type.itemTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  end: { alignItems: 'flex-end' },
  amount: { ...type.itemTitle, fontVariant: ['tabular-nums'] },
  state: { ...type.caption, fontSize: 13, lineHeight: 18 },
  hint: { ...type.caption, color: colors.inkMuted },
});
