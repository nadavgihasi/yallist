import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TabSpec } from './GlassTabBar';
import { Icon } from './Icon';

import { colors, fonts } from '@/theme';

/** Top tab row for wide screens (replaces the bottom GlassTabBar); `end` holds the add action. */
export function TabRow<T extends string>({
  tabs,
  value,
  onChange,
  end,
}: {
  tabs: TabSpec<T>[];
  value: T;
  onChange: (value: T) => void;
  end?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((t) => {
          const selected = t.value === value;
          const color = selected ? colors.accent : colors.inkSecondary;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(t.value)}
              style={[styles.tab, selected && styles.tabOn]}
            >
              <Icon name={t.icon} color={color} size={20} />
              <Text style={[styles.label, { color }]}>{t.label}</Text>
              {!!t.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t.badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {end}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 26,
    backgroundColor: colors.surface,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  tabOn: { backgroundColor: colors.accentTint },
  label: { fontFamily: fonts.semibold, fontSize: 15 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.missing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 12, lineHeight: 14 },
});
