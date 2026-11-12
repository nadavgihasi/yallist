import { describe, expect, it } from 'vitest';

import { allowsFraction, buyAmountText, canonicalUnit, parseBuyAmount } from './amount';

describe('buyAmountText', () => {
  it('joins the amount and the unit', () => {
    expect(buyAmountText({ amount: '2', unit: 'ק״ג' })).toBe('2 ק״ג');
    expect(buyAmountText({ amount: '6', unit: 'יח׳' })).toBe('6 יח׳');
    expect(buyAmountText({ amount: ' 40 ' })).toBe('40');
    expect(buyAmountText({ amount: '007', unit: 'גרם' })).toBe('7 גרם');
  });

  it('says packages in the plural after a number other than 1', () => {
    expect(buyAmountText({ amount: '1', unit: 'חבילה' })).toBe('1 חבילה');
    expect(buyAmountText({ amount: '3', unit: 'חבילה' })).toBe('3 חבילות');
  });

  it('is null without an amount or a unit, and invalid with a unit alone', () => {
    expect(buyAmountText({ amount: '' })).toBeNull();
    expect(buyAmountText({ amount: '  ' })).toBeNull();
    expect(buyAmountText({ amount: '  ', unit: 'גרם' })).toBeUndefined();
  });

  it('takes a fraction of kilos and liters only, with a comma or a point', () => {
    expect(buyAmountText({ amount: '1.5', unit: 'ק״ג' })).toBe('1.5 ק״ג');
    expect(buyAmountText({ amount: '1,25', unit: 'ליטר' })).toBe('1.25 ליטר');
    expect(buyAmountText({ amount: '1.50', unit: 'ליטר' })).toBe('1.5 ליטר');
    expect(buyAmountText({ amount: '0.5', unit: 'ק״ג' })).toBe('0.5 ק״ג');
    expect(buyAmountText({ amount: '1.5', unit: 'חבילה' })).toBeUndefined();
    expect(buyAmountText({ amount: '1.5' })).toBeUndefined();
    expect(buyAmountText({ amount: '2.0', unit: 'יח׳' })).toBe('2 יח׳');
    expect(allowsFraction('ק״ג')).toBe(true);
    expect(allowsFraction('גרם')).toBe(false);
    expect(allowsFraction(undefined)).toBe(false);
  });

  it('refuses what is not a positive amount up to 9999', () => {
    for (const amount of ['0', '0.0', '-1', 'abc', '1.234', '12345', '10000', '1e3', '.5', '2-3']) {
      expect(buyAmountText({ amount, unit: 'ק״ג' }), amount).toBeUndefined();
    }
    expect(buyAmountText({ amount: '9999.99', unit: 'ליטר' })).toBe('9999.99 ליטר');
  });

  it('keeps within the API limit of 20 characters', () => {
    expect(buyAmountText({ amount: '9999', unit: 'שקיות גדולות מאוד ממש' })).toBeUndefined();
  });
});

describe('canonicalUnit', () => {
  it('spells a unit the way its chip does', () => {
    for (const unit of ['ק"ג', 'ק״ג', 'ק”ג', 'קג', 'קילו', 'קילוגרם', 'kg', 'KG']) {
      expect(canonicalUnit(unit), unit).toBe('ק״ג');
    }
    for (const unit of ['גרם', "גר'", 'גר', 'ג׳', 'g', 'gr']) {
      expect(canonicalUnit(unit), unit).toBe('גרם');
    }
    for (const unit of ['ליטר', 'ליטרים', "ל'", 'l'])
      expect(canonicalUnit(unit), unit).toBe('ליטר');
    expect(canonicalUnit("יח'")).toBe('יח׳');
    expect(canonicalUnit('יחידות')).toBe('יח׳');
    expect(canonicalUnit('חבילות')).toBe('חבילה');
    expect(canonicalUnit('מ"ל')).toBe('מ״ל');
  });

  it('keeps any other unit, with Hebrew quote marks', () => {
    expect(canonicalUnit(' שישיות ')).toBe('שישיות');
    expect(canonicalUnit('ס"מ')).toBe('ס״מ');
  });
});

describe('parseBuyAmount', () => {
  it('splits a stored amount back into number and unit', () => {
    expect(parseBuyAmount('2 ק״ג')).toEqual({ amount: '2', unit: 'ק״ג' });
    expect(parseBuyAmount('1.5 ליטר')).toEqual({ amount: '1.5', unit: 'ליטר' });
    expect(parseBuyAmount('1,5 ליטר')).toEqual({ amount: '1,5', unit: 'ליטר' });
    expect(parseBuyAmount('2kg')).toEqual({ amount: '2', unit: 'ק״ג' });
    expect(parseBuyAmount(' 40 ')).toEqual({ amount: '40' });
    expect(parseBuyAmount(undefined)).toEqual({ amount: '' });
  });

  it('keeps a unit that is not one of the chips, such as a template’s', () => {
    expect(parseBuyAmount('6 שישיות')).toEqual({ amount: '6', unit: 'שישיות' });
    expect(parseBuyAmount('2 חבילות')).toEqual({ amount: '2', unit: 'חבילה' });
  });

  it('spells other ways of writing a unit the way the chips do', () => {
    expect(parseBuyAmount('3 ק"ג')).toEqual({ amount: '3', unit: 'ק״ג' });
    expect(parseBuyAmount('3 קילו')).toEqual({ amount: '3', unit: 'ק״ג' });
    expect(parseBuyAmount("4 יח'")).toEqual({ amount: '4', unit: 'יח׳' });
    expect(parseBuyAmount("500 גר'")).toEqual({ amount: '500', unit: 'גרם' });
  });

  it('round-trips', () => {
    for (const text of ['2 ק״ג', '1.5 ליטר', '40', '3 חבילות', '1 חבילה', '500 גרם', '6 יח׳']) {
      expect(buyAmountText(parseBuyAmount(text))).toBe(text);
    }
  });

  it('returns text that is not a number and a unit whole, as it was written', () => {
    for (const text of ['הרבה', '2-3 ק״ג', '2 או 3', 'ק״ג']) {
      expect(parseBuyAmount(text), text).toEqual({ amount: text });
      expect(buyAmountText(parseBuyAmount(text)), text).toBeUndefined();
    }
  });
});
