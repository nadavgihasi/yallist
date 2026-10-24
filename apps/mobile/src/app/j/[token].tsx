import { StyleSheet, Text, View } from 'react-native';

import { he } from '@/i18n/he';
import { colors, space, type } from '@/theme';

export default function Join() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{he.join.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.screen, paddingTop: 64 },
  title: { ...type.screenTitle, color: colors.ink },
});
