import { describe, expect, it } from 'vitest';

import { pastTripState } from './pastTrip';

const transfer = { from: 'a', to: 'b', amountAgorot: 100 };

describe('pastTripState', () => {
  it('shows the check only once everything was arranged and settled', () => {
    expect(pastTripState({ itemCount: 24, doneCount: 24, transfers: [] })).toBe('done');
    expect(pastTripState({ itemCount: 0, doneCount: 0, transfers: [] })).toBe('done');
  });

  it('shows how much got arranged when not everything did', () => {
    expect(pastTripState({ itemCount: 24, doneCount: 0, transfers: [] })).toBe('partial');
    expect(pastTripState({ itemCount: 24, doneCount: 23, transfers: [] })).toBe('partial');
  });

  it('shows open transfers first', () => {
    expect(pastTripState({ itemCount: 24, doneCount: 0, transfers: [transfer] })).toBe('transfers');
  });
});
