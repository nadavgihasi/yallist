import { formatShekel } from '@yallist/domain';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { balanceBreakdown } from '@/features/trip/balanceDetail';
import { balanceState } from '@/features/trip/BalanceList';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { deriveTrip } from '@/features/trip/derive';
import { he } from '@/i18n/he';
import { rtl } from '@/lib/bidi';
import { formatShort, spentDay } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useMe } from '@/state/store';
import { useTrip } from '@/state/trips';
import { colors, radius, space, type } from '@/theme';

/**
 * Why someone's balance is what it is: what they paid, minus their share, plus and minus the
 * payments, then each expense and payment behind it. Each expense opens its own screen.
 */
export default function BalanceDetail() {
  const { tripId, userId } = useLocalSearchParams<{ tripId: string; userId: string }>();
  const data = useTrip(tripId);
  const me = useMe().userId;
  const close = useCloseSheet(tripId);
  if (!data) return null;
  const view = deriveTrip(data, me);
  const parts = balanceBreakdown(userId, data.expenses, data.payments);
  const balance = data.balances[userId] ?? parts.balance;
  const mine = userId === me;
  const state = balanceState(balance);
  const label = mine
    ? balance > 0
      ? he.balances.getsMine
      : balance < 0
        ? he.balances.owesMine
        : state.label
    : state.label;
  const openExpense = (expenseId: string) =>
    router.push({
      pathname: '/trips/[tripId]/expenses/[expenseId]',
      params: { tripId, expenseId },
    });

  return (
    <Sheet
      title={mine ? he.balances.mine : he.balances.of(view.displayNameOf(userId))}
      onClose={close}
      gap={space[5]}
    >
      <View style={styles.head} {...testId('balance-detail')}>
        <Avatar person={view.avatarOf(userId)} size={56} ring={false} />
        <View style={styles.headText}>
          <Text style={[styles.big, { color: state.color }]}>
            {formatShekel(Math.abs(balance))}
          </Text>
          <Text style={[styles.caption, { color: state.color }]}>{label}</Text>
        </View>
      </View>

      <View style={styles.sum}>
        <SumLine label={he.balances.paid} amount={parts.paidTotal} />
        <SumLine label={he.balances.share} amount={-parts.owedTotal} />
        {parts.sentTotal > 0 && <SumLine label={he.balances.sent} amount={parts.sentTotal} />}
        {parts.receivedTotal > 0 && (
          <SumLine label={he.balances.received} amount={-parts.receivedTotal} />
        )}
        <View style={styles.rule} />
        <View style={styles.sumLine}>
          <Text style={styles.title}>{label}</Text>
          <Text style={[styles.title, { color: state.color }]}>
            {formatShekel(Math.abs(balance))}
          </Text>
        </View>
      </View>

      {parts.paid.length > 0 && (
        <Section title={he.balances.paidList} total={parts.paidTotal}>
          {parts.paid.map(({ expense, amountAgorot }) => (
            <Line
              key={expense.id}
              title={expense.description}
              caption={`${formatShort(spentDay(expense))} · ${he.money.sharedBy(expense.shares.length)}`}
              amount={amountAgorot}
              onPress={() => openExpense(expense.id)}
            />
          ))}
        </Section>
      )}

      {parts.owed.length > 0 && (
        <Section title={he.balances.shareList} total={parts.owedTotal}>
          {parts.owed.map(({ expense, amountAgorot }) => (
            <Line
              key={expense.id}
              title={expense.description}
              caption={he.balances.paidBy(
                view.nameOf(expense.paidBy),
                formatShekel(expense.amountAgorot),
              )}
              amount={amountAgorot}
              onPress={() => openExpense(expense.id)}
            />
          ))}
        </Section>
      )}

      {parts.sent.length + parts.received.length > 0 && (
        <Section title={he.balances.payments}>
          {[...parts.sent, ...parts.received].map((p) => (
            <Line
              key={p.id}
              title={
                p.fromUser === userId
                  ? he.balances.paymentTo(view.displayNameOf(p.toUser))
                  : he.balances.paymentFrom(view.displayNameOf(p.fromUser))
              }
              caption={formatShort(spentDay({ createdAt: p.createdAt }))}
              amount={p.amountAgorot}
              onPress={() =>
                router.push({
                  pathname: '/trips/[tripId]/payments/[paymentId]',
                  params: { tripId, paymentId: p.id },
                })
              }
            />
          ))}
        </Section>
      )}

      {parts.paid.length + parts.owed.length + parts.sent.length + parts.received.length === 0 && (
        <Text style={styles.caption}>{he.balances.nothing}</Text>
      )}
    </Sheet>
  );
}

function SumLine({ label, amount }: { label: string; amount: number }) {
  return (
    <View style={styles.sumLine}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumAmount}>
        {amount < 0 ? `−${formatShekel(-amount)}` : formatShekel(amount)}
      </Text>
    </View>
  );
}

function Section({
  title,
  total,
  children,
}: {
  title: string;
  total?: number;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.heading} accessibilityRole="header">
          {title}
        </Text>
        {total !== undefined && <Text style={styles.heading}>{formatShekel(total)}</Text>}
      </View>
      {children}
    </View>
  );
}

function Line({
  title,
  caption,
  amount,
  onPress,
}: {
  title: string;
  caption: string;
  amount: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.line, pressed && { opacity: 0.75 }]}
      {...testId('balance-line')}
    >
      <View style={styles.lineText}>
        <Text style={[styles.title, styles.rtl]} numberOfLines={1}>
          {rtl(title)}
        </Text>
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <Text style={styles.amount}>{formatShekel(amount)}</Text>
      <Icon name="chevronEnd" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  headText: { flex: 1, alignItems: 'flex-end' },
  big: { ...type.stat },
  sum: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.input,
    padding: space[4],
    gap: space[1],
  },
  sumLine: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  sumLabel: { ...type.caption, color: colors.ink },
  sumAmount: { ...type.itemTitle, color: colors.ink, fontVariant: ['tabular-nums'] },
  rule: { height: 1, backgroundColor: colors.primaryStrong, opacity: 0.25, marginVertical: 2 },
  section: { gap: space[1] },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between' },
  heading: { ...type.label, color: colors.inkMuted },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 52 },
  lineText: { flex: 1, gap: 2 },
  title: { ...type.itemTitle, color: colors.ink },
  rtl: { writingDirection: 'rtl' },
  caption: { ...type.caption, color: colors.inkMuted },
  amount: { ...type.itemTitle, color: colors.ink, fontVariant: ['tabular-nums'] },
});
