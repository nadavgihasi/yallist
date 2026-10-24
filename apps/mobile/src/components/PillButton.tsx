import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts } from '@/theme';

type Variant = 'solid' | 'soft' | 'quiet' | 'outline' | 'success' | 'danger';

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  solid: { bg: colors.accent, fg: colors.white },
  soft: { bg: colors.accentTint, fg: colors.accent },
  quiet: { bg: colors.ground, fg: colors.inkSecondary },
  outline: { bg: colors.white, fg: colors.ink, border: colors.borderPill },
  success: { bg: colors.successTint, fg: colors.success },
  danger: { bg: 'transparent', fg: colors.missing },
};

export function PillButton({
  label,
  variant = 'solid',
  size = 'md',
  icon,
  wide = false,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  size?: 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const height = { md: 44, lg: 52, xl: 58 }[size];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        {
          minHeight: height,
          borderRadius: height / 2,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          paddingHorizontal: size === 'md' ? 16 : 24,
        },
        wide && styles.wide,
        variant === 'solid' && size !== 'md' && styles.shadow,
        style,
      ]}
      {...rest}
    >
      {icon && <View>{icon}</View>}
      <Text style={[styles.label, { color: v.fg, fontSize: size === 'md' ? 15 : 17 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  wide: { alignSelf: 'stretch' },
  label: { fontFamily: fonts.semibold },
  shadow: {
    boxShadow: '0 10px 24px rgba(14,23,38,0.22)',
  },
});
