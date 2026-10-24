import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/theme';

/** White rounded card with inset dividers between children. */
export function ListGroup({
  children,
  inset = 16,
  style,
}: {
  children: ReactNode;
  inset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const rows = Children.toArray(children);
  return (
    <View style={[styles.group, style]}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={[styles.divider, { marginStart: inset }]} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

export function SectionHeader({
  title,
  aside,
  asideColor = colors.inkSecondary,
}: {
  title: string;
  aside?: string;
  asideColor?: string;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {aside && <Text style={[styles.aside, { color: asideColor }]}>{aside}</Text>}
    </View>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.group, backgroundColor: colors.surface, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.divider },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  aside: { fontFamily: fonts.semibold, fontSize: 13 },
  empty: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: radius.group,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.inkSecondary,
    textAlign: 'center',
  },
});
