import { StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';

import { colors, radius, space, type } from '@/theme';

/** A tip on `primaryTint`, one per screen: an info icon, a title and one line. */
export function Callout({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.callout}>
      <Icon name="info" size={20} color={colors.primaryStrong} />
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
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
});
