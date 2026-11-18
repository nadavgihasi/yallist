import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { fieldStyles } from '@/components/Fields';
import { testId } from '@/lib/testId';
import { colors, fonts } from '@/theme';

import type { TripView } from './derive';

/** One person out of `ids`, as a row of avatars: who paid an expense, who paid whom. */
export function PersonPicker({
  view,
  ids,
  value,
  onChange,
  label,
  testID,
}: {
  view: TripView;
  ids: string[];
  value: string | undefined;
  onChange: (id: string) => void;
  label: string;
  /** Each avatar gets `${testID}-${userId}`. */
  testID?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={fieldStyles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.people}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {ids.map((id) => {
          const selected = id === value;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={view.nameOf(id)}
              onPress={() => onChange(id)}
              style={styles.person}
              {...(testID ? testId(`${testID}-${id}`) : {})}
            >
              <View style={[styles.ring, selected ? styles.ringOn : { opacity: 0.55 }]}>
                <Avatar person={view.avatarOf(id)} size={52} ring={false} />
              </View>
              <Text style={[styles.name, selected && styles.nameOn]}>{view.nameOf(id)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  people: { gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  person: { minWidth: 56, alignItems: 'center', gap: 6 },
  ring: { borderRadius: 30, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: colors.primary },
  name: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  nameOn: { fontFamily: fonts.bold, color: colors.ink },
});
