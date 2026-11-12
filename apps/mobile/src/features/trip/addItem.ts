import type { Action } from '@/state/reducer';

/** The longest item name the API takes (`text(80)` in apps/api/src/routes/items.ts). */
export const ITEM_NAME_MAX = 80;

/** The counter shows once a name is this close to the limit. */
export const COUNTER_FROM = ITEM_NAME_MAX - 20;

type Act = (
  action: Action,
  options: { onSuccess: () => void; onError: (error: unknown) => void },
) => void;

/**
 * Sends a change and settles once the API answered it: the add sheet stays open until then, so a
 * failed save keeps what was typed.
 */
export const saved = (act: Act, action: Action): Promise<void> =>
  new Promise((resolve, reject) => act(action, { onSuccess: () => resolve(), onError: reject }));
