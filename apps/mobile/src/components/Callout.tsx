import { StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { PillButton } from './PillButton';

import { colors, radius, space, type } from '@/theme';

/**
 * A tip on `primaryTint`, one per screen: an info icon, a title and one line, and optionally a
 * button that acts on it.
 */
export function Callout({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.callout}>
      <Icon name="info" size={20} color={colors.primaryStrong} />
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        {action && (
          <PillButton
            label={action.label}
            size="sm"
            style={styles.action}
            onPress={action.onPress}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.primaryTint,
  },
  texts: { flex: 1, gap: space[1] },
  title: { ...type.buttonSm, color: colors.primaryStrong },
  text: { ...type.caption, color: colors.primaryStrong },
  action: { alignSelf: 'flex-start', marginTop: space[2] },
});
