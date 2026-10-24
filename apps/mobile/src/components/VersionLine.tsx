import Constants from 'expo-constants';
import { StyleSheet, Text } from 'react-native';

import { he } from '@/i18n/he';
import { colors, type } from '@/theme';

// Set by CI at build time (deploy.yml / android.yml); unset in local dev.
const sha = process.env.EXPO_PUBLIC_GIT_SHA?.slice(0, 7) || 'dev';
const stage = process.env.EXPO_PUBLIC_STAGE;

/** `גרסה 0.1.0 · a1b2c3d`, plus the stage outside production. */
const label = [
  he.version(Constants.expoConfig?.version ?? '?'),
  sha,
  stage !== 'production' && stage,
]
  .filter(Boolean)
  .join(' · ');

export function VersionLine() {
  return <Text style={styles.text}>{label}</Text>;
}

const styles = StyleSheet.create({
  text: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
});
