import { StyleSheet, Text, View } from 'react-native';

import { he } from '@/i18n/he';
import { colors, space, type } from '@/theme';

export default function Login() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{he.login.title}</Text>
      <Text style={styles.subtitle}>{he.login.subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.screen, paddingTop: 64, gap: 8 },
  title: { ...type.screenTitle, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkSecondary },
});
