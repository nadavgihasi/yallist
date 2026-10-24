import { formatShekel } from '@yallist/domain';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { EmptyState, ListGroup, SectionHeader } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { newId } from '@/lib/id';
import { useDispatch } from '@/state/store';
import type { TripData } from '@/state/types';
import { colors, fonts, radius } from '@/theme';

import type { TripView } from './derive';

export function MoneyTab({ data, view, me }: { data: TripData; view: TripView; me: string }) {
  const dispatch = useDispatch();
  const tripId = data.trip.id;
  const myTransfer = view.transfers.find((t) => t.from === me);
  const owedToMe = view.transfers
    .filter((t) => t.to === me)
    .reduce((sum, t) => sum + t.amountAgorot, 0);
  const myPayments = data.payments.filter((p) => p.fromUser === me);

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          {myTransfer
            ? he.money.payTo(view.nameOf(myTransfer.to))
            : owedToMe > 0
              ? he.money.getFrom
              : he.money.nothingToPay}
        </Text>
        <Text style={styles.heroAmount}>{formatShekel(myTransfer?.amountAgorot ?? owedToMe)}</Text>
        <Text style={styles.heroText}>
          {he.money.share(formatShekel(view.totalSpent), view.activeIds.length)}
        </Text>
        {myTransfer && (
          <PillButton
            label={he.money.markPaid}
            variant="soft"
            size="lg"
            wide
            style={styles.heroButton}
            onPress={() =>
              dispatch({
                type: 'markPayment',
                tripId,
                id: newId(),
                from: me,
                to: myTransfer.to,
                amount: myTransfer.amountAgorot,
              })
            }
          />
        )}
        {myPayments.map((p) => (
          <View key={p.id} style={styles.paidRow}>
            <Icon name="check" size={18} color={colors.success} />
            <Text style={styles.paidText}>
              {he.money.paidTo(view.nameOf(p.toUser), formatShekel(p.amountAgorot))}
            </Text>
            <PillButton
              label={he.money.undo}
              variant="quiet"
              onPress={() => dispatch({ type: 'deletePayment', tripId, paymentId: p.id })}
            />
          </View>
        ))}
      </View>

      <SectionHeader title={he.money.transfers} />
      {view.transfers.length === 0 ? (
        <EmptyState title={he.money.settled} text={he.money.settledText} />
      ) : (
        <ListGroup>
          {view.transfers.map((t) => (
            <View key={`${t.from}-${t.to}`} style={styles.transfer}>
              <View style={styles.transferWho}>
                <Avatar person={view.avatarOf(t.from)} ring={false} />
                <Text style={styles.transferName}>{view.nameOf(t.from)}</Text>
                <Icon name="arrowEnd" size={18} color={colors.inkTertiary} />
                <Avatar person={view.avatarOf(t.to)} ring={false} />
                <Text style={styles.transferName}>{view.nameOf(t.to)}</Text>
              </View>
              <Text style={[styles.amount, t.from === me && { color: colors.accent }]}>
                {formatShekel(t.amountAgorot)}
              </Text>
            </View>
          ))}
        </ListGroup>
      )}

      <SectionHeader
        title={he.money.expenses}
        aside={he.money.total(formatShekel(view.totalSpent))}
      />
      {data.expenses.length === 0 ? (
        <EmptyState title={he.money.expenses} text={he.money.noExpenses} />
      ) : (
        <ListGroup inset={68}>
          {data.expenses.map((e) => (
            <View key={e.id} style={styles.expense}>
              <Avatar person={view.avatarOf(e.paidBy)} size={40} ring={false} />
              <View style={styles.expenseBody}>
                <Text style={styles.expenseWhat}>{e.description}</Text>
                <Text style={styles.expenseWho}>
                  {view.nameOf(e.paidBy)}
                  {e.shares.length < view.activeIds.length && ` · ${e.shares.length} מתחלקים`}
                </Text>
              </View>
              <Text style={styles.amount}>{formatShekel(e.amountAgorot)}</Text>
            </View>
          ))}
        </ListGroup>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20, paddingHorizontal: 16, gap: 16 },
  hero: {
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    gap: 6,
  },
  heroTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSecondary },
  heroAmount: { fontFamily: fonts.displayBold, fontSize: 60, lineHeight: 64, color: colors.ink },
  heroText: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSecondary },
  heroButton: { marginTop: 12 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  paidText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.success },
  transfer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  transferWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  transferName: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  amount: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  expense: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  expenseBody: { flex: 1, gap: 2 },
  expenseWhat: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  expenseWho: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
});
