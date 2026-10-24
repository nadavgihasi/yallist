import { linkedExpense, parseShekel } from '@yallist/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { SuggestionChip } from '@/components/Chips';
import { AmountField, TextField, fieldStyles } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { deriveTrip } from '@/features/trip/derive';
import { SharePicker, useShares } from '@/features/trip/SharePicker';
import { he } from '@/i18n/he';
import { newId } from '@/lib/id';
import { useDispatch, useMe, useTrip } from '@/state/store';
import type { TripData } from '@/state/types';
import { colors, fonts } from '@/theme';

export default function AddExpense() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const data = useTrip(tripId);
  if (!data) return null;
  return <AddExpenseBody data={data} />;
}

function AddExpenseBody({ data }: { data: TripData }) {
  const me = useMe().userId;
  const dispatch = useDispatch();
  const view = deriveTrip(data, me);
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [itemId, setItemId] = useState<string>();
  const [payer, setPayer] = useState(me);
  const [shares, setShares] = useShares(view);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const agorot = parseShekel(amount);
  const unbought = view.items
    .filter((i) => i.list === 'buy' && !linkedExpense(i.id, data.expenses))
    .slice(0, 6);
  const valid = !!agorot && !!what.trim() && shares.length > 0;

  const save = () => {
    if (!valid) return;
    dispatch({
      type: 'saveExpense',
      tripId: data.trip.id,
      expense: {
        id: newId(),
        itemId,
        description: what.trim(),
        amountAgorot: agorot,
        paidBy: payer,
        shares,
      },
    });
    close();
  };

  return (
    <Sheet
      title={he.addExpense.title}
      onClose={close}
      footer={
        <PillButton label={he.addExpense.save} size="xl" wide disabled={!valid} onPress={save} />
      }
    >
      <AmountField label={he.addExpense.amount} value={amount} onChangeText={setAmount} />

      <View style={styles.field}>
        <TextField
          label={he.addExpense.what}
          value={what}
          onChangeText={(t) => {
            setWhat(t);
            setItemId(undefined);
          }}
          placeholder={he.addExpense.whatPlaceholder}
        />
        {unbought.length > 0 && (
          <View style={styles.wrap}>
            <Text style={styles.meta}>{he.addExpense.fromList}</Text>
            {unbought.map((i) => (
              <SuggestionChip
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
        >
          {view.activeIds.map((id) => {
            const selected = id === payer;
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
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

      <SharePicker view={view} shares={shares} onChange={setShares} amount={agorot} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
  payers: { gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  payer: { minWidth: 56, alignItems: 'center', gap: 6 },
  payerRing: { borderRadius: 30, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  payerOn: { borderColor: colors.accent },
  payerName: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
  payerNameOn: { fontFamily: fonts.semibold, color: colors.ink },
});
