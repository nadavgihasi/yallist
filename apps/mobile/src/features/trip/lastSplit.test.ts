import { describe, expect, it } from 'vitest';

import { lastSplit } from './lastSplit';

const expense = (createdBy: string, createdAt: string, shares: string[]) => ({
  createdBy,
  createdAt,
  shares,
});

describe('lastSplit', () => {
  const active = ['me', 'dana', 'ron', 'noa'];

  it('is who shared the last expense I added', () => {
    const expenses = [
      expense('me', '2026-11-17T10:00:00Z', ['me', 'dana', 'ron', 'noa']),
      expense('me', '2026-11-18T10:00:00Z', ['me', 'noa']),
      expense('dana', '2026-11-18T12:00:00Z', ['dana', 'ron']),
    ];
    expect(lastSplit(expenses, 'me', active)).toEqual(['me', 'noa']);
  });

  it('leaves out who has left, and is nothing without an expense of mine', () => {
    const expenses = [expense('me', '2026-11-18T10:00:00Z', ['me', 'gone'])];
    expect(lastSplit(expenses, 'me', active)).toEqual(['me']);
    expect(lastSplit(expenses, 'dana', active)).toBeUndefined();
    expect(
      lastSplit([expense('me', '2026-11-18T10:00:00Z', ['gone'])], 'me', active),
    ).toBeUndefined();
  });
});
