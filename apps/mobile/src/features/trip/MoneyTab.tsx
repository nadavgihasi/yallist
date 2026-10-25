import { useIsMutating } from '@tanstack/react-query';
import { formatShekel } from '@yallist/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, ListGroup } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he, joinNames } from '@/i18n/he';
import { useReceiptUpload } from '@/state/receipts';
import { tripKey, useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

import type { TripView } from './derive';

export function MoneyTab({ data, view, me }: { data: TripData; view: TripView; me: string }) {
  const act = useTripAction(data.trip.id);
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const organizer = view.memberById.get(me)?.role === 'organizer';
  // Transfers come from the API: until it answers, a second tap would pay twice.
  const saving = useIsMutating({ mutationKey: tripKey(data.trip.id) }) > 0;
  const sum = (xs: { amountAgorot: number }[]) => xs.reduce((n, x) => n + x.amountAgorot, 0);
  const names = (ids: string[]) => joinNames([...new Set(ids)].map(view.displayNameOf));

  // The greedy matcher can split my debt across several people, so show all of it.
  const myOpen = view.transfers.filter((t) => t.from === me);
  const myPaid = data.payments.filter((p) => p.fromUser === me);
  const toMe = view.transfers.filter((t) => t.to === me);
  const myUnconfirmed = myPaid.filter((p) => p.status === 'marked');

  let title: string = he.money.nothingToPay;
  let amount = 0;
  if (myOpen.length > 0) {
    title = he.money.payTo(names(myOpen.map((t) => t.to)));
    amount = sum(myOpen);
  } else if (myPaid.length > 0) {
    title = he.money.paidTo(names(myPaid.map((p) => p.toUser)));
    amount = sum(myPaid);
  } else if (toMe.length > 0) {
    title = he.money.getFrom(names(toMe.map((t) => t.from)));
    amount = sum(toMe);
  }

  const markPaid = () => {
    myOpen.forEach((t) => act({ type: 'markPayment', toUser: t.to, amountAgorot: t.amountAgorot }));
    showToast(he.money.markedToast(formatShekel(sum(myOpen))));
  };
  // A payment the receiver already confirmed stays.
  const unmarkPaid = () =>
    myUnconfirmed.forEach((p) => act({ type: 'deletePayment', paymentId: p.id }));

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
            <>
              <View style={styles.heroStatus}>
                <Icon name="check" size={18} color={colors.primaryStrong} />
                <Text style={styles.heroText}>
                  {myUnconfirmed.length > 0 ? he.money.waiting : he.money.received}
                </Text>
              </View>
              {myUnconfirmed.length > 0 && (
                <PillButton
                  label={he.money.unmark}
                  variant="quiet"
                  size="md"
                  wide
                  disabled={saving}
                  onPress={unmarkPaid}
                />
              )}
            </>
          )
        )}
      </Card>

      {view.transfers.length === 0 ? (
        // With no expenses yet, the empty expenses card below says it all.
        data.expenses.length > 0 && (
          <EmptyState title={he.money.settled} text={he.money.settledText} />
        )
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

      {data.payments.length > 0 && (
        <ListGroup title={he.money.payments}>
          {data.payments.map((p) => {
            const waiting = p.status === 'marked';
            return (
              <View key={p.id} style={styles.transfer}>
                <View style={styles.transferWho}>
                  <Avatar person={view.avatarOf(p.fromUser)} ring={false} />
                  <Text style={styles.transferName}>{view.nameOf(p.fromUser)}</Text>
                  <Icon name="arrowEnd" size={18} color={colors.inkFaint} />
                  <Avatar person={view.avatarOf(p.toUser)} ring={false} />
                  <Text style={styles.transferName}>{view.nameOf(p.toUser)}</Text>
                </View>
                <View style={styles.paymentEnd}>
                  <Text style={styles.amount}>{formatShekel(p.amountAgorot)}</Text>
                  <Text style={styles.expenseWho}>
                    {waiting ? he.money.paymentWaiting : he.money.paymentConfirmed}
                  </Text>
                </View>
                {waiting && p.toUser === me && (
                  <PillButton
                    label={he.money.confirmReceived}
                    size="sm"
                    disabled={saving}
                    onPress={() => act({ type: 'confirmPayment', paymentId: p.id })}
                  />
                )}
              </View>
            );
          })}
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
              <ReceiptButton tripId={data.trip.id} expense={e} />
              {/* The API also lets whoever added it delete it, but the app doesn't know who that was. */}
              {(e.paidBy === me || organizer) && (
                <PillButton
                  label={confirmDelete === e.id ? he.money.confirmDelete : he.money.deleteExpense}
                  variant={confirmDelete === e.id ? 'danger' : 'quiet'}
                  size="sm"
                  onPress={() => {
                    if (confirmDelete !== e.id) return setConfirmDelete(e.id);
                    act({ type: 'deleteExpense', expenseId: e.id });
                    setConfirmDelete(undefined);
                  }}
                />
              )}
            </View>
          ))}
        </ListGroup>
      )}
    </View>
  );
}

/** Opens the expense's receipt, or adds one; shows an upload in flight or failed. */
function ReceiptButton({
  tripId,
  expense,
}: {
  tripId: string;
  expense: TripData['expenses'][number];
}) {
  const upload = useReceiptUpload(expense.id);
  const percent = Math.round((upload?.progress ?? 0) * 100);
  const label = upload
    ? upload.failed
      ? he.receipt.failed
      : he.receipt.uploading(percent)
    : expense.hasReceipt
      ? he.receipt.open
      : he.receipt.add;
  const color = upload?.failed
    ? colors.brandStrong
    : expense.hasReceipt
      ? colors.primaryStrong
      : colors.inkFaint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() =>
        router.push({
          pathname: '/trips/[tripId]/expenses/[expenseId]/receipt',
          params: { tripId, expenseId: expense.id },
        })
      }
      style={({ pressed }) => [
        styles.receipt,
        expense.hasReceipt && { backgroundColor: colors.primaryTint },
        pressed && { opacity: 0.75 },
      ]}
    >
      {upload && !upload.failed ? (
        <Text style={styles.receiptPercent}>{percent}%</Text>
      ) : (
        <Icon name="receipt" size={20} color={color} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  receipt: {
    width: space.touch,
    height: space.touch,
    borderRadius: space.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptPercent: { ...type.caption, color: colors.primaryStrong },
  heroTitle: { ...type.caption, color: colors.inkMuted },
  heroAmount: { ...type.bigNumber, color: colors.ink },
  heroText: { ...type.caption, color: colors.inkMuted },
  heroButton: { marginTop: space[3] },
  heroStatus: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[3] },
  paymentEnd: { alignItems: 'flex-end' },
  transfer: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: space.touch },
  transferWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  transferName: { ...type.itemTitle, color: colors.ink },
  amount: { ...type.itemTitle, color: colors.ink },
  expense: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space.touch },
  expenseBody: { flex: 1, gap: space[1] },
  expenseWhat: { ...type.itemTitle, color: colors.ink },
  expenseWho: { ...type.caption, color: colors.inkMuted },
});
