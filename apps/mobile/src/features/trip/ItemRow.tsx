import type { Claim, Item } from '@yallist/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { colors, fonts } from '@/theme';

import type { TripView } from './derive';
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

  let action = null;
  if (item.kind === 'each') {
    action = (
      <PillButton
        label={he.trip.have}
        variant={mine ? 'solid' : 'soft'}
        icon={mine ? <Icon name="check" size={16} color={colors.white} /> : undefined}
        accessibilityState={{ selected: mine > 0 }}
        onPress={() => onClaim(mine ? 0 : 1)}
      />
    );
  } else if (item.kind === 'qty') {
    const canAdd = status.kind === 'missing' || status.kind === 'partial';
    action = (
      <View style={styles.stepper}>
        <StepButton
          icon="plus"
          label={he.trip.plusOne}
          disabled={!canAdd}
          onPress={() => onClaim(mine + 1)}
        />
        <Text style={[styles.count, mine > 0 && { color: colors.accent }]}>{mine}</Text>
        <StepButton
          icon="minus"
          label={he.trip.minusOne}
          disabled={mine === 0}
          onPress={() => onClaim(mine - 1)}
        />
      </View>
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

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'plus' | 'minus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.step, disabled && { opacity: 0.3 }]}
    >
      <Icon name={icon} size={20} />
    </Pressable>
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ground,
  },
  step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  count: {
    minWidth: 20,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.inkSecondary,
  },
});
