import { formatShekel } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { deriveTrip } from '@/features/trip/derive';
import { he } from '@/i18n/he';
import { formatMoment } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useMe } from '@/state/store';
import { useTrip, useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

type Payment = TripData['payments'][number];

/** One recorded payment: who paid whom, who recorded it and when, and a way to delete it. */
export default function PaymentDetail() {
  const { tripId, paymentId } = useLocalSearchParams<{ tripId: string; paymentId: string }>();
  const data = useTrip(tripId);
  const payment = data?.payments.find((p) => p.id === paymentId);
  const close = useCloseSheet(tripId);
  // Deleted meanwhile (here, or by someone else).
  useEffect(() => {
    if (data && !payment) close();
  }, [data, payment, close]);
  if (!data || !payment) return null;
  return <Detail data={data} payment={payment} close={close} />;
}

function Detail({
  data,
  payment,
  close,
}: {
  data: TripData;
  payment: Payment;
  close: (then?: () => void) => void;
}) {
  const me = useMe().userId;
  const act = useTripAction(data.trip.id);
  const view = deriveTrip(data, me);
  const [confirming, setConfirming] = useState(false);

  const remove = () =>
    close(() => {
      act({ type: 'deletePayment', paymentId: payment.id });
      showToast(he.payment.deleted);
    });

  const person = (id: string) => (
    <View style={styles.person}>
      <Avatar person={view.avatarOf(id)} size={28} ring={false} />
      <Text style={styles.value}>{view.nameOf(id)}</Text>
    </View>
  );

  return (
    <Sheet
      title={he.payment.detail}
      subtitle={formatShekel(payment.amountAgorot)}
      onClose={close}
      gap={space[5]}
      footer={
        view.mayDeletePayment(payment) &&
        (confirming ? (
          <View style={styles.confirm} {...testId('payment-confirm-delete')}>
            <Text style={styles.confirmTitle} accessibilityRole="alert">
              {he.payment.confirmTitle}
            </Text>
            <Text style={styles.caption}>{he.payment.confirmText}</Text>
            <View style={styles.confirmButtons}>
              <PillButton
                label={he.payment.confirmDelete}
                variant="danger"
                icon={<Icon name="trash" size={18} color={colors.brandStrong} />}
                onPress={remove}
                {...testId('payment-delete-confirm')}
              />
              <PillButton
                label={he.payment.cancel}
                variant="quiet"
                onPress={() => setConfirming(false)}
              />
            </View>
          </View>
        ) : (
          <PillButton
            label={he.payment.delete}
            variant="danger"
            wide
            icon={<Icon name="trash" size={18} color={colors.brandStrong} />}
            onPress={() => setConfirming(true)}
            {...testId('payment-delete')}
          />
        ))
      }
    >
      <View style={styles.facts}>
        <Fact label={he.payment.from}>{person(payment.fromUser)}</Fact>
        <Fact label={he.payment.to}>{person(payment.toUser)}</Fact>
        <Fact label={he.payment.recordedBy}>
          <Text style={styles.value}>{view.nameOf(payment.createdBy)}</Text>
        </Fact>
        <Fact label={he.payment.recordedAt}>
          <Text style={styles.value}>{formatMoment(payment.createdAt)}</Text>
        </Fact>
      </View>
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
  confirm: { gap: space[2] },
  confirmTitle: { ...type.itemTitle, color: colors.ink },
  confirmButtons: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
});
