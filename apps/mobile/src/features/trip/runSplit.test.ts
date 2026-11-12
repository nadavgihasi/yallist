import { describe, expect, it } from 'vitest';

import { he } from '@/i18n/he';

import { newPart, runSplit, sharedText } from './runSplit';

const everyone = ['a', 'b', 'c', 'd', 'e'];
const names: Record<string, string> = { a: 'דנה', b: 'רון', c: 'יעל', d: 'עומר', e: 'נועה' };
const nameOf = (id: string) => names[id] ?? id;
const sum = (owed: Map<string, number>) => [...owed.values()].reduce((s, v) => s + v, 0);

describe('runSplit', () => {
  it('splits equally between who shares it, without parts', () => {
    const split = runSplit(30000, ['a', 'b', 'c'], []);
    expect(split.error).toBeUndefined();
    expect(split.parts).toEqual([]);
    expect(Object.fromEntries(split.owed)).toEqual({ a: 10000, b: 10000, c: 10000 });
  });

  it('splits a part between its people and the rest between everyone', () => {
    // ₪300 run: ₪120 of alcohol for four of the five.
    const alcohol = { label: ' אלכוהול ', amount: '120', shares: ['a', 'b', 'c', 'd'] };
    const split = runSplit(30000, everyone, [alcohol]);
    expect(split.parts).toEqual([
      { label: 'אלכוהול', amountAgorot: 12000, shares: ['a', 'b', 'c', 'd'] },
    ]);
    expect(split.rest).toBe(18000);
    expect(Object.fromEntries(split.owed)).toEqual({
      a: 6600,
      b: 6600,
      c: 6600,
      d: 6600,
      e: 3600,
    });
  });

  it('adds up to the total with several parts and odd amounts', () => {
    const split = runSplit(
      10001,
      ['a', 'b', 'c'],
      [
        { label: '', amount: '33.33', shares: ['a', 'b'] },
        { label: 'בשר', amount: '20,01', shares: ['b', 'c', 'e'] },
      ],
    );
    expect(split.error).toBeUndefined();
    expect(split.parts[0]!.label).toBe(he.shop.finish.partDefault(1));
    expect(sum(split.owed)).toBe(10001);
  });

  it('starts a new part with everyone in it', () => {
    expect(newPart(everyone)).toEqual({ label: '', amount: '', shares: everyone });
  });

  it('says what is missing', () => {
    const part = (amount: string, shares = ['a']) => ({ label: 'x', amount, shares });
    expect(runSplit(undefined, everyone, []).error).toBe(he.item.enterAmount);
    expect(runSplit(1000, everyone, [part('')]).error).toBe(he.invalidAmount);
    expect(runSplit(1000, everyone, [part('abc')]).error).toBe(he.invalidAmount);
    expect(runSplit(1000, everyone, [part('10')]).error).toBe(he.shop.finish.partsOver);
    expect(runSplit(1000, everyone, [part('6'), part('5')]).error).toBe(he.shop.finish.partsOver);
    expect(runSplit(1000, everyone, [part('5', [])]).error).toBe(he.item.pickSomeone);
    expect(runSplit(1000, [], [part('5')]).error).toBe(he.item.pickSomeone);
    expect(runSplit(1000, [], []).owed.size).toBe(0);
  });
});

describe('sharedText', () => {
  it('says nothing when everyone shares it', () => {
    expect(sharedText({ shares: everyone }, everyone, nameOf)).toBeUndefined();
  });

  it('names who shares it otherwise, former members too', () => {
    expect(sharedText({ shares: ['a', 'b'] }, everyone, nameOf)).toBe('בין דנה ורון');
    expect(sharedText({ shares: ['a', 'x'] }, ['a'], nameOf)).toBeUndefined();
    expect(sharedText({ shares: ['a'] }, ['a', 'b'], nameOf)).toBe('בין דנה');
  });

  it('lists the parts and who shares each', () => {
    const parts = [{ label: 'אלכוהול', amountAgorot: 12000, shares: ['a', 'b'] }];
    expect(sharedText({ shares: everyone, parts }, everyone, nameOf)).toBe(
      'אלכוהול ₪120.00: דנה ורון · השאר: כולם',
    );
    expect(sharedText({ shares: ['c'], parts }, everyone, nameOf)).toBe(
      'אלכוהול ₪120.00: דנה ורון · השאר: יעל',
    );
  });
});
