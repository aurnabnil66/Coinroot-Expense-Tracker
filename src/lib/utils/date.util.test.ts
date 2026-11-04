import { describe, expect, it } from '@jest/globals';

import { calendarWeeks, daysInMonth, weekdayLabels } from './date.util';

describe('daysInMonth', () => {
  it('handles month lengths and leap years', () => {
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
  });
});

describe('calendarWeeks', () => {
  it('pads the first and last week with nulls (November 2026 starts on a Sunday)', () => {
    const weeks = calendarWeeks('2026-11');
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toBe('2026-11-01');
    expect(weeks[4]).toEqual(['2026-11-29', '2026-11-30', null, null, null, null, null]);
  });

  it('can start the week on another day', () => {
    const weeks = calendarWeeks('2026-11', 6); // Saturday first
    expect(weeks[0].slice(0, 2)).toEqual([null, '2026-11-01']);
  });
});

describe('weekdayLabels', () => {
  it('lists weekdays from the chosen start day', () => {
    expect(weekdayLabels()[0]).toBe('Sun');
    expect(weekdayLabels(6).slice(0, 2)).toEqual(['Sat', 'Sun']);
  });
});
