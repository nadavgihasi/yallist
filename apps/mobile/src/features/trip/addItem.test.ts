import { describe, expect, it } from 'vitest';

import type { Action } from '@/state/reducer';

import { saved } from './addItem';

const add: Action = {
  type: 'addItem',
  item: { list: 'bring', name: 'אוהל', kind: 'single', quantityNeeded: 1, categoryId: null },
  claim: 0,
};

describe('saved', () => {
  it('waits for the API before the sheet may close', async () => {
    let answer: (() => void) | undefined;
    let done = false;
    const save = saved((_, { onSuccess }) => (answer = onSuccess), add).then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    answer!();
    await save;
    expect(done).toBe(true);
  });

  it('fails when the API refuses, so the sheet keeps the text', async () => {
    const error = new Error('400');
    await expect(saved((_, { onError }) => onError(error), add)).rejects.toBe(error);
  });
});
