import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, type } from '@/theme';

/** Pill segments on a white track (trip.html tabs); pass a `ground` track when it sits on a card. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string; accessibilityLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.track, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.accessibilityLabel}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text
              style={[type.buttonSm, { color: selected ? colors.onPrimary : colors.inkMuted }]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** On/off switch. Knob sits at the start when off and the end when on (RTL-aware via flex). */
export function Switch({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={6} // 32px track, 44px target
      style={[
        styles.switchTrack,
        {
          justifyContent: value ? 'flex-end' : 'flex-start',
          backgroundColor: value ? colors.primary : colors.line,
        },
      ]}
    >
      <View style={styles.knob} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.primary },
  switchTrack: {
    width: 52,
    height: 32,
    padding: 3,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.card },
});
