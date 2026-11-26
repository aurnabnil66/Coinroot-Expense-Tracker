import { describe, expect, it } from '@jest/globals';

import { isCheckDue, isNewerVersion, parseVersion, versionFromTag } from './version.util';

const DAY = 24 * 60 * 60 * 1000;

describe('parseVersion', () => {
  it('reads versions with or without a v', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('v10.0.12')).toEqual([10, 0, 12]);
    expect(parseVersion(' v2.1 ')).toEqual([2, 1, 0]);
  });

  it('rejects anything else', () => {
    expect(parseVersion('')).toBeNull();
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion('1.2.3-beta')).toBeNull();
    expect(parseVersion('1')).toBeNull();
  });
});

describe('versionFromTag', () => {
  it('turns a release tag into a version', () => {
    expect(versionFromTag('v1.4.0')).toBe('1.4.0');
    expect(versionFromTag('v1.4')).toBe('1.4.0');
    expect(versionFromTag('nightly')).toBeNull();
  });
});

describe('isNewerVersion', () => {
  it('compares each part as a number', () => {
    expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(true);
    expect(isNewerVersion('2.0.0', '1.12.3')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true);
  });

  it('is false for the same or an older version', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('v1.0.0', '1.0')).toBe(false);
    expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false);
  });

  it('never calls an unreadable version newer', () => {
    expect(isNewerVersion('next', '1.0.0')).toBe(false);
    expect(isNewerVersion('2.0.0', '')).toBe(false);
  });
});

describe('isCheckDue', () => {
  const now = new Date('2026-11-26T10:00:00Z');

  it('is due without an earlier check', () => {
    expect(isCheckDue(null, DAY, now)).toBe(true);
    expect(isCheckDue('not a date', DAY, now)).toBe(true);
  });

  it('waits for the interval', () => {
    expect(isCheckDue('2026-11-26T08:00:00Z', DAY, now)).toBe(false);
    expect(isCheckDue('2026-11-25T10:00:01Z', DAY, now)).toBe(false);
    expect(isCheckDue('2026-11-25T10:00:00Z', DAY, now)).toBe(true);
  });

  it('is due when the last check looks like it was in the future', () => {
    expect(isCheckDue('2026-11-27T10:00:00Z', DAY, now)).toBe(true);
  });
});
