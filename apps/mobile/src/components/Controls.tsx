import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text
              style={[
                styles.label,
                selected
                  ? { color: colors.ink, fontFamily: fonts.semibold }
                  : { color: colors.inkSecondary },
              ]}
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
      style={[
        styles.switchTrack,
        {
          justifyContent: value ? 'flex-end' : 'flex-start',
          backgroundColor: value ? colors.accent : colors.borderPill,
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
    borderRadius: 24,
    backgroundColor: 'rgba(14,23,38,0.06)',
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.white, boxShadow: '0 1px 4px rgba(14,23,38,0.14)' },
  label: { fontFamily: fonts.medium, fontSize: 16 },
  switchTrack: {
    width: 52,
    height: 32,
    padding: 3,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  knob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    boxShadow: '0 1px 3px rgba(14,23,38,0.25)',
  },
});
