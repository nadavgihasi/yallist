import {
  bagItemFor,
  claimCap,
  packingStatus,
  type BagItem,
  type Claim,
  type Item,
  type Packing,
} from '@yallist/domain';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { ItemIcon } from '@/components/ItemIcon';
import { PillButton } from '@/components/PillButton';
import { StatusRing, type RingState } from '@/components/StatusRing';
import { he } from '@/i18n/he';
import { isolate } from '@/lib/bidi';
import { testId } from '@/lib/testId';
import { colors, space, type } from '@/theme';

import type { TripView } from './derive';
import { ClaimStepper } from './ClaimStepper';
import { TONE_COLOR, packedText, quantityText, statusLine } from './labels';
import { noteLine, ringClaim } from './rowActions';

/** Dashed while something is still missing, a ring once covered, a brand check once packed. */
const RING: Record<Packing, RingState> = { missing: 'open', covered: 'held', packed: 'done' };

/** `aria-pressed` on web, which React Native's types lack; native reads it as selected. */
const pressed = (on: boolean) =>
  Platform.OS === 'web'
    ? ({ 'aria-pressed': on } as object)
    : { accessibilityState: { selected: on } };

export function ItemRow({
  item,
  claims,
  view,
  me,
  bag = [],
  onOpen,
  onClaim,
  onPack,
}: {
  item: Item;
  claims: readonly Claim[];
  view: TripView;
  me: string;
  /** My bag: a bring item of the same name is marked, or offered, as mine. */
  bag?: readonly BagItem[];
  onOpen: () => void;
  onClaim: (quantity: number) => void;
  onPack: (packed: boolean) => void;
}) {
  const status = view.status(item);
  const line = bagLine(
    item,
    statusLine(item, status, claims, view, me),
    status.kind,
    bag,
    me,
    claims,
  );
  const qty = quantityText(item, claims);
  const packed = packedText(item, claims, view.activeIds);
  const mine = view.myQuantity(item.id);
  const myClaim = claims.find((c) => c.itemId === item.id && c.userId === me);
  // Nobody has it (or not all of it) and I have none of it: the dashed ring claims it.
  const ringQuantity = ringClaim(item, status, claims, me);
  const note = noteLine(item.note);

  // Once bought (it has an expense), claims are settled: show who has it instead of controls.
  const bought = status.kind === 'bought';
  // Bought is a brand check too (HANDOFF.md color rule).
  const ring = bought ? 'done' : RING[packingStatus(item, claims, view.activeIds).status];
  let action = null;
  // In my bag, a per-person item is mine by itself: what's left is packing it (the ring).
  const fromBag = item.kind === 'each' && !!myClaim && inMyBag(item, bag);
  if (item.kind === 'each' && !bought) {
    action = fromBag ? null : (
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
      {/* My claim on a bring item: the ring packs it. Bought items are packed from my bag. */}
      {myClaim && item.list === 'bring' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={myClaim.packed ? he.trip.unpack : he.trip.pack}
          {...pressed(!!myClaim.packed)}
          {...testId(myClaim.packed ? 'item-unpack' : 'item-pack')}
          onPress={() => onPack(!myClaim.packed)}
          style={styles.toggle}
        >
          <StatusRing state={myClaim.packed ? 'done' : ring} label={he.status.packed} />
        </Pressable>
      ) : ringQuantity !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={he.trip.ringClaim(claimLabel(item), item.name)}
          {...testId('item-ring-claim')}
          onPress={() => onClaim(ringQuantity)}
          style={styles.toggle}
        >
          <StatusRing state={ring} />
        </Pressable>
      ) : (
        <StatusRing state={ring} label={line.label} />
      )}
      <ItemIcon name={item.name} list={item.list} />
      <Pressable style={styles.main} onPress={onOpen} accessibilityRole="button">
        <Text style={styles.name}>
          {item.name}
          {/* Isolated, so an English word or number ending the name doesn't pull it across, and
              in one piece: `500 גרם` doesn't wrap between the number and its unit. */}
          {!!qty && <Text style={styles.qty}> {isolate(qty.replaceAll(' ', '\u00a0'))}</Text>}
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
          {!!packed && <Text style={styles.detail}> · {packed}</Text>}
        </Text>
        {!!note && (
          <Text style={styles.note} numberOfLines={1} {...testId('item-note')}>
            {note}
          </Text>
        )}
      </Pressable>
      {action}
    </View>
  );
}

/** What the row's claim control says, which the ring does too: on a qty item, the stepper's +. */
const claimLabel = (item: Item) =>
  item.kind === 'each'
    ? he.trip.have
    : item.kind === 'qty'
      ? he.trip.plusOne
      : item.list === 'buy'
        ? he.trip.claimBuy
        : he.trip.claimBring;

const inMyBag = (item: Item, bag: readonly BagItem[]) =>
  item.list === 'bring' && bagItemFor(bag, item.name) !== undefined;

/**
 * The status line where my bag has the item: `בתיק שלך` on a per-person item it marks,
 * `עליך · מהתיק` on a common one I took, and `· בתיק שלך` on one nobody brings yet.
 */
function bagLine(
  item: Item,
  line: ReturnType<typeof statusLine>,
  status: string,
  bag: readonly BagItem[],
  me: string,
  claims: readonly Claim[],
): ReturnType<typeof statusLine> {
  if (!inMyBag(item, bag)) return line;
  const mine = claims.some((c) => c.itemId === item.id && c.userId === me);
  if (item.kind === 'each') return mine ? { label: he.bag.inBag, tone: 'mine' } : line;
  if (status === 'mine') return { label: he.bag.mineFromBag, tone: 'mine' };
  if (status === 'missing') return { ...line, detail: he.bag.inBag };
  return line;
}

const styles = StyleSheet.create({
  // A 44px target around the 28px ring, in the ring's place in the row.
  toggle: {
    width: space.touch,
    height: space.touch,
    margin: (28 - space.touch) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space.touch },
  main: { flex: 1, minWidth: 0, gap: space[1], justifyContent: 'center', minHeight: space.touch },
  // Right to left even when the name starts with an English word, as it was typed.
  name: { ...type.itemTitle, color: colors.ink, writingDirection: 'rtl' },
  qty: { ...type.caption, color: colors.inkMuted },
  status: { ...type.caption },
  mine: { fontFamily: type.itemTitle.fontFamily },
  detail: { fontFamily: type.caption.fontFamily, color: colors.inkMuted },
  note: { ...type.caption, color: colors.inkMuted },
});
