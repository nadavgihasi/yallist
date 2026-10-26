import { describe, expect, it } from 'vitest';

import { centerSquare } from './photo';

describe('centerSquare', () => {
  it('takes the middle of a landscape photo', () => {
    expect(centerSquare(4000, 3000)).toEqual({
      originX: 500,
      originY: 0,
      width: 3000,
      height: 3000,
    });
  });

  it('takes the middle of a portrait photo', () => {
    expect(centerSquare(301, 600)).toEqual({ originX: 0, originY: 149, width: 301, height: 301 });
  });

  it('keeps a square one whole', () => {
    expect(centerSquare(512, 512)).toEqual({ originX: 0, originY: 0, width: 512, height: 512 });
  });
});
