import { linkedExpense, parseShekel } from '@yallist/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AmountField, fieldStyles } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { deriveTrip } from '@/features/trip/derive';
import { quantityText, statusLine, TONE_COLOR } from '@/features/trip/labels';
import { SharePicker, useShares } from '@/features/trip/SharePicker';
import { he } from '@/i18n/he';
import { newId } from '@/lib/id';
import { useDispatch, useMe, useTrip } from '@/state/store';
import { colors, fonts } from '@/theme';

function closeSheet() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function ItemSheet() {
  const { tripId, itemId } = useLocalSearchParams<{ tripId: string; itemId: string }>();
  const data = useTrip(tripId);
  const item = data?.items.find((i) => i.id === itemId);
  const missing = !data || !item;
  useEffect(() => {
    if (missing) closeSheet();
  }, [missing]);
  if (missing) return null;
  return <ItemSheetBody key={item.id} tripId={tripId} itemId={itemId} onClose={closeSheet} />;
}

function ItemSheetBody({
  tripId,
  itemId,
  onClose,
}: {
  tripId: string;
  itemId: string;
  onClose: () => void;
}) {
  const data = useTrip(tripId)!;
  const item = data.items.find((i) => i.id === itemId)!;
  const me = useMe().userId;
  const dispatch = useDispatch();
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
  const canPrice = isBuy && (mine > 0 || !!expense);

  const claim = (quantity: number) =>
    dispatch({ type: 'setClaim', tripId, itemId: item.id, userId: me, quantity });

  const saveBought = () => {
    if (!amount || shares.length === 0) return;
    dispatch({
      type: 'saveExpense',
      tripId,
      expense: {
        id: expense?.id ?? newId(),
        itemId: item.id,
        description: item.name,
        amountAgorot: amount,
        paidBy: expense?.paidBy ?? me,
        shares,
      },
    });
    onClose();
  };

  const remove = () => {
    dispatch({ type: 'deleteItem', tripId, itemId: item.id });
    onClose();
  };

  return (
    <Sheet
      title={item.name}
      subtitle={[qty, isBuy ? he.item.inBuy : he.item.inBring].filter(Boolean).join(', ')}
      onClose={() => {
        if (note !== (item.note ?? ''))
          dispatch({ type: 'setNote', tripId, itemId: item.id, note });
        onClose();
      }}
      top={92}
      footer={
        <>
          {canPrice && (
            <PillButton
              label={expense ? he.item.updatePrice : he.item.markBought}
              size="xl"
              wide
              disabled={!amount || shares.length === 0}
              onPress={saveBought}
            />
          )}
          {expense && (
            <PillButton
              label={he.item.unmarkBought}
              variant="quiet"
              size="lg"
              wide
              onPress={() => {
                dispatch({ type: 'deleteExpense', tripId, expenseId: expense.id });
                setPrice('');
              }}
            />
          )}
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
          <AmountField label={he.item.price} value={price} onChangeText={setPrice} />
          <SharePicker view={view} shares={shares} onChange={setShares} amount={amount} />
        </>
      )}

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.item.note}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={() => dispatch({ type: 'setNote', tripId, itemId: item.id, note })}
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
