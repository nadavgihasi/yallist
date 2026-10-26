import { TEMPLATES, type TemplateId } from '@yallist/domain';
import { Pressable, StyleSheet, Text, View, type AccessibilityRole } from 'react-native';

import { TripTile } from './TripTile';

import { he, itemsCount } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { colors, radius, space, type } from '@/theme';

/**
 * A trip template to start from: its tile, name and how many items it brings. `row` lays it out
 * as a line (home); otherwise stacked (the new-trip picker, where it's a radio).
 */
export function TemplateTile({
  template,
  onPress,
  testID,
  selected,
  role = 'button',
  row = false,
}: {
  template: TemplateId;
  onPress: () => void;
  testID: string;
  selected?: boolean;
  role?: AccessibilityRole;
  row?: boolean;
}) {
  const count = TEMPLATES[template].length;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={he.newTrip.templates[template]}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      {...testId(testID)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        row ? styles.row : styles.stack,
        selected && styles.on,
        pressed && styles.pressed,
      ]}
    >
      <TripTile template={template} size={44} />
      <View style={styles.texts}>
        <Text style={styles.name}>{he.newTrip.templates[template]}</Text>
        <Text style={styles.meta}>{count ? itemsCount(count) : he.newTrip.blankHint}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { padding: space[4], borderRadius: radius.card, backgroundColor: colors.card },
  stack: { minHeight: 120, gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  texts: { gap: space[2], flexShrink: 1 },
  on: { backgroundColor: colors.primaryTint },
  pressed: { opacity: 0.75 },
  name: { ...type.itemTitle, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
});
