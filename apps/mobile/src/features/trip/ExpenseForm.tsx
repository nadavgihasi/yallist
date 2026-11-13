import { formatShekel, linkedExpense, parseShekel, shekelInput } from '@yallist/domain';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { SuggestionChip } from '@/components/Chips';
import { AmountField, TextField, fieldStyles } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useMe } from '@/state/store';
import { useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, fonts, space, type } from '@/theme';

import { useCloseSheet } from './closeSheet';
import { deriveTrip } from './derive';
import { ReceiptField } from './ReceiptField';
import { RunParts } from './RunParts';
import { runSplit, type PartDraft } from './runSplit';
import { SharePicker, useShares } from './SharePicker';

type Expense = TripData['expenses'][number];

const toDraft = (p: NonNullable<Expense['parts']>[number]): PartDraft => ({
  label: p.label,
  amount: shekelInput(p.amountAgorot),
  shares: [...p.shares],
});

/**
 * Adds an expense, or with `expense` fixes one in place: the same fields, prefilled. An edited
 * expense keeps its receipt and the items it covers, so neither is offered here; one split in
 * parts (a shopping run's) opens with its parts.
 */
export function ExpenseForm({ data, expense }: { data: TripData; expense?: Expense }) {
  const me = useMe().userId;
  const act = useTripAction(data.trip.id);
  const view = deriveTrip(data, me);
  const [amount, setAmount] = useState(expense ? shekelInput(expense.amountAgorot) : '');
  const [what, setWhat] = useState(expense?.description ?? '');
  const [itemId, setItemId] = useState<string>();
  const [payer, setPayer] = useState(expense?.paidBy ?? me);
  const [shares, setShares] = useShares(view, expense?.shares);
  const [parts, setParts] = useState<PartDraft[]>(() => expense?.parts?.map(toDraft) ?? []);
  const [receipt, setReceipt] = useState<string>();

  const close = useCloseSheet(data.trip.id);
  const agorot = parseShekel(amount);
  const withParts = !!expense?.parts?.length;
  const split = runSplit(agorot, shares, parts);
  const unbought = expense
    ? []
    : view.items.filter((i) => i.list === 'buy' && !linkedExpense(i.id, data.expenses)).slice(0, 6);
  const valid =
    !!agorot && !!what.trim() && shares.length > 0 && (parts.length === 0 || !split.error);
  // A payer who has since left the trip stays on the expense, so they stay on offer.
  const payers = view.activeIds.includes(payer) ? view.activeIds : [payer, ...view.activeIds];

  const save = () => {
    if (!valid) return;
    close(() => {
      const fields = { description: what.trim(), amountAgorot: agorot, paidBy: payer, shares };
      if (expense) {
        act({
          type: 'editExpense',
          expenseId: expense.id,
          changes: withParts ? { ...fields, parts: split.parts } : fields,
        });
        showToast(he.editExpense.saved(formatShekel(agorot)), 'success');
        return;
      }
      act({ type: 'addExpense', expense: { ...fields, itemId }, receipt });
      // The list shows it only once the API answers, so say it went through.
      showToast(he.addExpense.saved(formatShekel(agorot)), 'success');
    });
  };

  return (
    <Sheet
      title={expense ? he.editExpense.title : he.addExpense.title}
      onClose={close}
      footer={
        <PillButton
          label={expense ? he.editExpense.save : he.addExpense.save}
          size="lg"
          wide
          disabled={!valid}
          onPress={save}
          {...testId('expense-save')}
        />
      }
    >
      <AmountField
        label={he.addExpense.amount}
        value={amount}
        onChangeText={setAmount}
        size="lg"
        testID="expense-amount"
        onSubmitEditing={save}
        error={amount.trim() && agorot === undefined ? he.invalidAmount : undefined}
      />

      <View style={styles.field}>
        <TextField
          label={he.addExpense.what}
          value={what}
          onChangeText={(t) => {
            setWhat(t);
            setItemId(undefined);
          }}
          placeholder={he.addExpense.whatPlaceholder}
          {...testId('expense-what')}
          onSubmitEditing={save}
          returnKeyType="done"
          maxLength={80}
          style={styles.whatInput}
        />
        {unbought.length > 0 && (
          <View style={styles.wrap}>
            <Text style={styles.meta}>{he.addExpense.fromList}</Text>
            {unbought.map((i) => (
              <SuggestionChip
                plus={false}
                key={i.id}
                label={i.name}
                onPress={() => {
                  setWhat(i.name);
                  setItemId(i.id);
                }}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.addExpense.paidBy}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.payers}
          accessibilityRole="radiogroup"
          accessibilityLabel={he.addExpense.paidBy}
        >
          {payers.map((id) => {
            const selected = id === payer;
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={view.nameOf(id)}
                onPress={() => setPayer(id)}
                style={styles.payer}
              >
                <View style={[styles.payerRing, selected ? styles.payerOn : { opacity: 0.55 }]}>
                  <Avatar person={view.avatarOf(id)} size={52} ring={false} />
                </View>
                <Text style={[styles.payerName, selected && styles.payerNameOn]}>
                  {view.nameOf(id)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <SharePicker
        view={view}
        shares={shares}
        onChange={setShares}
        amount={parts.length > 0 ? split.rest : agorot}
        label={
          parts.length > 0 && split.rest !== undefined && split.rest > 0
            ? he.shop.finish.rest(formatShekel(split.rest))
            : undefined
        }
        showHint={false}
      />

      {withParts && (
        <>
          <RunParts view={view} parts={parts} onChange={setParts} />
          {parts.length > 0 && (
            <View style={styles.owed} {...testId('expense-owed')}>
              <Text style={styles.owedTitle} accessibilityRole="header">
                {agorot ? he.shop.finish.whoPaysOf(formatShekel(agorot)) : he.shop.finish.whoPays}
              </Text>
              {split.error && (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {split.error}
                </Text>
              )}
              {[...split.owed]
                .filter(([, owed]) => owed > 0)
                .map(([id, owed]) => (
                  <View key={id} style={styles.owedRow}>
                    <Text style={styles.owedName}>{view.displayNameOf(id)}</Text>
                    <Text style={styles.owedAmount}>{formatShekel(owed)}</Text>
                  </View>
                ))}
            </View>
          )}
        </>
      )}

      {!expense && <ReceiptField uri={receipt} onChange={setReceipt} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  whatInput: { minHeight: 56, borderRadius: 20, paddingHorizontal: 18 },
  field: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  payers: { gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  payer: { minWidth: 56, alignItems: 'center', gap: 6 },
  payerRing: { borderRadius: 30, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  payerOn: { borderColor: colors.primary },
  payerName: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  payerNameOn: { fontFamily: fonts.bold, color: colors.ink },
  owed: { gap: space[1] },
  owedTitle: { ...type.itemTitle, color: colors.ink },
  owedRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  owedName: { ...type.caption, color: colors.inkMuted },
  owedAmount: { ...type.itemTitle, color: colors.ink },
  error: { ...type.caption, color: colors.brandStrong },
});
