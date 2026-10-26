import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The OS "reduce motion" setting (`prefers-reduced-motion` on web), kept current. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
