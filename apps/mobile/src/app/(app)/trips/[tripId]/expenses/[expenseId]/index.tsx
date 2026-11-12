import { formatShekel } from '@yallist/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { deriveTrip } from '@/features/trip/derive';
import { coveredItems, owedLines } from '@/features/trip/expenseDetail';
import { he, joinNames } from '@/i18n/he';
import { rtl } from '@/lib/bidi';
import { formatMoment } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useReceiptLink } from '@/state/receipts';
import { useMe } from '@/state/store';
import { useTrip, useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, radius, space, type } from '@/theme';

type Expense = TripData['expenses'][number];

/** One expense: what it was, who paid and added it, what each person's part is, what it bought. */
export default function ExpenseDetail() {
  const { tripId, expenseId } = useLocalSearchParams<{ tripId: string; expenseId: string }>();
  const data = useTrip(tripId);
  const expense = data?.expenses.find((e) => e.id === expenseId);
  const close = useCloseSheet(tripId);
  // Deleted meanwhile (here, or by someone else).
  useEffect(() => {
    if (data && !expense) close();
  }, [data, expense, close]);
  if (!data || !expense) return null;
  return <Detail data={data} expense={expense} close={close} />;
}

function Detail({
  data,
  expense,
  close,
}: {
  data: TripData;
  expense: Expense;
  close: (then?: () => void) => void;
}) {
  const me = useMe().userId;
  const tripId = data.trip.id;
  const act = useTripAction(tripId);
  const view = deriveTrip(data, me);
  const [confirming, setConfirming] = useState(false);
  const mayChange = view.mayChange(expense);
  const lines = owedLines(expense, view.activeIds, me);
  const covered = coveredItems(expense, data.items);
  const names = (ids: string[]) => joinNames(ids.map(view.displayNameOf));
  const params = { tripId, expenseId: expense.id };

  const remove = () =>
    close(() => {
      act({ type: 'deleteExpense', expenseId: expense.id });
      showToast(he.expense.deleted);
    });

  return (
    <Sheet
      title={expense.description}
      subtitle={formatShekel(expense.amountAgorot)}
      onClose={close}
      gap={space[5]}
      footer={
        mayChange &&
        (confirming ? (
          <View style={styles.confirm} {...testId('expense-confirm-delete')}>
            <Text style={styles.confirmTitle} accessibilityRole="alert">
              {he.expense.confirmTitle}
            </Text>
            <Text style={styles.caption}>{he.expense.confirmText}</Text>
            <View style={styles.confirmButtons}>
              <PillButton
                label={he.expense.confirmDelete}
                variant="danger"
                icon={<Icon name="trash" size={18} color={colors.brandStrong} />}
                onPress={remove}
                {...testId('expense-delete-confirm')}
              />
              <PillButton
                label={he.expense.cancel}
                variant="quiet"
                onPress={() => setConfirming(false)}
              />
            </View>
          </View>
        ) : (
          <>
            <PillButton
              label={he.expense.edit}
              size="lg"
              wide
              icon={<Icon name="pencil" size={18} color={colors.onPrimary} />}
              onPress={() =>
                router.push({ pathname: '/trips/[tripId]/expenses/[expenseId]/edit', params })
              }
              {...testId('expense-edit')}
            />
            <PillButton
              label={he.expense.delete}
              variant="danger"
              wide
              icon={<Icon name="trash" size={18} color={colors.brandStrong} />}
              onPress={() => setConfirming(true)}
              {...testId('expense-delete')}
            />
          </>
        ))
      }
    >
      <View style={styles.facts}>
        <Fact label={he.expense.paidBy}>
          <View style={styles.person}>
            <Avatar person={view.avatarOf(expense.paidBy)} size={28} ring={false} />
            <Text style={styles.value}>{view.nameOf(expense.paidBy)}</Text>
          </View>
        </Fact>
        {expense.createdBy && expense.createdBy !== expense.paidBy && (
          <Fact label={he.expense.addedBy}>
            <Text style={styles.value}>{view.nameOf(expense.createdBy)}</Text>
          </Fact>
        )}
        {expense.createdAt && (
          <Fact label={he.expense.addedAt}>
            <Text style={styles.value}>{formatMoment(expense.createdAt)}</Text>
          </Fact>
        )}
      </View>

      <View style={styles.section} {...testId('expense-owed')}>
        <Text style={styles.heading} accessibilityRole="header">
          {he.expense.owed}
        </Text>
        {lines.map(({ userId, owed }) => {
          const mine = userId === me;
          return (
            <View key={userId} style={[styles.line, mine && styles.mineLine]}>
              <Avatar person={view.avatarOf(userId)} size={28} ring={false} />
              <Text style={[styles.name, mine && styles.mineText]} numberOfLines={1}>
                {mine ? he.expense.mine : view.displayNameOf(userId)}
              </Text>
              <Text style={[styles.amount, mine && styles.mineText]}>{formatShekel(owed)}</Text>
            </View>
          );
        })}
      </View>

      {!!expense.parts?.length && (
        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {he.expense.parts}
          </Text>
          {expense.parts.map((p, i) => (
            <View key={i} style={styles.partLine}>
              <Text style={[styles.value, styles.rtl]}>
                {rtl(`${p.label} · ${formatShekel(p.amountAgorot)}`)}
              </Text>
              <Text style={[styles.caption, styles.rtl]}>{rtl(names(p.shares))}</Text>
            </View>
          ))}
          <View style={styles.partLine}>
            <Text style={styles.value}>
              {he.expense.rest} ·{' '}
              {formatShekel(
                expense.amountAgorot - expense.parts.reduce((s, p) => s + p.amountAgorot, 0),
              )}
            </Text>
            <Text style={[styles.caption, styles.rtl]}>{rtl(names(expense.shares))}</Text>
          </View>
        </View>
      )}

      {(covered.items.length > 0 || covered.deleted > 0) && (
        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {he.expense.items}
          </Text>
          {covered.items.map((item) => (
            <Text key={item.id} style={[styles.value, styles.rtl]}>
              {rtl(item.name)}
              {item.displayQty ? <Text style={styles.caption}> · {item.displayQty}</Text> : null}
            </Text>
          ))}
          {covered.deleted > 0 && (
            <Text style={styles.caption}>{he.expense.deletedItems(covered.deleted)}</Text>
          )}
        </View>
      )}

      <Receipt tripId={tripId} expense={expense} />
    </Sheet>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.caption}>{label}</Text>
      {children}
    </View>
  );
}

