/** Display preferences, kept on this device: how the app looks, not what an account holds. */
export interface Preferences {
  /** The picture beside each item (catalog icons). */
  showItemIcons: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { showItemIcons: true };

/** The part of AsyncStorage the store uses. */
export interface PreferenceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const KEY = 'yallist/preferences';

/**
 * A store of preferences: readable at once (the defaults until the saved ones are loaded), changed
 * with `set`, which saves them, and listened to with `subscribe`.
 */
export function createPreferences(storage: PreferenceStorage) {
  let current: Preferences = DEFAULT_PREFERENCES;
  let loading: Promise<void> | undefined;
  let changed = false;
  const listeners = new Set<() => void>();
  const publish = (next: Preferences) => {
    current = next;
    listeners.forEach((listener) => listener());
  };

  return {
    get: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** Reads the saved preferences once; a failed or damaged read leaves the defaults. */
    load(): Promise<void> {
      loading ??= storage
        .getItem(KEY)
        .then((raw) => {
          // A change made while this was reading is the newer one.
          if (!raw || changed) return;
          const saved: unknown = JSON.parse(raw);
          if (typeof saved !== 'object' || saved === null) return;
          const known = saved as Partial<Preferences>;
          publish({
            showItemIcons:
              typeof known.showItemIcons === 'boolean'
                ? known.showItemIcons
                : DEFAULT_PREFERENCES.showItemIcons,
          });
        })
        .catch(() => {});
      return loading;
    },
    /** Applies at once, then saves; a failed save keeps the change until the app closes. */
    set(changes: Partial<Preferences>) {
      changed = true;
      publish({ ...current, ...changes });
      return storage.setItem(KEY, JSON.stringify(current)).catch(() => {});
    },
  };
}
