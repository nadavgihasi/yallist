import { formatShekel, parseShekel, shekelInput } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AmountField } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { deriveTrip } from '@/features/trip/derive';
import { PersonPicker } from '@/features/trip/PersonPicker';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useMe } from '@/state/store';
import { useTrip, useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

/**
 * Records that someone paid someone: anyone in the trip, for any two people in it, and it counts
 * at once. It starts on the transfer that concerns me, and fills in what's open between the two.
 */
export default function RecordPayment() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const data = useTrip(tripId);
  if (!data) return null;
  return <Form data={data} />;
}

function Form({ data }: { data: TripData }) {
  const me = useMe().userId;
  const view = deriveTrip(data, me);
  const act = useTripAction(data.trip.id);
  const close = useCloseSheet(data.trip.id);
  // Former members stay on offer while money is still open with them.
  const people = [
    ...new Set([...view.activeIds, ...view.transfers.flatMap((t) => [t.from, t.to])]),
  ];
  const openBetween = (from: string, to: string | undefined) =>
    view.transfers.find((t) => t.from === from && t.to === to);
  const first =
    view.transfers.find((t) => t.from === me) ??
    view.transfers.find((t) => t.to === me) ??
    view.transfers[0];

  const [from, setFrom] = useState(first?.from ?? me);
  const [to, setTo] = useState(first?.to);
  const [amount, setAmount] = useState(first ? shekelInput(first.amountAgorot) : '');
  const [tried, setTried] = useState(false);
  const agorot = parseShekel(amount);
  const open = openBetween(from, to);

  // A new pair starts from what's open between them.
  const pick = (nextFrom: string, nextTo: string | undefined) => {
    setFrom(nextFrom);
    setTo(nextTo);
    const o = openBetween(nextFrom, nextTo);
    setAmount(o ? shekelInput(o.amountAgorot) : '');
  };

  const save = () => {
    if (!to || !agorot) {
      setTried(true);
      return;
    }
    close(() => {
      act({ type: 'recordPayment', fromUser: from, toUser: to, amountAgorot: agorot });
      showToast(he.money.recordedToast(formatShekel(agorot)), 'success');
    });
  };

  return (
    <Sheet
      title={he.payment.title}
      onClose={close}
      gap={space[5]}
      footer={
        <PillButton
          label={agorot ? he.payment.save(formatShekel(agorot)) : he.payment.saveEmpty}
          size="lg"
          wide
          disabled={!to}
          onPress={save}
          {...testId('payment-save')}
        />
      }
    >
      <PersonPicker
        view={view}
        ids={people}
        value={from}
        onChange={(id) => pick(id, id === to ? undefined : to)}
        label={he.payment.from}
        testID="payment-from"
      />
      <PersonPicker
        view={view}
        ids={people.filter((id) => id !== from)}
        value={to}
        onChange={(id) => pick(from, id)}
        label={he.payment.to}
        testID="payment-to"
      />
      {/* Once both are picked, say it in one line before the amount. */}
      {to && (
        <Text style={styles.sentence} {...testId('payment-sentence')}>
          {he.payment.sentence(
            from === me ? he.payment.fromMe : he.payment.fromName(view.displayNameOf(from)),
            to === me ? he.payment.toMe : he.payment.toName(view.displayNameOf(to)),
          )}
        </Text>
      )}
      <AmountField
        label={he.payment.amount}
        value={amount}
        onChangeText={setAmount}
        size="lg"
        testID="payment-amount"
        onSubmitEditing={save}
        error={
          amount.trim() && agorot === undefined
            ? he.invalidAmount
            : tried && !agorot
              ? he.payment.needAmount
              : undefined
        }
      />
      {to && (
        <Text style={styles.caption}>
          {open ? he.payment.open(formatShekel(open.amountAgorot)) : he.payment.noneOpen}
        </Text>
      )}
      <Text style={styles.caption}>{he.payment.hint}</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sentence: { ...type.sectionTitle, fontSize: 20, lineHeight: 26, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
});
