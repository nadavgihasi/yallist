import type { CoverId } from '@yallist/domain';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spot } from './Cover';
import { Card } from './ListGroup';
import { PillButton } from './PillButton';
import type { SpotId } from './stateSpots';

import { testId } from '@/lib/testId';
import { colors, layout, space, type } from '@/theme';

interface Action {
  label: string;
  onPress: () => void;
  /** Default: `empty-state-action` on the first. */
  testID?: string;
}

/**
 * Empty, error, not-found and waiting states: an optional spot, a title, one line, up to two
 * actions (tonal, then quiet) and `children` (chips, tiles). Without a spot it's the small
 * text-only card, for secondary cases.
 */
export function EmptyState({
  spot,
  title,
  text,
  actions = [],
  children,
}: {
  spot?: SpotId | CoverId;
  title: string;
  text: string;
  actions?: [] | [Action] | [Action, Action];
  children?: ReactNode;
}) {
  return (
    <Card gap={space[3]} style={styles.card}>
      {spot && <Spot id={spot} />}
      <View style={styles.texts}>
        <Text style={[styles.title, spot && styles.titleLarge]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      {actions.map((a, i) => (
        <PillButton
          key={a.label}
          label={a.label}
          variant={i === 0 ? 'soft' : 'quiet'}
          onPress={a.onPress}
          {...testId(a.testID ?? (i === 0 ? 'empty-state-action' : undefined))}
        />
      ))}
      {children}
    </Card>
  );
}

/** A whole screen that is one `EmptyState` (not found, load failed, a crash), centered. */
export function StateScreen(props: Parameters<typeof EmptyState>[0]) {
  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <EmptyState {...props} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center' },
  texts: { alignItems: 'center', gap: space[1] },
  title: { ...type.itemTitle, color: colors.ink, textAlign: 'center' },
  titleLarge: { ...type.sectionTitle, fontSize: 24, lineHeight: 30 },
  text: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: space.screen,
    backgroundColor: colors.ground,
  },
  column: { width: '100%', maxWidth: layout.contentMax, alignSelf: 'center' },
});
