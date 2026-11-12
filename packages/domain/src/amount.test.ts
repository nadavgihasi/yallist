import { describe, expect, it } from 'vitest';

import { allowsFraction, buyAmountText, parseBuyAmount } from './amount';

describe('buyAmountText', () => {
  it('joins the amount and the unit', () => {
    expect(buyAmountText({ amount: '2', unit: 'ק״ג' })).toBe('2 ק״ג');
    expect(buyAmountText({ amount: '6', unit: 'יח׳' })).toBe('6 יח׳');
    expect(buyAmountText({ amount: ' 40 ' })).toBe('40');
  });

  it('is null without an amount', () => {
    expect(buyAmountText({ amount: '' })).toBeNull();
    expect(buyAmountText({ amount: '  ', unit: 'גרם' })).toBeNull();
  });

  it('takes a fraction of kilos and liters only, with a comma or a point', () => {
    expect(buyAmountText({ amount: '1.5', unit: 'ק״ג' })).toBe('1.5 ק״ג');
    expect(buyAmountText({ amount: '1,25', unit: 'ליטר' })).toBe('1.25 ליטר');
    expect(buyAmountText({ amount: '1.50', unit: 'ליטר' })).toBe('1.5 ליטר');
    expect(buyAmountText({ amount: '1.5', unit: 'חבילה' })).toBeUndefined();
    expect(buyAmountText({ amount: '1.5' })).toBeUndefined();
    expect(buyAmountText({ amount: '2.0', unit: 'יח׳' })).toBe('2 יח׳');
    expect(allowsFraction('ק״ג')).toBe(true);
    expect(allowsFraction('גרם')).toBe(false);
    expect(allowsFraction(undefined)).toBe(false);
  });

  it('refuses what is not a positive amount', () => {
    for (const amount of ['0', '0.0', '-1', 'abc', '1.234', '12345', '1e3', '.5']) {
      expect(buyAmountText({ amount, unit: 'ק״ג' }), amount).toBeUndefined();
    }
  });

  it('keeps within the API limit of 20 characters', () => {
    expect(buyAmountText({ amount: '9999', unit: 'שקיות גדולות מאוד ממש' })).toBeUndefined();
  });
});

describe('parseBuyAmount', () => {
  it('splits a stored amount back into number and unit', () => {
    expect(parseBuyAmount('2 ק״ג')).toEqual({ amount: '2', unit: 'ק״ג' });
    expect(parseBuyAmount('1.5 ליטר')).toEqual({ amount: '1.5', unit: 'ליטר' });
    expect(parseBuyAmount('40')).toEqual({ amount: '40' });
    expect(parseBuyAmount(undefined)).toEqual({ amount: '' });
  });

  it('keeps a unit that is not one of the chips, such as a template’s', () => {
    expect(parseBuyAmount('6 שישיות')).toEqual({ amount: '6', unit: 'שישיות' });
  });

  it('spells keyboard quotes the way the chips do', () => {
    expect(parseBuyAmount('3 ק"ג')).toEqual({ amount: '3', unit: 'ק״ג' });
    expect(parseBuyAmount("4 יח'")).toEqual({ amount: '4', unit: 'יח׳' });
  });

  it('round-trips', () => {
    for (const text of ['2 ק״ג', '1.5 ליטר', '40', '3 חבילה']) {
      expect(buyAmountText(parseBuyAmount(text))).toBe(text);
    }
  });

  it('returns free text whole, which is then invalid', () => {
    expect(parseBuyAmount('הרבה')).toEqual({ amount: 'הרבה' });
    expect(buyAmountText(parseBuyAmount('הרבה'))).toBeUndefined();
  });
});
