import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'yallist/dismissed/';

/**
 * Whether something with this key was dismissed on this device ("לא עכשיו"), and the way to
 * dismiss it. Undefined until known, so it doesn't flash up before hiding.
 */
export function useDismissed(key: string): [boolean | undefined, () => void] {
  const [known, setKnown] = useState<{ key: string; dismissed: boolean }>();
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(PREFIX + key)
      .then((value) => live && setKnown({ key, dismissed: value !== null }))
      .catch(() => live && setKnown({ key, dismissed: false }));
    return () => {
      live = false;
    };
  }, [key]);
  const dismiss = useCallback(() => {
    setKnown({ key, dismissed: true });
    AsyncStorage.setItem(PREFIX + key, '1').catch(() => {});
  }, [key]);
  return [known?.key === key ? known.dismissed : undefined, dismiss];
}
