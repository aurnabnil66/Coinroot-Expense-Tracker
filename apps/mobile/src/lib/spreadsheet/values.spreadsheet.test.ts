import { describe, expect, it } from '@jest/globals';

import { guessDateOrder, parseAmountCell, parseDateCell, parseTypeCell, toAsciiDigits } from './values.spreadsheet';

describe('parseAmountCell', () => {
  it.each([
    ['1,20,000', 12_000_000, false],
    ['৳ 500', 50_000, false],
    ['Tk. 50.5', 5_050, false],
    ['BDT 1,250.75', 125_075, false],
    ['-75', 7_500, true],
    ['75-', 7_500, true],
    ['(200)', 20_000, true],
    ['+300', 30_000, false],
    ['১,২৫০', 125_000, false],
  ])('%s', (cell, poisha, negative) => {
    expect(parseAmountCell(cell)).toEqual({ poisha, negative });
  });

  it('blank cells are empty, words and 3 decimals are not amounts', () => {
    expect(parseAmountCell('  ')).toBe('empty');
    expect(parseAmountCell('-')).toBe('empty');
    expect(parseAmountCell('abc')).toBeNull();
    expect(parseAmountCell('1.234')).toBeNull();
  });
});

describe('parseDateCell', () => {
  it.each([
    ['2026-03-05', 'dmy', '2026-03-05'],
    ['2026/3/5', 'mdy', '2026-03-05'],
    ['05/03/2026', 'dmy', '2026-03-05'],
    ['03/05/2026', 'mdy', '2026-03-05'],
    ['5-3-26', 'dmy', '2026-03-05'],
    ['05.03.2026', 'dmy', '2026-03-05'],
    ['5 Mar 2026', 'mdy', '2026-03-05'],
    ['March 5, 2026', 'dmy', '2026-03-05'],
    ['05-Mar-26', 'dmy', '2026-03-05'],
    ['2026-03-05 10:30', 'dmy', '2026-03-05'],
    ['2026-03-05T10:30:00Z', 'dmy', '2026-03-05'],
    ['5/3/2026 9:15 AM', 'dmy', '2026-03-05'],
    ['46086', 'dmy', '2026-03-05'],
    ['০৫/০৩/২০২৬', 'dmy', '2026-03-05'],
    ['26/03/05', 'ymd', '2026-03-05'],
    ['26-3-5', 'ymd', '2026-03-05'],
  ] as const)('%s (%s)', (cell, order, expected) => {
    expect(parseDateCell(cell, order)).toBe(expected);
  });

  it('rejects impossible and unknown dates', () => {
    expect(parseDateCell('31/02/2026', 'dmy')).toBeNull();
    expect(parseDateCell('13/13/2026', 'dmy')).toBeNull();
    expect(parseDateCell('yesterday', 'dmy')).toBeNull();
    expect(parseDateCell('5 Smarch 2026', 'dmy')).toBeNull();
    expect(parseDateCell('', 'dmy')).toBeNull();
  });
});

describe('guessDateOrder', () => {
  it('a first number over 12 means day first', () => {
    expect(guessDateOrder(['05/03/2026', '25/03/2026'])).toEqual({ order: 'dmy', ambiguous: false });
  });
  it('a second number over 12 means month first', () => {
    expect(guessDateOrder(['03/05/2026', '03/25/2026'])).toEqual({ order: 'mdy', ambiguous: false });
  });
  it('no clue: day first, marked ambiguous', () => {
    expect(guessDateOrder(['05/03/2026', '01/02/2026'])).toEqual({ order: 'dmy', ambiguous: true });
  });
  it('year first and month names are never ambiguous', () => {
    expect(guessDateOrder(['2026-03-05'])).toEqual({ order: 'ymd', ambiguous: false });
    expect(guessDateOrder(['5 Mar 2026'])).toEqual({ order: 'dmy', ambiguous: false });
  });
});

describe('parseTypeCell', () => {
  it('reads common words', () => {
    expect(parseTypeCell('Expense')).toBe('expense');
    expect(parseTypeCell('DR')).toBe('expense');
    expect(parseTypeCell(' credit ')).toBe('income');
    expect(parseTypeCell('Transfer')).toBe('transfer');
    expect(parseTypeCell('খরচ')).toBe('expense');
    expect(parseTypeCell('Lunch')).toBeNull();
  });
});

it('toAsciiDigits', () => {
  expect(toAsciiDigits('৳১২৩.৪৫')).toBe('৳123.45');
});
