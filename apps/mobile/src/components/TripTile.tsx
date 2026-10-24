import type { TemplateId } from '@yallist/domain';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from './Icon';

import { colors, radius } from '@/theme';

const illo = colors.illustration;

/** Icon and illustration color per trip template (trips.html). */
const TILES: Record<TemplateId, { icon: IconName; bg: string; fg: string }> = {
  camp: { icon: 'tent', bg: illo.tent, fg: colors.ink },
  grill: { icon: 'flame', bg: illo.sun, fg: colors.ink },
  zimmer: { icon: 'mountain', bg: illo.hill, fg: colors.onPrimary },
  beach: { icon: 'sun', bg: illo.sky, fg: colors.ink },
  blank: { icon: 'bring', bg: illo.water, fg: colors.onPrimary },
};

/** The rounded icon tile that marks a trip. */
export function TripTile({ template, size = 48 }: { template: TemplateId; size?: number }) {
  const t = TILES[template];
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * radius.iconRatio, backgroundColor: t.bg },
      ]}
    >
      <Icon name={t.icon} color={t.fg} size={Math.round(size * 0.54)} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
