import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { PillButton } from './PillButton';

import { testId } from '@/lib/testId';
import { colors, space } from '@/theme';

/** The screen's one floating primary action: bottom-centered, `space-6` from the edge, plus icon. */
export function FloatingAction({
  label,
  onPress,
  disabled,
  icon = true,
  accessibilityLabel,
  testID,
}: {
  label: string;
  /** When the visible label is short ("פריט חדש") and the name should say more. */
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: space[6] + insets.bottom }]} pointerEvents="box-none">
      <PillButton
        label={label}
        size="lg"
        float
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        {...testId(testID)}
        icon={icon ? <Icon name="plus" color={colors.onPrimary} strokeWidth={2.5} /> : undefined}
        onPress={onPress}
      />
    </View>
  );
}

/** Bottom padding for a scroll view under a `FloatingAction`. */
export const FLOATING_CLEARANCE = 120;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: space.screen, end: space.screen, alignItems: 'center' },
});
