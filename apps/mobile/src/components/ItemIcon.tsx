import { catalogIcon, type ListKind } from '@yallist/domain';
import { StyleSheet, Text, View } from 'react-native';

import { useShowItemIcons } from '@/state/preferences';
import { colors } from '@/theme';

/** What an item the catalog doesn't know gets: a box. */
const FALLBACK: Record<ListKind, string> = { bring: '🎒', buy: '🛒' };

/**
 * The picture of an item, by its name: an emoji in a soft circle. Decorative, so hidden from
 * screen readers, which read the name beside it. Nothing at all when the user turned item icons
 * off in their profile.
 */
export function ItemIcon({
  name,
  list = 'bring',
  size = 40,
}: {
  name: string;
  list?: ListKind;
  size?: number;
}) {
  const show = useShowItemIcons();
  if (!show) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.glyph, { fontSize: size * 0.5, lineHeight: size * 0.62 }]}>
        {catalogIcon(name) ?? FALLBACK[list]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' },
  glyph: { textAlign: 'center' },
});
