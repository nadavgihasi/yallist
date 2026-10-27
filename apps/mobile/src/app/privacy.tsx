import { Link, useLocalSearchParams } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { policy } from '@/features/privacy/policy';
import { testId } from '@/lib/testId';
import { colors, layout, space, type } from '@/theme';

/**
 * The privacy policy, open to anyone signed in or not (it's outside the (app) group), for the
 * Google Play listing. Hebrew; English at /privacy?lang=en.
 */
export default function Privacy() {
  const { lang } = useLocalSearchParams<{ lang?: string }>();
  const en = lang === 'en';
  const p = policy[en ? 'en' : 'he'];
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: 32 + insets.top, paddingBottom: 32 + insets.bottom },
      ]}
    >
      {/* English reads left to right (web: the `dir` that start and end resolve from). */}
      <View style={styles.page} {...(en && Platform.OS === 'web' && { dir: 'ltr' })}>
        <Link
          href={en ? '/privacy' : { pathname: '/privacy', params: { lang: 'en' } }}
          replace
          style={[styles.other, en && styles.ltr]}
          {...testId('privacy-lang')}
        >
          {p.other}
        </Link>
        <Text
          style={[styles.title, en && styles.ltr]}
          accessibilityRole="header"
          {...testId('privacy-title')}
        >
          {p.title}
        </Text>
        <Text style={[styles.caption, en && styles.ltr]}>{p.updated}</Text>
        <Text style={[styles.body, en && styles.ltr]}>{p.intro}</Text>
        {p.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.heading, en && styles.ltr]} accessibilityRole="header">
              {section.title}
            </Text>
            {section.lines.map((line) => (
              <Text key={line} style={[styles.body, en && styles.ltr]}>
                {line}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
    paddingHorizontal: space.screen,
  },
  page: { gap: space[3] },
  section: { gap: space[2], marginTop: space[3] },
  other: { ...type.buttonSm, color: colors.primaryStrong, alignSelf: 'flex-end' },
  title: { ...type.pageTitle, color: colors.ink },
  heading: { ...type.itemTitle, fontSize: 18, color: colors.ink },
  body: { ...type.body, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
});