/** The receipt inline, opening full screen; or a way to add one. */
function Receipt({ tripId, expense }: { tripId: string; expense: Expense }) {
  const { data: link } = useReceiptLink(tripId, expense.id, !!expense.hasReceipt);
  const open = () =>
    router.push({
      pathname: '/trips/[tripId]/expenses/[expenseId]/receipt',
      params: { tripId, expenseId: expense.id },
    });
  if (!expense.hasReceipt) {
    return (
      <PillButton
        label={he.receipt.add}
        variant="soft"
        icon={<Icon name="receipt" size={18} color={colors.primaryStrong} />}
        style={styles.addReceipt}
        onPress={open}
        {...testId('expense-detail-receipt')}
      />
    );
  }
  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        {he.receipt.title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={he.expense.openReceipt}
        onPress={open}
        style={({ pressed }) => [styles.receipt, pressed && { opacity: 0.85 }]}
        {...testId('expense-detail-receipt')}
      >
        {link && (
          <Image source={{ uri: link.url }} style={styles.receiptImage} resizeMode="cover" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { gap: space[3] },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  value: { ...type.itemTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  section: { gap: space[2] },
  heading: { ...type.caption, color: colors.inkMuted, fontFamily: type.itemTitle.fontFamily },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 44,
    paddingHorizontal: space[2],
    borderRadius: radius.input,
  },
  mineLine: { backgroundColor: colors.primaryTint },
  name: { ...type.body, color: colors.ink, flex: 1 },
  amount: { ...type.itemTitle, color: colors.ink },
  mineText: { fontFamily: type.itemTitle.fontFamily, color: colors.primaryStrong },
  // Names typed in English still line up on the start (right) side.
  partLine: { gap: 2 },
  rtl: { writingDirection: 'rtl' },
  receipt: {
    height: 180,
    borderRadius: radius.input,
    overflow: 'hidden',
    backgroundColor: colors.ground,
  },
  receiptImage: { width: '100%', height: '100%' },
  addReceipt: { alignSelf: 'flex-start' },
  confirm: { gap: space[2] },
  confirmTitle: { ...type.itemTitle, color: colors.ink },
  confirmButtons: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
});
