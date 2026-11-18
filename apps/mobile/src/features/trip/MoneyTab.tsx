import { useIsMutating } from '@tanstack/react-query';
import { formatShekel, owedShares } from '@yallist/domain';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Callout } from '@/components/Callout';
import { SubTabs } from '@/components/Controls';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Card, ListGroup } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he, joinNames } from '@/i18n/he';
import { formatMoment, today } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useReceiptUpload } from '@/state/receipts';
import { tripKey, useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

import { balanceState, BalanceList } from './BalanceList';
import type { TripView } from './derive';
import { dayLabel, expenseDays } from './expenseDays';
import { MONEY_PARTS, type MoneyPart } from './parts';
import { PayRow } from './PayRow';
import { expenseKey } from './reveal';
import { RevealTarget } from './RevealTarget';
import { sharedText } from './runSplit';

/**
 * The money tab, in two views (`part`): the expenses, and settling up (my number, who pays
 * whom, the payments). The trip screen keeps the view in the URL.
 */
export function MoneyTab({
  data,
  view,
  me,
  part,
  onPart,
}: {
  data: TripData;
  view: TripView;
  me: string;
  part: MoneyPart;
  onPart: (part: MoneyPart) => void;
}) {
  const act = useTripAction(data.trip.id);
  // Transfers come from the API: until it answers, a second tap would pay twice.
  const saving = useIsMutating({ mutationKey: tripKey(data.trip.id) }) > 0;
  const sum = (xs: { amountAgorot: number }[]) => xs.reduce((n, x) => n + x.amountAgorot, 0);
  const names = (ids: string[]) => joinNames([...new Set(ids)].map(view.displayNameOf));

  // The greedy matcher can split my debt across several people, so show all of it.
  const myOpen = view.transfers.filter((t) => t.from === me);
  const toMe = view.transfers.filter((t) => t.to === me);
  const myPaid = data.payments.filter((p) => p.fromUser === me);

  let title: string = he.money.nothingToPay;
  let amount = 0;
  if (myOpen.length > 0) {
    title = he.money.payTo(names(myOpen.map((t) => t.to)));
    amount = sum(myOpen);
  } else if (toMe.length > 0) {
    title = he.money.getFrom(names(toMe.map((t) => t.from)));
    amount = sum(toMe);
  } else if (myPaid.length > 0) {
    title = he.money.paidTo(names(myPaid.map((p) => p.toUser)));
    amount = sum(myPaid);
  }

  // Anyone records any payment, and it counts at once: nobody confirms it.
  const record = (fromUser: string, toUser: string, amountAgorot: number, toast: string) => {
    act({ type: 'recordPayment', fromUser, toUser, amountAgorot });
    showToast(toast, 'success');
  };
  // Square: nothing open either way (what I paid is already in the transfers).
  const square = myOpen.length === 0 && toMe.length === 0;
  // Owed money with nowhere to receive it: ask for a number once there's something to receive.
  const needsPhone = toMe.length > 0 && !view.memberById.get(me)?.paymentPhone;

  const tabs = (
    <SubTabs
      options={MONEY_PARTS.map((p) => ({
        value: p,
        label:
          p === 'expenses'
            ? he.trip.tabCount(he.money.parts.expenses, data.expenses.length)
            : he.money.parts.settle,
      }))}
      value={part}
      onChange={onPart}
      testID="money-part"
    />
  );

  if (part === 'expenses') {
    return (
      <View style={styles.wrap}>
        {tabs}
        <Expenses data={data} view={view} me={me} onSettle={() => onPart('settle')} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {tabs}
      <Card gap={space[1]}>
        {square ? (
          // Nothing to pay or receive: the done check, as on a packed item, instead of ₪0.
          <View style={styles.square}>
            <View style={styles.squareCheck}>
              <Icon name="check" size={28} color={colors.onPrimary} />
            </View>
            <Text style={styles.squareTitle}>{he.money.allSquare}</Text>
            <Text style={styles.heroText}>{he.money.allSquareText}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.heroTitle}>{title}</Text>
            {/* Owing in orange, owed in teal: the same colours as the balances below. */}
            <Text
              style={[
                styles.heroAmount,
                { color: myOpen.length > 0 ? colors.brandStrong : colors.owed },
              ]}
            >
              {formatShekel(amount)}
            </Text>
          </>
        )}
        {view.totalSpent > 0 && (
          <Text style={styles.heroText}>
            {he.money.share(formatShekel(view.myShare), formatShekel(view.totalSpent))}
          </Text>
        )}
        {myOpen.length > 0 ? (
          <View style={styles.payRows}>
            <Text style={styles.heroText}>{he.settle.payIn}</Text>
            {myOpen.map((t) => (
              <PayRow
                key={t.to}
                view={view}
                transfer={t}
                tripName={data.trip.name}
                saving={saving}
                onMark={(amountAgorot) =>
                  record(me, t.to, amountAgorot, he.money.markedToast(formatShekel(amountAgorot)))
                }
              />
            ))}
          </View>
        ) : (
          toMe.length > 0 && (
            <View style={styles.payRows}>
              {toMe.map((t) => (
                <PillButton
                  key={t.from}
                  label={he.money.receivedFrom(
                    formatShekel(t.amountAgorot),
                    view.displayNameOf(t.from),
                  )}
                  size="lg"
                  wide
                  icon={<Icon name="check" size={20} color={colors.onPrimary} />}
                  disabled={saving}
                  onPress={() =>
                    record(
                      t.from,
                      me,
                      t.amountAgorot,
                      he.money.receivedToast(formatShekel(t.amountAgorot)),
                    )
                  }
                  {...testId(`received-${t.from}`)}
                />
              ))}
            </View>
          )
        )}
      </Card>

      {needsPhone && (
        <Callout
          title={he.settle.addPhoneTitle}
          text={he.settle.addPhoneText}
          action={{ label: he.settle.addPhone, onPress: () => router.push('/profile') }}
        />
      )}

      {/* What's open and what was paid, in one place: open first, then recorded payments. */}
      {data.expenses.length + data.payments.length > 0 && (
        <ListGroup title={he.money.settling}>
          {view.transfers.length === 0 && (
            <Text style={styles.expenseWho}>{he.money.noneOpen}</Text>
          )}
          {view.transfers.map((t) => (
            <View key={`${t.from}-${t.to}`} style={styles.transfer} {...testId('transfer')}>
              <FromTo view={view} from={t.from} to={t.to} />
              <View style={styles.transferEnd}>
                <Text style={[styles.amount, t.from === me && { color: colors.brandStrong }]}>
                  {formatShekel(t.amountAgorot)}
                </Text>
                <PillButton
                  label={he.money.transferPaid}
                  accessibilityLabel={he.money.transferPaidLabel(
                    view.displayNameOf(t.from),
                    view.displayNameOf(t.to),
                    formatShekel(t.amountAgorot),
                  )}
                  variant="soft"
                  size="sm"
                  disabled={saving}
                  onPress={() =>
                    record(
                      t.from,
                      t.to,
                      t.amountAgorot,
                      he.money.recordedToast(formatShekel(t.amountAgorot)),
                    )
                  }
                  {...testId('transfer-paid')}
                />
              </View>
            </View>
          ))}

          {data.payments.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.subhead}>{he.money.paidSoFar}</Text>
            </>
          )}
          {[...data.payments].reverse().map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={he.money.openPayment(
                view.displayNameOf(p.fromUser),
                view.displayNameOf(p.toUser),
                formatShekel(p.amountAgorot),
              )}
              onPress={() =>
                router.push({
                  pathname: '/trips/[tripId]/payments/[paymentId]',
                  params: { tripId: data.trip.id, paymentId: p.id },
                })
              }
              style={({ pressed }) => [styles.payment, pressed && { opacity: 0.75 }]}
              {...testId('payment-row')}
            >
              <View style={styles.transfer}>
                <FromTo view={view} from={p.fromUser} to={p.toUser} />
                <Text style={[styles.amount, styles.paid]}>{formatShekel(p.amountAgorot)}</Text>
              </View>
              <View style={styles.recorded}>
                <Icon name="check" size={16} color={colors.brand} />
                <Text style={styles.expenseWho}>
                  {p.createdBy === me
                    ? he.money.recordedByMe(formatMoment(p.createdAt))
                    : he.money.recordedBy(
                        view.displayNameOf(p.createdBy),
                        formatMoment(p.createdAt),
                      )}
                </Text>
              </View>
            </Pressable>
          ))}

          <View style={styles.recordOther}>
            <PillButton
              label={he.money.recordOther}
              variant="soft"
              wide
              icon={<Icon name="plus" size={18} color={colors.primaryStrong} />}
              onPress={() =>
                router.push({
                  pathname: '/trips/[tripId]/payments/new',
                  params: { tripId: data.trip.id },
                })
              }
              {...testId('payment-record')}
            />
            <Text style={styles.hint}>{he.money.recordHint}</Text>
          </View>
        </ListGroup>
      )}

      {data.expenses.length > 0 && <BalanceList data={data} view={view} me={me} />}
    </View>
  );
}

