import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/lib/useReducedMotion';
import { colors, space } from '@/theme';

export type ViewNode = ComponentRef<typeof View>;

/** The trip screen's side: where each row is, and which one flashes now. */
interface Reveals {
  register: (key: string, node: ViewNode | null) => void;
  flashing?: string;
}

const RevealContext = createContext<Reveals | null>(null);

export const RevealProvider = RevealContext.Provider;

/** How long the flash holds before it fades. */
const HOLD_MS = 1400;

/**
 * A row the trip screen can scroll to (`./reveal.ts`): just added, it flashes a tint behind
 * itself and fades back. The tint bleeds a little past the row, without moving it.
 */
export function RevealTarget({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(RevealContext);
  const register = ctx?.register;
  const ref = useCallback((node: ViewNode | null) => register?.(id, node), [register, id]);
  const on = ctx?.flashing === id;
  const reduced = useReducedMotion();
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!on) return;
    fade.setValue(1);
    const out = Animated.timing(fade, {
      toValue: 0,
      delay: HOLD_MS,
      duration: reduced ? 0 : 600,
      useNativeDriver: Platform.OS !== 'web',
    });
    out.start();
    // Another row's turn (or done): never leave this one tinted.
    return () => {
      out.stop();
      fade.setValue(0);
    };
  }, [on, fade, reduced]);

  return (
    <View ref={ref} style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: fade }]} />
      {children}
    </View>
  );
}

const BLEED = space[2];

const styles = StyleSheet.create({
  wrap: { margin: -BLEED, padding: BLEED },
  flash: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
  },
});
