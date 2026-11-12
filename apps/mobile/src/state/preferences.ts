import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { createPreferences, type Preferences } from '@/lib/preferences';

const store = createPreferences(AsyncStorage);

/** My display preferences, and how to change them. Loaded from this device on first use. */
export function usePreferences(): [Preferences, (changes: Partial<Preferences>) => void] {
  const preferences = useSyncExternalStore(store.subscribe, store.get, store.get);
  useEffect(() => {
    void store.load();
  }, []);
  return [preferences, (changes) => void store.set(changes)];
}

/** Whether items show their picture. */
export const useShowItemIcons = () => usePreferences()[0].showItemIcons;