/**
 * The expense log: the trip's total and my share (with where I stand, opening settling up), then
 * each day's expenses, newest first, each with my part of it. Or a way to add the first one.
 */
function Expenses({
  data,
  view,
  me,
  onSettle,
}: {
  data: TripData;
  view: TripView;
  me: string;
  onSettle: () => void;
}) {
  const balance = data.balances[me] ?? 0;
  const state = balanceState(balance);
  return data.expenses.length === 0 ? (
    <>
      <EmptyState
        spot={data.trip.cover}
        title={he.money.noExpenses}
        text={he.money.noExpensesText}
        actions={[
          {
            label: he.money.addExpense,
            onPress: () =>
              router.push({
                pathname: '/trips/[tripId]/expenses/new',
                params: { tripId: data.trip.id },
              }),
          },
        ]}
      />
      <Callout title={he.states.tip} text={he.money.tip} />
    </>
  ) : (
    <>
      <Card gap={space[3]}>
        <View style={styles.totals}>
          <View style={styles.total}>
            <Text style={styles.heroText}>{he.money.wholeTrip}</Text>
            <Text style={styles.stat} numberOfLines={1} adjustsFontSizeToFit>
              {formatShekel(view.totalSpent)}
            </Text>
          </View>
          <View style={styles.totalsRule} />
          <View style={styles.total}>
            <Text style={styles.heroText}>{he.money.myShare}</Text>
            <Text style={styles.stat} numberOfLines={1} adjustsFontSizeToFit>
              {formatShekel(view.myShare)}
            </Text>
          </View>
        </View>
        {balance !== 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={onSettle}
            style={({ pressed }) => [styles.balanceLink, pressed && { opacity: 0.75 }]}
            {...testId('money-balance-link')}
          >
            <Text style={[styles.balanceLinkText, { color: state.color }]}>
              {he.money.balanceLink(
                balance > 0 ? he.balances.getsMine : he.balances.owesMine,
                formatShekel(Math.abs(balance)),
              )}
            </Text>
            <Icon name="chevronEnd" size={16} color={state.color} />
          </Pressable>
        )}
      </Card>
      {expenseDays(data.expenses).map(({ day, expenses, totalAgorot }) => (
        <ListGroup key={day} title={dayLabel(day, today())} aside={formatShekel(totalAgorot)}>
          {expenses.map((e) => (
            // The row opens the expense; its receipt has its own button beside it.
            <RevealTarget key={e.id} id={expenseKey(e.id)}>
              <View style={styles.expense}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={he.expense.open(e.description)}
                  {...testId('expense-row')}
                  onPress={() =>
                    router.push({
                      pathname: '/trips/[tripId]/expenses/[expenseId]',
                      params: { tripId: data.trip.id, expenseId: e.id },
                    })
                  }
                  style={({ pressed }) => [styles.expenseOpen, pressed && { opacity: 0.75 }]}
                >
                  <Avatar person={view.avatarOf(e.paidBy)} size={40} ring={false} />
                  <View style={styles.expenseBody}>
                    <Text style={styles.expenseWhat} numberOfLines={1}>
                      {e.description}
                    </Text>
                    {/* An uneven split wraps: who shares each part, or takes more, is the point of it. */}
                    <Text
                      style={styles.expenseWho}
                      numberOfLines={e.parts || e.weights ? undefined : 1}
                    >
                      {[view.nameOf(e.paidBy), sharedText(e, view.activeIds, view.displayNameOf)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.expenseEnd}>
                    <Text style={styles.amount}>{formatShekel(e.amountAgorot)}</Text>
                    {(owedShares(e).get(me) ?? 0) > 0 && (
                      <Text style={styles.myPart}>
                        {he.money.myPart(formatShekel(owedShares(e).get(me)!))}
                      </Text>
                    )}
                  </View>
                </Pressable>
                <ReceiptButton tripId={data.trip.id} expense={e} />
              </View>
            </RevealTarget>
          ))}
        </ListGroup>
      ))}
    </>
  );
}

