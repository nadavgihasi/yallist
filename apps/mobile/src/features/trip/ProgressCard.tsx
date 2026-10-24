import { StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ListGroup';
import { Progress } from '@/components/Progress';
import { he, missingItems } from '@/i18n/he';
import { colors, space, type } from '@/theme';

/** "14 מתוך 20 כבר מכוסים", a brand progress bar, and what's still open (trip.html). */
export function ProgressCard({ done, total }: { done: number; total: number }) {
  if (total === 0) {
    return (
      <Card>
        <Text style={styles.title}>{he.home.noItems}</Text>
      </Card>
    );
  }
  const missing = total - done;
  return (
    <Card gap={space[2]}>
      <Text style={styles.title}>{he.trip.coveredOf(done, total)}</Text>
      <Progress done={done} total={total} />
      <Text style={styles.caption}>
        {missing === 0 ? he.trip.allCovered : missingItems(missing)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...type.itemTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
});
