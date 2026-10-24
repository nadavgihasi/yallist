import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { he } from '@/i18n/he';
import { colors, fonts } from '@/theme';

/** "+ 2 −" stepper for my share of a qty item. */
export function ClaimStepper({
  mine,
  canAdd,
  onChange,
}: {
  mine: number;
  canAdd: boolean;
  onChange: (quantity: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <StepButton
        icon="plus"
        label={he.trip.plusOne}
        disabled={!canAdd}
        onPress={() => onChange(mine + 1)}
      />
      <Text style={[styles.count, mine > 0 && { color: colors.accent }]}>{mine}</Text>
      <StepButton
        icon="minus"
        label={he.trip.minusOne}
        disabled={mine === 0}
        onPress={() => onChange(mine - 1)}
      />
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
