import { describe, expect, it } from '@jest/globals';

import { greetingFor, initialsOf } from './greeting.util';

const at = (hour: number, minute = 0) => new Date(2026, 10, 9, hour, minute);

describe('greetingFor', () => {
  it('says good morning from 5:00 to 11:59', () => {
    expect(greetingFor(at(5))).toBe('Good Morning');
    expect(greetingFor(at(11, 59))).toBe('Good Morning');
  });
  it('says good afternoon from 12:00 to 16:59', () => {
    expect(greetingFor(at(12))).toBe('Good Afternoon');
    expect(greetingFor(at(16, 59))).toBe('Good Afternoon');
  });
  it('says good evening from 17:00, through the night', () => {
    expect(greetingFor(at(17))).toBe('Good Evening');
    expect(greetingFor(at(23, 30))).toBe('Good Evening');
    expect(greetingFor(at(0))).toBe('Good Evening');
    expect(greetingFor(at(4, 59))).toBe('Good Evening');
  });
});

describe('initialsOf', () => {
  it('makes up to two initials', () => {
    expect(initialsOf('Rahim Uddin')).toBe('RU');
    expect(initialsOf('rahim')).toBe('R');
    expect(initialsOf('A B C')).toBe('AC');
    expect(initialsOf('   ')).toBe('');
  });
});
