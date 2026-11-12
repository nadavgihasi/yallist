import { catalogIcon, type ListKind } from '@yallist/domain';
import { View } from 'react-native';

import { useShowItemIcons } from '@/state/profile';
import { colors } from '@/theme';

import { ITEM_GLYPHS } from './itemGlyphs';

/** What an item the catalog doesn't know is drawn with. */
const FALLBACK = { bring: 'backpack', buy: 'shopping-basket' } as const;

/**
 * An item's line icon, by its name: thin, gray and with no background, so the row's name leads.
 * Decorative, so hidden from screen readers, which read the name beside it. Nothing at all when
 * the user turned item icons off in their profile.
 */
export function ItemIcon({
  name,
  list = 'bring',
  size = 22,
}: {
  name: string;
  list?: ListKind;
  size?: number;
}) {
  const show = useShowItemIcons();
  if (!show) return null;
  const Glyph = ITEM_GLYPHS[catalogIcon(name) ?? FALLBACK[list]];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Glyph size={size} color={colors.inkMuted} strokeWidth={1.75} absoluteStrokeWidth />
    </View>
  );
}
