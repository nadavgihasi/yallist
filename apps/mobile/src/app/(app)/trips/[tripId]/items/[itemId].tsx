import { claimCap, linkedExpense, parseShekel, type Expense } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AmountField, Input, fieldStyles } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { ClaimStepper } from '@/features/trip/ClaimStepper';
import { closeSheet } from '@/features/trip/closeSheet';
import { ItemForm } from '@/features/trip/ItemForm';
import { deriveTrip } from '@/features/trip/derive';
import { quantityText, statusLine, TONE_COLOR } from '@/features/trip/labels';
import { SharePicker, useShares } from '@/features/trip/SharePicker';
import { he } from '@/i18n/he';
import { useMe } from '@/state/store';
import { useTrip, useTripAction } from '@/state/trips';
import { colors, fonts } from '@/theme';

export default function ItemSheet() {
  const { tripId, itemId } = useLocalSearchParams<{ tripId: string; itemId: string }>();
  const data = useTrip(tripId);
  const item = data?.items.find((i) => i.id === itemId);
  const act = useTripAction(tripId);
  const [editing, setEditing] = useState(false);
  const missing = !data || !item;
  // Close exactly once. A modal that's fading out still re-renders; a second back() would also
  // pop the trip screen (e.g. right after deleting this item).
  const closed = useRef(false);
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    closeSheet(tripId);
  }, [tripId]);
  useEffect(() => {
    if (missing) close();
  }, [missing, close]);
  if (missing) return null;
  // Editing swaps the sheet for the item form; closing the form comes back here.
  if (editing) {
    return (
      <ItemForm
        tripId={tripId}
        item={item}
        onSubmit={(changes) => {
          act({ type: 'editItem', itemId, changes });
          setEditing(false);
        }}
        onClose={() => setEditing(false)}
      />
    );
  }
  return (
    <ItemSheetBody
      key={item.id}
      tripId={tripId}
      itemId={itemId}
      onClose={close}
      onEdit={() => setEditing(true)}
    />
  );
}

