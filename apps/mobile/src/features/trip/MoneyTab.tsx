import { useIsMutating } from '@tanstack/react-query';
import { formatShekel } from '@yallist/domain';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, ListGroup } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { he, joinNames } from '@/i18n/he';
import { tripKey, useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

import type { TripView } from './derive';

export function MoneyTab({ data, view, me }: { data: TripData; view: TripView; me: string }) {
  const act = useTripAction(data.trip.id);
  // Transfers come from the API: until it answers, a second tap would pay twice.
  const saving = useIsMutating({ mutationKey: tripKey(data.trip.id) }) > 0;
  const sum = (xs: { amountAgorot: number }[]) => xs.reduce((n, x) => n + x.amountAgorot, 0);
  const names = (ids: string[]) => joinNames([...new Set(ids)].map(view.displayNameOf));

  // The greedy matcher can split my debt across several people, so show all of it.
  const myOpen = view.transfers.filter((t) => t.from === me);
  const myPaid = data.payments.filter((p) => p.fromUser === me);
  const owedToMe = sum(view.transfers.filter((t) => t.to === me));

  let title: string = he.money.nothingToPay;
  let amount = 0;
  if (myOpen.length > 0) {
    title = he.money.payTo(names(myOpen.map((t) => t.to)));
    amount = sum(myOpen);
  } else if (myPaid.length > 0) {
    title = he.money.paidTo(names(myPaid.map((p) => p.toUser)));
    amount = sum(myPaid);
  } else if (owedToMe > 0) {
    title = he.money.getFrom;
    amount = owedToMe;
  }

  const markPaid = () =>
    myOpen.forEach((t) => act({ type: 'markPayment', toUser: t.to, amountAgorot: t.amountAgorot }));
  // A payment the receiver already confirmed stays.
  const unmarkPaid = () =>
    myPaid
      .filter((p) => p.status === 'marked')
      .forEach((p) => act({ type: 'deletePayment', paymentId: p.id }));

  return (
    <View style={styles.wrap}>
      <Card gap={space[1]}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroAmount}>{formatShekel(amount)}</Text>
        {view.totalSpent > 0 && (
          <Text style={styles.heroText}>
            {he.money.share(formatShekel(view.myShare), formatShekel(view.totalSpent))}
          </Text>
        )}
        {myOpen.length > 0 ? (
          <PillButton
            label={he.money.markPaid}
            variant="soft"
            size="md"
            wide
            style={styles.heroButton}
            disabled={saving}
            onPress={markPaid}
          />
        ) : (
          myPaid.length > 0 && (
            <PillButton
              label={he.money.markedPaid}
              variant="soft"
              size="md"
              wide
              icon={<Icon name="check" size={18} color={colors.primaryStrong} />}
              accessibilityState={{ checked: true }}
              style={styles.heroButton}
              disabled={saving}
              onPress={unmarkPaid}
            />
          )
        )}
      </Card>

      {view.transfers.length === 0 ? (
        <EmptyState title={he.money.settled} text={he.money.settledText} />
      ) : (
        <ListGroup title={he.money.transfers}>
          {view.transfers.map((t) => (
            <View key={`${t.from}-${t.to}`} style={styles.transfer}>
              <View style={styles.transferWho}>
                <Avatar person={view.avatarOf(t.from)} ring={false} />
                <Text style={styles.transferName}>{view.nameOf(t.from)}</Text>
                <Icon name="arrowEnd" size={18} color={colors.inkFaint} />
                <Avatar person={view.avatarOf(t.to)} ring={false} />
                <Text style={styles.transferName}>{view.nameOf(t.to)}</Text>
              </View>
              <Text style={[styles.amount, t.from === me && { color: colors.brandStrong }]}>
                {formatShekel(t.amountAgorot)}
              </Text>
            </View>
          ))}
        </ListGroup>
      )}

      {data.expenses.length === 0 ? (
        <EmptyState title={he.money.noExpenses} text={he.money.noExpensesText} />
      ) : (
        <ListGroup title={he.money.expenses} aside={he.money.total(formatShekel(view.totalSpent))}>
          {data.expenses.map((e) => (
            <View key={e.id} style={styles.expense}>
              <Avatar person={view.avatarOf(e.paidBy)} size={40} ring={false} />
              <View style={styles.expenseBody}>
                <Text style={styles.expenseWhat}>{e.description}</Text>
                <Text style={styles.expenseWho}>
                  {view.nameOf(e.paidBy)}
                  {e.shares.length < view.activeIds.length &&
                    ` · ${he.money.sharedBy(e.shares.length)}`}
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
  wrap: { gap: space[4] },
  heroTitle: { ...type.caption, color: colors.inkMuted },
  heroAmount: { ...type.bigNumber, color: colors.ink },
  heroText: { ...type.caption, color: colors.inkMuted },
  heroButton: { marginTop: space[3] },
  transfer: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: space.touch },
  transferWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  transferName: { ...type.itemTitle, color: colors.ink },
  amount: { ...type.itemTitle, color: colors.ink },
  expense: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space.touch },
  expenseBody: { flex: 1, gap: space[1] },
  expenseWhat: { ...type.itemTitle, color: colors.ink },
  expenseWho: { ...type.caption, color: colors.inkMuted },
});
