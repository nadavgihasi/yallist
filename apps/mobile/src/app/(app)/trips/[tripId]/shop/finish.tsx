import { formatShekel, parseShekel, runSummary } from '@yallist/domain';
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
import { perPersonText } from '@/features/trip/labels';
import { ReceiptField } from '@/features/trip/ReceiptField';
import { RunParts } from '@/features/trip/RunParts';
import { runSplit, type PartDraft } from '@/features/trip/runSplit';
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
  // Parts of the total split between other people (alcohol, meat); none by default.
  const [parts, setParts] = useState<PartDraft[]>([]);
  const [receipt, setReceipt] = useState<string>();

  const { inCart, notInCart } = runSummary(view.runClaims(runId), view.items);
  const agorot = parseShekel(amount);
  const split = runSplit(agorot, shares, parts);
  const valid = !!agorot && agorot <= MAX_AGOROT && !split.error;
  const perPerson = parts.length === 0 ? perPersonText(agorot, shares.length) : undefined;

  const save = () => {
    if (!valid || inCart.length === 0) return;
    close(() =>
      act({
        type: 'finishRun',
        runId,
        amountAgorot: agorot,
        shares,
        parts: split.parts,
        receipt,
      }),
    );
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
          parts.length > 0
            ? he.shop.finish.byParts
            : perPerson
              ? he.shop.finish.perPerson(perPerson)
              : he.shop.finish.enterAmount
        }
        text={
          parts.length > 0
            ? (split.error ?? he.shop.finish.whoPays)
            : he.shop.finish.split(shares.length, view.activeIds.length)
        }
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
        <>
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
          />
          <RunParts view={view} parts={parts} onChange={setParts} />
        </>
      )}
      {/* Under the parts, where they're edited: the total they come out of, and why it can't be
          saved yet or what each pays. */}
      {parts.length > 0 && (
        <View style={styles.owed} {...testId('shop-finish-owed')}>
          <Text style={styles.title} accessibilityRole="header">
            {agorot ? he.shop.finish.whoPaysOf(formatShekel(agorot)) : he.shop.finish.whoPays}
          </Text>
          {split.error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {split.error}
            </Text>
          )}
          {view.activeIds
            .map((id): [string, number] => [id, split.owed.get(id) ?? 0])
            .filter(([, owed]) => owed > 0)
            .map(([id, owed]) => (
              <View key={id} style={styles.owedRow}>
                <Text style={styles.text}>{view.displayNameOf(id)}</Text>
                <Text style={styles.owedAmount}>{formatShekel(owed)}</Text>
              </View>
            ))}
        </View>
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
  owed: { gap: space[1] },
  error: { ...type.caption, color: colors.brandStrong },
  owedRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  owedAmount: { ...type.itemTitle, color: colors.ink },
});
