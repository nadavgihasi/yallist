import { formatShekel, linkedExpense, owedShares, parseShekel, shekelInput } from '@yallist/domain';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { FilterChip, SuggestionChip } from '@/components/Chips';
import { SegmentedControl, Switch } from '@/components/Controls';
import { DateField } from '@/components/DateField';
import { Icon } from '@/components/Icon';
import { AmountField, TextField, fieldStyles } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { addDays, spentDay, today } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useMe } from '@/state/store';
import { useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, fonts, space, type } from '@/theme';

import { useCloseSheet } from './closeSheet';
import { deriveTrip } from './derive';
import { lastSplit } from './lastSplit';
import { ReceiptField } from './ReceiptField';
import { requestReveal } from './reveal';
import { RunParts } from './RunParts';
import { PersonPicker } from './PersonPicker';
import { runSplit, type PartDraft } from './runSplit';
import { SharePicker, useShares } from './SharePicker';
import { perWeightText, WeightList } from './WeightList';

type Expense = TripData['expenses'][number];

const SPLIT_MODES = ['equal', 'weights', 'parts'] as const;
/** How the rest of an expense is split: equally, by weight, or with parts for some only. */
type SplitMode = (typeof SPLIT_MODES)[number];

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
  // A new expense starts from how I split the last one.
  const [last] = useState(() =>
    expense ? undefined : lastSplit(data.expenses, me, view.activeIds),
  );
  const [shares, setShares] = useShares(view, expense?.shares ?? last);
  const [day, setDay] = useState(() => (expense ? spentDay(expense) : today()));
  const [otherDay, setOtherDay] = useState(() => day !== today() && day !== addDays(today(), -1));
  const [parts, setParts] = useState<PartDraft[]>(() => expense?.parts?.map(toDraft) ?? []);
  const [weights, setWeights] = useState<Record<string, number>>(expense?.weights ?? {});
  const [partsByWeight, setPartsByWeight] = useState(
    () => !!expense?.parts?.length && !!expense.weights,
  );
  const [mode, setMode] = useState<SplitMode>(
    expense?.parts?.length ? 'parts' : expense?.weights ? 'weights' : 'equal',
  );
  const [receipt, setReceipt] = useState<string>();
  // Save was tapped with something missing: each empty field says so.
  const [tried, setTried] = useState(false);
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);
  const whatRef = useRef<ComponentRef<typeof TextInput>>(null);

  const close = useCloseSheet(data.trip.id);
  const agorot = parseShekel(amount);
  const usedParts = mode === 'parts' ? parts : [];
  // Weights for who shares it only: someone unticked takes none.
  // Weights count in weights mode, and in parts mode for an expense saved with both (the API
  // takes both; the form edits one at a time but mustn't drop the other on save).
  // In parts mode, what the parts leave can be split by weight too (a dinner with a child, and
  // wine for two).
  const keepsWeights = mode === 'weights' || (mode === 'parts' && partsByWeight);
  const usedWeights = keepsWeights
    ? Object.fromEntries(Object.entries(weights).filter(([id]) => shares.includes(id)))
    : {};
  const split = runSplit(agorot, shares, usedParts);
  const owed = agorot
    ? owedShares({ amountAgorot: agorot, shares, parts: split.parts, weights: usedWeights })
    : new Map<string, number>();
  const owedFor = (id: string) => owed.get(id) ?? 0;
  const unbought = expense
    ? []
    : view.items.filter((i) => i.list === 'buy' && !linkedExpense(i.id, data.expenses)).slice(0, 6);
  const valid =
    !!agorot && !!what.trim() && shares.length > 0 && (usedParts.length === 0 || !split.error);
  // A payer who has since left the trip stays on the expense, so they stay on offer.
  const payers = view.activeIds.includes(payer) ? view.activeIds : [payer, ...view.activeIds];

  const save = () => {
    if (!valid) {
      // Rather than a button that does nothing: say what's missing and go to the first of it.
      setTried(true);
      if (!agorot) amountRef.current?.focus();
      else if (!what.trim()) whatRef.current?.focus();
      return;
    }
    close(() => {
      const fields = {
        description: what.trim(),
        amountAgorot: agorot,
        paidBy: payer,
        shares,
        // Only a day other than the one it already has: today, for a new one.
        ...(day !== (expense ? spentDay(expense) : today()) && { spentOn: day }),
      };
      if (expense) {
        // Both, always: switching to an equal split drops the parts and the weights.
        act({
          type: 'editExpense',
          expenseId: expense.id,
          changes: { ...fields, parts: split.parts, weights: usedWeights },
        });
        showToast(he.editExpense.saved(formatShekel(agorot)), 'success');
        return;
      }
      const uneven = {
        ...(split.parts.length > 0 && { parts: split.parts }),
        ...(Object.keys(usedWeights).length > 0 && { weights: usedWeights }),
      };
      act({ type: 'addExpense', expense: { ...fields, ...uneven, itemId }, receipt });
      // Once the API answers, the money tab scrolls to it and marks it.
      requestReveal(data.trip.id, {
        kind: 'expense',
        description: fields.description,
        amountAgorot: agorot,
        before: data.expenses.map((e) => e.id),
      });
      // The list shows it only once the API answers, so say it went through, and what it costs me.
      const mine = owedFor(me);
      showToast(
        mine
          ? he.addExpense.savedMine(formatShekel(mine))
          : he.addExpense.saved(formatShekel(agorot)),
        'success',
      );
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
        ref={amountRef}
        error={
          amount.trim() && agorot === undefined
            ? he.invalidAmount
            : tried && !agorot
              ? he.addExpense.needAmount
              : undefined
        }
      />
      {/* A calculator at the till: add another amount, see the total. The amount keyboard has
          no "+", so it's a button. */}
      <View style={styles.sumRow}>
        <PillButton
          label={he.addExpense.addToSum}
          variant="soft"
          size="sm"
          icon={<Icon name="plus" size={16} color={colors.primaryStrong} />}
          onPress={() => {
            setAmount((a) => (a.trim() && !a.trim().endsWith('+') ? `${a.trim()}+` : a));
            amountRef.current?.focus();
          }}
          {...testId('expense-amount-plus')}
        />
        {amount.includes('+') && agorot !== undefined && (
          <Text style={styles.sumTotal} accessibilityLiveRegion="polite">
            {he.addExpense.sumTotal(formatShekel(agorot))}
          </Text>
        )}
      </View>

      <View style={styles.field}>
        <TextField
          label={he.addExpense.what}
          value={what}
          onChangeText={(t) => {
            setWhat(t);
            setItemId(undefined);
          }}
          placeholder={he.addExpense.whatPlaceholder}
          ref={whatRef}
          error={tried && !what.trim() ? he.addExpense.needWhat : undefined}
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

      <PersonPicker
        view={view}
        ids={payers}
        value={payer}
        onChange={setPayer}
        label={he.addExpense.paidBy}
      />

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.addExpense.when}</Text>
        <View style={styles.wrap}>
          {[today(), addDays(today(), -1)].map((d, i) => (
            <FilterChip
              key={d}
              label={i === 0 ? he.addExpense.today : he.addExpense.yesterday}
              selected={!otherDay && day === d}
              onPress={() => {
                setOtherDay(false);
                setDay(d);
              }}
            />
          ))}
          <FilterChip
            label={he.addExpense.otherDay}
            selected={otherDay}
            onPress={() => setOtherDay(true)}
          />
        </View>
        {/* The calendar only for another day: today and yesterday are one tap each. */}
        {otherDay && <DateField label={he.addExpense.date} value={day} onChange={setDay} />}
      </View>

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.addExpense.splitHow}</Text>
        <SegmentedControl
          options={SPLIT_MODES.map((value) => ({ value, label: he.addExpense.split[value] }))}
          value={mode}
          onChange={setMode}
          testID="expense-split"
        />
      </View>

      {last && last.length < view.activeIds.length && (
        <Text style={styles.meta}>{he.addExpense.lastSplit}</Text>
      )}
      <SharePicker
        view={view}
        shares={shares}
        onChange={setShares}
        amount={mode === 'equal' ? agorot : undefined}
        label={
          mode === 'parts' && split.rest !== undefined && split.rest > 0
            ? he.shop.finish.rest(formatShekel(split.rest))
            : undefined
        }
        showHint={false}
      />
      {tried && shares.length === 0 && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {he.addExpense.needShares}
        </Text>
      )}

      {mode === 'weights' && (
        <View style={styles.field}>
          <Text style={styles.meta}>{he.addExpense.weightsHint}</Text>
          <WeightList
            view={view}
            shares={shares}
            weights={weights}
            owed={owed}
            onChange={setWeights}
          />
          {perWeightText(agorot, shares, usedWeights) && (
            <Text style={styles.meta}>{perWeightText(agorot, shares, usedWeights)}</Text>
          )}
        </View>
      )}

      {mode === 'parts' && (
        <>
          <RunParts view={view} parts={parts} onChange={setParts} />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{he.addExpense.restByWeight}</Text>
            <Switch
              value={partsByWeight}
              onChange={setPartsByWeight}
              label={he.addExpense.restByWeight}
            />
          </View>
          {partsByWeight && (
            <WeightList
              view={view}
              shares={shares}
              weights={weights}
              owed={owed}
              onChange={setWeights}
            />
          )}
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
              {[...(split.error ? new Map<string, number>() : owed)]
                .filter(([, amount]) => amount > 0)
                .map(([id, amount]) => (
                  <View key={id} style={styles.owedRow}>
                    <Text style={styles.owedName}>{view.displayNameOf(id)}</Text>
                    <Text style={styles.owedAmount}>{formatShekel(amount)}</Text>
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: space.touch,
  },
  switchLabel: { ...type.itemTitle, color: colors.ink, flex: 1 },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: -space[2] },
  sumTotal: { ...type.itemTitle, color: colors.primaryStrong },
  whatInput: { minHeight: 56, borderRadius: 20, paddingHorizontal: 18 },
  field: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  owed: { gap: space[1] },
  owedTitle: { ...type.itemTitle, color: colors.ink },
  owedRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  owedName: { ...type.caption, color: colors.inkMuted },
  owedAmount: { ...type.itemTitle, color: colors.ink },
  error: { ...type.caption, color: colors.brandStrong },
});
