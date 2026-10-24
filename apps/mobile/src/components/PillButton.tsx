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

type Variant = 'solid' | 'soft' | 'quiet' | 'neutral' | 'outline' | 'success' | 'danger';

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  solid: { bg: colors.accent, fg: colors.white },
  soft: { bg: colors.accentTint, fg: colors.accent },
  quiet: { bg: colors.ground, fg: colors.inkSecondary },
  neutral: { bg: 'rgba(14,23,38,0.06)', fg: colors.ink },
  outline: { bg: colors.white, fg: colors.ink, border: colors.borderPill },
  success: { bg: colors.successTint, fg: colors.success },
  danger: { bg: 'transparent', fg: colors.missing },
};

/** Heights and type from the mockups: sm = row release chip, lg = wide card buttons, xl = sheet CTAs. */
const SIZES = {
  sm: { height: 44, padding: 14, fontSize: 14 },
  md: { height: 44, padding: 16, fontSize: 15 },
  lg: { height: 52, padding: 24, fontSize: 16 },
  xl: { height: 58, padding: 24, fontSize: 17 },
} as const;

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
  size?: keyof typeof SIZES;
  icon?: ReactNode;
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const { height, padding, fontSize } = SIZES[size];
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
          paddingHorizontal: padding,
        },
        wide && styles.wide,
        variant === 'solid' && height > 44 && styles.shadow,
        style,
      ]}
      {...rest}
    >
      {icon && <View>{icon}</View>}
      <Text style={[styles.label, { color: v.fg, fontSize }, size === 'sm' && styles.labelSm]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  wide: { alignSelf: 'stretch' },
  label: { fontFamily: fonts.semibold },
  labelSm: { fontFamily: fonts.medium },
  shadow: {
    boxShadow: '0 10px 24px rgba(14,23,38,0.22)',
  },
});
