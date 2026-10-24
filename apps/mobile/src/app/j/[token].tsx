import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { colors, fonts, space, type } from '@/theme';

/** Invite links land here; joining by link isn't built yet (local-only MVP). */
export default function Join() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        {he.join.title}
      </Text>
      <Text style={styles.text}>{he.join.soon}</Text>
      <PillButton label={he.join.toTrips} size="lg" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.screen, paddingTop: 64, gap: 12, alignItems: 'flex-start' },
  title: { ...type.screenTitle, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.inkSecondary },
});
