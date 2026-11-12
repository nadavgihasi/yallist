import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useDismissed } from '@/lib/useDismissed';
import { colors, space, type } from '@/theme';

import type { TripView } from './derive';

/**
 * Right after joining a trip, once: what still has no one bringing it, and a way to pick from
 * those. `onPick` opens the list with more of them, filtered to what's missing; either button
 * puts it away for good on this device (`onDone` clears the URL's `joined` too).
 */
export function JoinedPrompt({
  tripId,
  view,
  onPick,
  onDone,
}: {
  tripId: string;
  view: TripView;
  onPick: (list: 'bring' | 'buy') => void;
  onDone: () => void;
}) {
  const [dismissed, dismiss] = useDismissed(`joined/${tripId}`);
  const bring = view.missingIn('bring');
  const buy = view.missingIn('buy');
  if (dismissed !== false || bring + buy === 0) return null;
  const close = () => {
    dismiss();
    onDone();
  };
  return (
    <Card gap={space[3]}>
      <View style={styles.header} accessibilityLiveRegion="polite">
        <Icon name="userPlus" size={20} color={colors.primaryStrong} />
        <View style={styles.texts}>
          <Text style={styles.title}>{he.joined.title}</Text>
          <Text style={styles.text}>{he.joined.text(bring + buy)}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <PillButton
          label={he.joined.pick}
          {...testId('joined-pick')}
          onPress={() => {
            close();
            onPick(bring >= buy ? 'bring' : 'buy');
          }}
          style={styles.grow}
        />
        <PillButton
          label={he.joined.later}
          variant="quiet"
          {...testId('joined-later')}
          onPress={close}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  texts: { flex: 1, gap: space[1] },
  title: { ...type.itemTitle, color: colors.ink },
  text: { ...type.caption, color: colors.inkMuted },
  actions: { flexDirection: 'row', gap: space[2] },
  grow: { flexGrow: 1 },
});