/**
 * "who → whom": each side gets half the row and a long name ends in "…", so the row stays one
 * line and a short name is never squeezed by a long one.
 */
function FromTo({ view, from, to }: { view: TripView; from: string; to: string }) {
  return (
    <View style={styles.transferWho}>
      <View style={styles.transferPerson}>
        <Avatar person={view.avatarOf(from)} ring={false} />
        <Text style={styles.transferName} numberOfLines={1}>
          {view.nameOf(from)}
        </Text>
      </View>
      <Icon name="arrowEnd" size={18} color={colors.inkFaint} />
      <View style={styles.transferPerson}>
        <Avatar person={view.avatarOf(to)} ring={false} />
        <Text style={styles.transferName} numberOfLines={1}>
          {view.nameOf(to)}
        </Text>
      </View>
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
      {...testId('expense-receipt')}
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
  heroAmount: { ...type.bigNumber, color: colors.primaryStrong },
  heroText: { ...type.caption, color: colors.inkMuted },
  payRows: { gap: space[3], marginTop: space[3] },
  payment: { gap: space[1] },
  paid: { color: colors.inkMuted },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: space[1] },
  subhead: { ...type.label, color: colors.inkMuted },
  square: { alignItems: 'center', gap: space[2], paddingVertical: space[2] },
  squareCheck: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareTitle: { ...type.sectionTitle, color: colors.ink },
  totals: { flexDirection: 'row', alignItems: 'stretch', gap: space[3] },
  total: { flex: 1, gap: 2 },
  totalsRule: { width: 1, backgroundColor: colors.hairline },
  // Half a card each: smaller than `stat`, so ₪2,040.00 fits on one line.
  stat: { ...type.stat, fontSize: 22, lineHeight: 28, color: colors.ink },
  balanceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minHeight: space.touch,
  },
  balanceLinkText: { ...type.itemTitle },
  expenseEnd: { alignItems: 'flex-end', gap: 2 },
  myPart: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  recorded: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  transferEnd: { alignItems: 'flex-end', gap: space[1] },
  recordOther: { gap: space[2] },
  hint: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
  transfer: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: space.touch },
  transferWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  transferPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  transferName: { ...type.itemTitle, color: colors.ink, flexShrink: 1 },
  amount: { ...type.itemTitle, color: colors.ink },
  expense: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: space.touch },
  expenseOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] },
  expenseBody: { flex: 1, gap: space[1] },
  expenseWhat: { ...type.itemTitle, color: colors.ink },
  expenseWho: { ...type.caption, color: colors.inkMuted },
});
