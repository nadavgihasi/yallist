import type { Claim, Item, ItemStatus } from '@yallist/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { StatusRing, type RingState } from '@/components/StatusRing';
import { he } from '@/i18n/he';
import { colors, space, type } from '@/theme';

import type { TripView } from './derive';
import { ClaimStepper } from './ClaimStepper';
import { TONE_COLOR, quantityText, statusLine } from './labels';

/** Dashed while something is still missing, a ring once someone has it, a brand check once bought. */
function ringOf(status: ItemStatus): RingState {
  switch (status.kind) {
    case 'missing':
    case 'partial':
    case 'each':
      return 'open';
    case 'bought':
      return 'done';
    default:
      return 'held';
  }
}

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
        icon={mine ? <Icon name="check" size={16} color={colors.onPrimary} /> : undefined}
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
        icon={<Icon name="close" size={16} color={colors.inkMuted} />}
        onPress={() => onClaim(0)}
      />
    );
  } else {
    const holders = claims.filter((c) => c.itemId === item.id).map((c) => view.avatarOf(c.userId));
    if (holders.length > 0) action = <AvatarStack people={holders} size={32} />;
  }

  return (
    <View style={styles.row}>
      <StatusRing state={ringOf(status)} label={line.label} />
      <Pressable style={styles.main} onPress={onOpen} accessibilityRole="button">
        <Text style={styles.name}>
          {item.name}
          {!!qty && <Text style={styles.qty}> {qty}</Text>}
        </Text>
        <Text
          style={[
            styles.status,
            { color: TONE_COLOR[line.tone] },
            line.tone === 'mine' && styles.mine,
          ]}
        >
          {line.label}
          {!!line.detail && <Text style={styles.detail}> · {line.detail}</Text>}
        </Text>
      </Pressable>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space.touch },
  main: { flex: 1, minWidth: 0, gap: space[1], justifyContent: 'center', minHeight: space.touch },
  name: { ...type.itemTitle, color: colors.ink },
  qty: { ...type.caption, color: colors.inkMuted },
  status: { ...type.caption },
  mine: { fontFamily: type.itemTitle.fontFamily },
  detail: { fontFamily: type.caption.fontFamily, color: colors.inkMuted },
});
