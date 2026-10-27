import { formatShekel, parseShekel, perPersonPreview, runSummary } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { deriveTrip } from '@/features/trip/derive';
import { ReceiptField } from '@/features/trip/ReceiptField';
import { SharePicker, useShares } from '@/features/trip/SharePicker';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { pickReceipt } from '@/state/receipts';
import { useMe } from '@/state/store';
import { useTrip, useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

/** The API's cap on one run's total: ₪100,000. */
const MAX_AGOROT = 10_000_000;

/** At the till (PACKING_SHOPPING_SPEC §6.7): one amount for the whole run. */
export default function FinishRun() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const data = useTrip(tripId);
  const me = useMe().userId;
  const run = data?.runs.find((r) => r.shopperId === me);
  if (!data || !run) return null;
  return <FinishRunBody data={data} runId={run.id} />;
}

function FinishRunBody({ data, runId }: { data: TripData; runId: string }) {
  const me = useMe().userId;
  const tripId = data.trip.id;
  const act = useTripAction(tripId);
  // Back to the store screen, which leaves for the trip once the run is over.
  const close = useCloseSheet(tripId);
  const view = deriveTrip(data, me);
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useShares(view);
  const [editShares, setEditShares] = useState(false);
  const [receipt, setReceipt] = useState<string>();

  const { inCart, notInCart } = runSummary(view.runClaims(runId), view.items);
  const agorot = parseShekel(amount);
  const valid = !!agorot && agorot <= MAX_AGOROT && shares.length > 0;
  const perPerson = agorot && perPersonPreview(agorot, shares.length);

  const save = () => {
    if (!valid || inCart.length === 0) return;
    close(() => act({ type: 'finishRun', runId, amountAgorot: agorot, shares, receipt }));
  };
  const cancel = () => close(() => act({ type: 'cancelRun', runId }));
  const photo = async () => {
    try {
      // The web's file input offers the camera on phones too.
      const uri = await pickReceipt(Platform.OS === 'web' ? 'library' : 'camera');
      if (uri) setReceipt(uri);
    } catch (error) {
      console.warn('Receipt pick failed', error);
      showToast(he.errors.failed, 'error');
    }
  };

  return (
    <Sheet
      title={he.shop.finish.title}
      onClose={close}
      gap={space[4]}
      footer={
        inCart.length === 0 ? (
          <>
            <PillButton label={he.shop.finish.empty} size="lg" wide disabled />
            <PillButton label={he.shop.cancel} variant="quiet" wide onPress={cancel} />
          </>
        ) : (
          <PillButton
            label={he.shop.finish.save}
            size="lg"
            wide
            disabled={!valid}
            onPress={save}
            {...testId('shop-finish-save')}
          />
        )
      }
    >
      <AmountField
        label={he.shop.finish.amount}
        value={amount}
        onChangeText={setAmount}
        size="lg"
        testID="shop-finish-amount"
        onSubmitEditing={save}
        error={amount.trim() && !(agorot && agorot <= MAX_AGOROT) ? he.invalidAmount : undefined}
      />
      {receipt ? (
        <ReceiptField uri={receipt} onChange={setReceipt} />
      ) : (
        <PillButton
          label={he.shop.finish.receipt}
          variant="soft"
          wide
          icon={<Icon name="camera" size={20} color={colors.primaryStrong} />}
          onPress={() => void photo()}
        />
      )}

      {inCart.length > 0 && (
        <Summary
          mark={
            <View style={[styles.mark, styles.bought]}>
              <Icon name="check" size={18} color={colors.onPrimary} strokeWidth={3} />
            </View>
          }
          title={he.shop.finish.bought(inCart.length)}
          text={inCart.map((i) => i.name).join(', ')}
        />
      )}
      {notInCart.length > 0 && (
        <Summary
          mark={<View style={[styles.mark, styles.returns]} />}
          title={he.shop.finish.returns(notInCart.map((i) => i.name))}
          text={he.shop.finish.returnsHint}
        />
      )}
      <Summary
        mark={
          <View style={[styles.mark, styles.split]}>
            <Icon name="userPlus" size={18} />
          </View>
        }
        title={
          perPerson ? he.shop.finish.perPerson(formatShekel(perPerson)) : he.shop.finish.enterAmount
        }
        text={he.shop.finish.split(shares.length, view.activeIds.length)}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: editShares }}
            onPress={() => setEditShares(!editShares)}
            style={styles.change}
          >
            <Text style={styles.changeText}>{he.shop.finish.change}</Text>
          </Pressable>
        }
      />
      {editShares && (
        <SharePicker view={view} shares={shares} onChange={setShares} amount={agorot} />
      )}
    </Sheet>
  );
}

function Summary({
  mark,
  title,
  text,
  action,
}: {
  mark: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.summary}>
      {mark}
      <View style={styles.summaryText}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  summaryText: { flex: 1, gap: 2 },
  title: { ...type.itemTitle, color: colors.ink },
  text: { ...type.caption, color: colors.inkMuted },
  mark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bought: { backgroundColor: colors.brand },
  returns: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.inkMuted },
  split: { backgroundColor: colors.ground },
  change: { minHeight: space.touch, justifyContent: 'center', paddingHorizontal: space[1] },
  changeText: { ...type.buttonSm, color: colors.primaryStrong },
});
