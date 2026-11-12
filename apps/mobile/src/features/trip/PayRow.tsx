import { formatIsraeliMobile, formatShekel, shekelInput, type Transfer } from '@yallist/domain';
import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { AmountField } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { copyText } from '@/lib/clipboard';
import { testId } from '@/lib/testId';
import { colors, radius, space, type } from '@/theme';

import type { TripView } from './derive';
import { localPhone, partialAmount } from './settle';

/**
 * One debt of mine, ready to pay: who and how much, their number for Bit or PayBox with buttons
 * to copy both, and a mark-as-paid for this debt alone, for all of it or for what I actually sent.
 * Without their number, a message that asks them for it.
 */
export function PayRow({
  view,
  transfer,
  tripName,
  saving,
  onMark,
}: {
  view: TripView;
  transfer: Transfer;
  tripName: string;
  /** A change is on its way: transfers are the API's, so a second mark would pay twice. */
  saving: boolean;
  onMark: (amountAgorot: number) => void;
}) {
  const { to, amountAgorot } = transfer;
  const name = view.displayNameOf(to);
  const phone = view.memberById.get(to)?.paymentPhone;
  const [other, setOther] = useState<string>();
  const partial = other === undefined ? undefined : partialAmount(other, amountAgorot);

  const copy = async (text: string) => {
    if (await copyText(text)) showToast(he.settle.copied);
    else showToast(he.errors.failed, 'error');
  };
  const askPhone = async () => {
    const message = he.settle.askPhoneMessage(name, formatShekel(amountAgorot), tripName);
    try {
      await Share.share({ message });
    } catch (e) {
      // Closing the share sheet isn't a failure. Where the browser can't share, copy it instead.
      if (e instanceof Error && e.name === 'AbortError') return;
      if (Platform.OS === 'web') await copy(message);
    }
  };

  return (
    <View style={styles.row} {...testId(`pay-${to}`)}>
      <View style={styles.head}>
        <Avatar person={view.avatarOf(to)} size={40} ring={false} />
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>
            {he.settle.to(name)}
          </Text>
          {/* Without a number, the sentence that says so wraps rather than losing its end. */}
          <Text style={styles.caption} numberOfLines={phone ? 1 : undefined}>
            {phone ? formatIsraeliMobile(phone) : he.settle.noPhone(name)}
          </Text>
        </View>
        <Text style={styles.amount}>{formatShekel(amountAgorot)}</Text>
      </View>

      <View style={styles.actions}>
        <PillButton
          label={he.settle.copyAmount}
          variant="soft"
          size="sm"
          onPress={() => void copy(shekelInput(amountAgorot))}
        />
        {phone ? (
          <PillButton
            label={he.settle.copyPhone}
            variant="soft"
            size="sm"
            onPress={() => void copy(localPhone(phone))}
            {...testId('pay-copy-phone')}
          />
        ) : (
          <PillButton
            label={he.settle.askPhone}
            variant="soft"
            size="sm"
            onPress={() => void askPhone()}
          />
        )}
      </View>

      {other === undefined ? (
        <View style={styles.actions}>
          <PillButton
            label={he.settle.markPaid}
            size="sm"
            disabled={saving}
            onPress={() => onMark(amountAgorot)}
            {...testId('pay-mark')}
          />
          <PillButton
            label={he.settle.otherAmount}
            variant="quiet"
            size="sm"
            disabled={saving}
            onPress={() => setOther('')}
            {...testId('pay-other')}
          />
        </View>
      ) : (
        <View style={styles.other}>
          <AmountField
            label={he.settle.howMuch}
            value={other}
            onChangeText={setOther}
            testID="pay-other-amount"
            error={partial?.error}
          />
          <View style={styles.actions}>
            <PillButton
              label={
                partial?.agorot
                  ? he.settle.markPart(formatShekel(partial.agorot))
                  : he.settle.markPaid
              }
              size="sm"
              disabled={saving || !partial?.agorot}
              onPress={() => {
                if (!partial?.agorot) return;
                onMark(partial.agorot);
                setOther(undefined);
              }}
              {...testId('pay-other-mark')}
            />
            <PillButton
              label={he.settle.cancel}
              variant="quiet"
              size="sm"
              onPress={() => setOther(undefined)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: space[3],
    padding: space[3],
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  who: { flex: 1, gap: 2 },
  name: { ...type.itemTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  amount: { ...type.itemTitle, color: colors.brandStrong },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  other: { gap: space[3] },
});
