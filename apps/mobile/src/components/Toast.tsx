import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';

import { colors, fonts, shadow } from '@/theme';

type Tone = 'neutral' | 'success' | 'error';
/** A button on the toast, such as undo; pressing it closes the toast. */
interface ToastAction {
  label: string;
  onPress: () => void;
}
interface Message {
  text: string;
  tone: Tone;
  action?: ToastAction;
}

let show: ((message: Message) => void) | undefined;

/**
 * A short message at the top of the screen: `success` adds an orange check, `error` (a change
 * the server rejected, a failed sign-in) an alert icon and interrupts screen readers. `action`
 * adds a button, such as undo, and leaves the toast up longer.
 */
export function showToast(text: string, tone: Tone = 'neutral', action?: ToastAction) {
  show?.({ text, tone, action });
}

/** Renders `showToast` messages; mount once, at the root. */
export function Toast() {
  const insets = useSafeAreaInsets();
  // A new object each time, so the same message twice restarts the timer.
  const [message, setMessage] = useState<Message>();

  useEffect(() => {
    show = setMessage;
    return () => {
      show = undefined;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(undefined), message.action ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  const error = message.tone === 'error';
  return (
    <View style={[styles.wrap, { top: 12 + insets.top }]} pointerEvents="box-none">
      <View
        style={styles.toast}
        role={error ? 'alert' : 'status'}
        accessibilityLiveRegion={error ? 'assertive' : 'polite'}
      >
        {message.tone === 'success' && <Icon name="check" size={18} color={colors.brand} />}
        {error && <Icon name="alert" size={18} color={colors.onPrimary} />}
        <Text style={styles.text}>{message.text}</Text>
        {message.action && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              message.action?.onPress();
              setMessage(undefined);
            }}
            hitSlop={8}
            style={styles.action}
          >
            <Text style={styles.actionText}>{message.action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16, end: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.ink,
    ...shadow.float,
  },
  text: {
    flexShrink: 1,
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'center',
  },
  action: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  actionText: { color: colors.primaryTint, fontFamily: fonts.bold, fontSize: 15 },
});
