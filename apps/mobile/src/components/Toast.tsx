import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme';

let show: ((text: string) => void) | undefined;

/** A short message at the top of the screen, e.g. a change the server rejected. */
export function showToast(text: string) {
  show?.(text);
}

/** Renders `showToast` messages; mount once, at the root. */
export function Toast() {
  const insets = useSafeAreaInsets();
  // A new object each time, so the same message twice restarts the timer.
  const [message, setMessage] = useState<{ text: string }>();

  useEffect(() => {
    show = (text) => setMessage({ text });
    return () => {
      show = undefined;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(undefined), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <View style={[styles.wrap, { top: 12 + insets.top }]} pointerEvents="none">
      <Text style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        {message.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16, end: 16, alignItems: 'center' },
  toast: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.ink,
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'center',
    overflow: 'hidden',
  },
});