function ItemSheetBody({
  tripId,
  itemId,
  onClose,
  onEdit,
}: {
  tripId: string;
  itemId: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const data = useTrip(tripId)!;
  const item = data.items.find((i) => i.id === itemId)!;
  const me = useMe().userId;
  const act = useTripAction(tripId);
  const view = deriveTrip(data, me);
  const expense = linkedExpense(item.id, data.expenses);
  const status = view.status(item);
  const line = statusLine(item, status, data.claims, view, me);
  const mine = view.myQuantity(item.id);

  const [price, setPrice] = useState(expense ? String(expense.amountAgorot / 100) : '');
  const [shares, setShares] = useShares(view, expense?.shares);
  const [note, setNote] = useState(item.note ?? '');

  const isBuy = item.list === 'buy';
  const qty = quantityText(item, data.claims);
  const amount = parseShekel(price);
  const bought = status.kind === 'bought';
  // `each` items are everyone's own purchase, so they aren't priced as one shared expense.
  const canPrice = isBuy && item.kind !== 'each' && (mine > 0 || !!expense);
  const expenseEdit =
    expense &&
    amount &&
    shares.length > 0 &&
    (amount !== expense.amountAgorot ||
      shares.length !== expense.shares.length ||
      shares.some((id) => !expense.shares.includes(id)))
      ? { ...expense, amountAgorot: amount, shares }
      : undefined;

  // Save edits however the sheet goes away (X, scrim, Escape, browser or Android back): keep the
  // latest valid ones in a ref and send them on unmount.
  const edits = useRef<{ note?: string; expense?: Expense }>({});
  useEffect(() => {
    edits.current = { note, expense: expenseEdit };
  });
  useEffect(() => {
    const original = item.note ?? '';
    return () => {
      const { note: latest, expense: edited } = edits.current;
      if (latest !== undefined && latest !== original)
        act({ type: 'setNote', itemId, note: latest });
      if (edited) {
        // Expenses aren't edited in place: the new one replaces the old.
        const { id, ...expense } = edited;
        act({ type: 'deleteExpense', expenseId: id });
        act({ type: 'addExpense', expense });
      }
    };
    // Only on unmount: compare against the note as it was when the sheet opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claim = (quantity: number) => act({ type: 'setClaim', itemId: item.id, quantity });

  const saveBought = () => {
    if (!amount || shares.length === 0) return;
    act({
      type: 'addExpense',
      expense: {
        itemId: item.id,
        description: item.name,
        amountAgorot: amount,
        paidBy: me,
        shares,
      },
    });
    onClose();
  };

  // The parent closes the sheet once the item is gone; don't save edits to it on the way out.
  const remove = () => {
    edits.current = {};
    act({ type: 'deleteItem', itemId: item.id });
  };

  return (
    <Sheet
      title={item.name}
      subtitle={[qty, isBuy ? he.item.inBuy : he.item.inBring].filter(Boolean).join(', ')}
      onClose={onClose}
      top={92}
      titleSize={34}
      gap={22}
      footer={
        <>
          {canPrice && !expense && (
            <PillButton
              label={he.item.markBought}
              size="xl"
              wide
              disabled={!amount || shares.length === 0}
              onPress={saveBought}
            />
          )}
          {expense && (
            <PillButton
              label={he.item.unmarkBought}
              variant="neutral"
              size="xl"
              wide
              onPress={() => act({ type: 'deleteExpense', expenseId: expense.id })}
            />
          )}
          <PillButton
            label={he.item.edit}
            variant="quiet"
            icon={<Icon name="pencil" size={18} color={colors.inkSecondary} />}
            onPress={onEdit}
          />
          <PillButton
            label={he.item.delete}
            variant="danger"
            icon={<Icon name="trash" size={18} color={colors.missing} />}
            onPress={remove}
          />
        </>
      }
    >
      <View style={styles.statusRow}>
        <View style={[styles.chip, { backgroundColor: chipBg(line.tone) }]}>
          {status.kind === 'bought' && <Icon name="check" size={16} color={colors.success} />}
          <Text style={[styles.chipText, { color: chipFg(line.tone) }]}>{line.label}</Text>
        </View>
        {item.kind === 'single' && status.kind === 'mine' && (
          <PillButton label={he.item.releaseMine} variant="quiet" onPress={() => claim(0)} />
        )}
        {item.kind === 'single' && status.kind === 'missing' && (
          <PillButton
            label={isBuy ? he.trip.claimBuy : he.trip.claimBring}
            onPress={() => claim(item.quantityNeeded)}
          />
        )}
        {item.kind === 'qty' && !bought && (
          <ClaimStepper
            mine={mine}
            canAdd={claimCap(item, data.claims, me) > mine}
            onChange={claim}
          />
        )}
        {item.kind === 'each' && (
          <PillButton
            label={he.trip.have}
            variant={mine ? 'solid' : 'soft'}
            onPress={() => claim(mine ? 0 : 1)}
          />
        )}
      </View>
      {!!line.detail && <Text style={styles.detail}>{line.detail}</Text>}

      {canPrice && (
        <>
          <AmountField
            label={he.item.price}
            value={price}
            onChangeText={setPrice}
            onSubmitEditing={saveBought}
            error={price.trim() && amount === undefined ? he.invalidAmount : undefined}
          />
          <SharePicker view={view} shares={shares} onChange={setShares} amount={amount} />
        </>
      )}

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.item.note}</Text>
        <Input
          value={note}
          onChangeText={setNote}
          multiline
          accessibilityLabel={he.item.note}
          style={styles.note}
        />
      </View>
    </Sheet>
  );
}

function chipBg(tone: keyof typeof TONE_COLOR) {
  return {
    missing: colors.missingTint,
    mine: colors.accent,
    ok: colors.ground,
    success: colors.successTint,
  }[tone];
}
function chipFg(tone: keyof typeof TONE_COLOR) {
  return tone === 'mine' ? colors.white : TONE_COLOR[tone];
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 15 },
  detail: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSecondary, marginTop: -8 },
  field: { gap: 8 },
  note: {
    minHeight: 72,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(14,23,38,0.05)',
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    textAlignVertical: 'top',
  },
});
