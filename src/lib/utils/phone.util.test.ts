import { describe, expect, it } from '@jest/globals';

import { formatBdPhone, normalizeBdPhone } from './phone.util';

describe('normalizeBdPhone', () => {
  it('accepts local numbers with or without spaces and dashes', () => {
    expect(normalizeBdPhone('01712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('01712-345678')).toBe('+8801712345678');
    expect(normalizeBdPhone(' 017 1234 5678 ')).toBe('+8801712345678');
  });
  it('accepts the country code', () => {
    expect(normalizeBdPhone('+8801912345678')).toBe('+8801912345678');
    expect(normalizeBdPhone('8801312345678')).toBe('+8801312345678');
  });
  it('rejects other numbers', () => {
    expect(normalizeBdPhone('0171234567')).toBeNull(); // too short
    expect(normalizeBdPhone('01212345678')).toBeNull(); // no 012 operator
    expect(normalizeBdPhone('02912345678')).toBeNull(); // landline
    expect(normalizeBdPhone('phone')).toBeNull();
  });
});

describe('formatBdPhone', () => {
  it('shows the local form', () => {
    expect(formatBdPhone('+8801712345678')).toBe('01712-345678');
    expect(formatBdPhone('anything')).toBe('anything');
  });
});
