import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from './Icon';

import { colors, fonts } from '@/theme';

/** Web gets a real backdrop blur; native uses the translucent fallback until iOS ships. */
export const glassStyle =
  Platform.OS === 'web'
    ? {
        backgroundColor: colors.glass,
        backdropFilter: 'blur(20px) saturate(180%)',
      }
    : { backgroundColor: colors.glassFallback };

export interface TabSpec<T extends string> {
  value: T;
  label: string;
  icon: IconName;
  badge?: number;
}

/** Floating glass tab bar; leaves room for the FAB at the end side. */
export function GlassTabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: TabSpec<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={[styles.bar, glassStyle]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const selected = t.value === value;
        const color = selected ? colors.accent : colors.inkSecondary;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(t.value)}
            style={[styles.tab, selected && { backgroundColor: colors.accentTint }]}
          >
            <View>
              <Icon name={t.icon} color={color} size={22} />
              {!!t.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, { color }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Fab({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 20,
    start: 16,
    end: 92,
    height: 68,
    padding: 6,
    gap: 2,
    flexDirection: 'row',
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    boxShadow: '0 10px 30px rgba(14,23,38,0.16)',
  },
  tab: { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontFamily: fonts.semibold, fontSize: 11 },
  badge: {
    position: 'absolute',
    top: -5,
    end: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.missing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 10, lineHeight: 12 },
  fab: {
    position: 'absolute',
    bottom: 22,
    end: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(14,23,38,0.28)',
  },
});
