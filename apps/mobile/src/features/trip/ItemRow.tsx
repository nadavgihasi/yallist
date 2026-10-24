import type { Claim, Item } from '@yallist/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { colors, fonts } from '@/theme';

import type { TripView } from './derive';
import { ClaimStepper } from './ClaimStepper';
import { TONE_COLOR, quantityText, statusLine } from './labels';

export function ItemRow({
  item,
  claims,
  view,
  me,
  onOpen,
  onClaim,
}: {
  item: Item;
  claims: readonly Claim[];
  view: TripView;
  me: string;
  onOpen: () => void;
  onClaim: (quantity: number) => void;
}) {
  const status = view.status(item);
  const line = statusLine(item, status, claims, view, me);
  const qty = quantityText(item, claims);
  const mine = view.myQuantity(item.id);

  // Once bought (it has an expense), claims are settled: show who has it instead of controls.
  const bought = status.kind === 'bought';
  let action = null;
  if (item.kind === 'each' && !bought) {
    action = (
      <PillButton
        label={he.trip.have}
        variant={mine ? 'solid' : 'soft'}
        icon={mine ? <Icon name="check" size={16} color={colors.white} /> : undefined}
        accessibilityState={{ checked: mine > 0 }}
        onPress={() => onClaim(mine ? 0 : 1)}
      />
    );
  } else if (item.kind === 'qty' && !bought) {
    action = (
      <ClaimStepper
        mine={mine}
        canAdd={status.kind === 'missing' || status.kind === 'partial'}
        onChange={onClaim}
      />
    );
  } else if (status.kind === 'missing') {
    action = (
      <PillButton
        label={item.list === 'buy' ? he.trip.claimBuy : he.trip.claimBring}
        variant="soft"
        onPress={() => onClaim(item.quantityNeeded)}
      />
    );
  } else if (status.kind === 'mine') {
    action = (
      <PillButton
        label={he.trip.release}
        variant="quiet"
        size="sm"
        accessibilityLabel={he.trip.releaseLabel}
        icon={<Icon name="close" size={16} color={colors.inkSecondary} />}
        onPress={() => onClaim(0)}
      />
    );
  } else {
    const holders = claims.filter((c) => c.itemId === item.id).map((c) => view.avatarOf(c.userId));
    if (holders.length > 0) action = <AvatarStack people={holders} max={3} size={36} />;
  }

  return (
    <View style={styles.row}>
      <Pressable style={styles.main} onPress={onOpen} accessibilityRole="button">
        <View style={styles.nameLine}>
          <Text style={styles.name}>{item.name}</Text>
          {!!qty && <Text style={styles.qty}>{qty}</Text>}
        </View>
        <View style={styles.statusLine}>
          <Text style={[styles.status, { color: TONE_COLOR[line.tone] }]}>{line.label}</Text>
          {!!line.detail && <Text style={styles.detail}>{line.detail}</Text>}
        </View>
      </Pressable>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 76,
  },
  main: { flex: 1, minWidth: 0, gap: 4 },
  nameLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  name: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  qty: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  status: { fontFamily: fonts.semibold, fontSize: 13 },
  detail: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
});
