import { describe, expect, it } from '@jest/globals';

import { formatTaka, formatTakaInput, groupDigits, parseTaka, sumPoisha } from './money.util';

describe('parseTaka', () => {
  it.each([
    ['350', 35000],
    ['0', 0],
    ['1250.5', 125050],
    ['1250.50', 125050],
    ['1,23,456.75', 12345675],
    ['৳ 500', 50000],
    ['Tk 500', 50000],
    ['.5', 50],
    ['10.', 1000],
    ['  42 ', 4200],
  ])('parses %p as %p poisha', (input, expected) => {
    expect(parseTaka(input)).toBe(expected);
  });

  it.each(['', '.', 'abc', '12.345', '-50', '1.2.3', '5e3'])('rejects %p', (input) => {
    expect(parseTaka(input)).toBeNull();
  });

  it('never goes through floating point', () => {
    expect(parseTaka('0.29')).toBe(29);
    expect(parseTaka('1.13')).toBe(113);
  });
});

describe('groupDigits', () => {
  it.each([
    ['5', '5'],
    ['999', '999'],
    ['1000', '1,000'],
    ['12345', '12,345'],
    ['123456', '1,23,456'],
    ['12345678', '1,23,45,678'],
  ])('groups %p as %p', (digits, expected) => {
    expect(groupDigits(digits)).toBe(expected);
  });
});

describe('formatTaka', () => {
  it('formats with the taka sign and lakh grouping', () => {
    expect(formatTaka(12345650)).toBe('৳1,23,456.50');
    expect(formatTaka(500000)).toBe('৳5,000');
    expect(formatTaka(0)).toBe('৳0');
    expect(formatTaka(5)).toBe('৳0.05');
  });

  it('handles signs', () => {
    expect(formatTaka(-35000)).toBe('-৳350');
    expect(formatTaka(35000, { signed: true })).toBe('+৳350');
    expect(formatTaka(0, { signed: true })).toBe('৳0');
  });

  it('supports no symbol and fixed decimals', () => {
    expect(formatTaka(123456700, { symbol: false })).toBe('12,34,567');
    expect(formatTaka(35000, { fixedDecimals: true })).toBe('৳350.00');
  });
});

describe('formatTakaInput', () => {
  it('round-trips with parseTaka', () => {
    for (const poisha of [0, 5, 50, 35000, 125050, 12345675]) {
      expect(parseTaka(formatTakaInput(poisha))).toBe(poisha);
    }
  });
});

describe('sumPoisha', () => {
  it('adds amounts', () => {
    expect(sumPoisha([35000, 5000, 15])).toBe(40015);
    expect(sumPoisha([])).toBe(0);
  });
});
