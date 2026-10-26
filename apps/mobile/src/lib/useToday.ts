import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { today } from './dates';

/**
 * Today's date (ISO), refreshed when the screen regains focus and when the app comes back to the
 * foreground, so a countdown never says "מחר" on the day itself.
 */
export function useToday(): string {
  const [now, setNow] = useState(today);
  useFocusEffect(useCallback(() => setNow(today()), []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(today());
    });
    return () => sub.remove();
  }, []);
  return now;
}
