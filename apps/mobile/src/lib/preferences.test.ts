import { describe, expect, it, vi } from 'vitest';

import { createPreferences, type PreferenceStorage } from './preferences';

const memory = (initial?: string): PreferenceStorage & { saved: () => string | null } => {
  let value = initial ?? null;
  return {
    getItem: () => Promise.resolve(value),
    setItem: (_key, next) => {
      value = next;
      return Promise.resolve();
    },
    saved: () => value,
  };
};

describe('preferences', () => {
  it('shows item icons until told otherwise', () => {
    expect(createPreferences(memory()).get().showItemIcons).toBe(true);
  });

  it('applies a change at once, tells listeners and saves it', async () => {
    const storage = memory();
    const prefs = createPreferences(storage);
    const listener = vi.fn();
    prefs.subscribe(listener);
    const saved = prefs.set({ showItemIcons: false });
    expect(prefs.get().showItemIcons).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    await saved;
    expect(JSON.parse(storage.saved()!)).toEqual({ showItemIcons: false });
  });

  it('loads what was saved on the device', async () => {
    const prefs = createPreferences(memory('{"showItemIcons":false}'));
    await prefs.load();
    expect(prefs.get().showItemIcons).toBe(false);
  });

  it('keeps the defaults for nothing saved, a damaged value or a failed read', async () => {
    for (const raw of [undefined, 'not json', '5', '{"showItemIcons":"no"}']) {
      const prefs = createPreferences(memory(raw));
      await prefs.load();
      expect(prefs.get().showItemIcons).toBe(true);
    }
    const failing = createPreferences({
      getItem: () => Promise.reject(new Error('blocked')),
      setItem: () => Promise.reject(new Error('blocked')),
    });
    await failing.load();
    expect(failing.get().showItemIcons).toBe(true);
    await expect(failing.set({ showItemIcons: false })).resolves.toBeUndefined();
    expect(failing.get().showItemIcons).toBe(false);
  });

  it("doesn't undo a change made while the saved ones were loading", async () => {
    const prefs = createPreferences(memory('{"showItemIcons":true}'));
    const loaded = prefs.load();
    void prefs.set({ showItemIcons: false });
    await loaded;
    expect(prefs.get().showItemIcons).toBe(false);
  });
});
