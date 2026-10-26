import { claimCap, type Claim, type Item, type ItemStatus } from '@yallist/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { StatusRing, type RingState } from '@/components/StatusRing';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
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
  packed,
  onOpen,
  onClaim,
  onPack,
}: {
  item: Item;
  claims: readonly Claim[];
  view: TripView;
  me: string;
  /** In "אצלי": whether I packed it, and the ring becomes my packed checkbox. */
  packed?: boolean;
  onOpen: () => void;
  onClaim: (quantity: number) => void;
  onPack: (packed: boolean) => void;
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
      <ClaimStepper mine={mine} canAdd={claimCap(item, claims, me) > mine} onChange={onClaim} />
    );
  } else if (status.kind === 'missing') {
    action = (
      <PillButton
        label={item.list === 'buy' ? he.trip.claimBuy : he.trip.claimBring}
        variant="soft"
        {...testId('item-claim')}
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
        {...testId('item-release')}
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
      {packed === undefined ? (
        <StatusRing state={ringOf(status)} label={line.label} />
      ) : (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: packed }}
          accessibilityLabel={he.trip.packedLabel(item.name)}
          {...testId(`item-packed-${item.id}`)}
          onPress={() => onPack(!packed)}
          style={styles.check}
        >
          {/* The UI tests can't read aria-checked on web: the tick has its own id. */}
          <View
            style={[styles.box, packed && styles.boxOn]}
            {...testId(packed ? 'item-packed-tick' : undefined)}
          >
            {packed && <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={3} />}
          </View>
        </Pressable>
      )}
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
  // A 44px target around the 28px ring, taking the ring's place in the row.
  check: {
    width: space.touch,
    height: space.touch,
    margin: (28 - space.touch) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space.touch },
  main: { flex: 1, minWidth: 0, gap: space[1], justifyContent: 'center', minHeight: space.touch },
  name: { ...type.itemTitle, color: colors.ink },
  qty: { ...type.caption, color: colors.inkMuted },
  status: { ...type.caption },
  mine: { fontFamily: type.itemTitle.fontFamily },
  detail: { fontFamily: type.caption.fontFamily, color: colors.inkMuted },
});
