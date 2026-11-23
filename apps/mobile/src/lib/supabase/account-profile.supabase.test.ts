import { describe, expect, it } from '@jest/globals';

import { EMPTY_PROFILE, photoOnLogIn, profileFromAccount, readAccountPhoto, readAccountProfile } from './account-profile.supabase';

const GUEST = { nickname: 'Guest', photo: 'file:///photo.jpg', email: 'own@example.com', phone: '+8801711111111' };

describe('readAccountProfile', () => {
  it('reads nickname and phone', () => {
    expect(readAccountProfile({ nickname: ' Rafi ', phone: '+8801822222222', other: 1 })).toEqual({
      nickname: 'Rafi',
      phone: '+8801822222222',
    });
  });

  it('ignores missing or malformed values', () => {
    expect(readAccountProfile(undefined)).toEqual({ nickname: '', phone: null });
    expect(readAccountProfile({ nickname: 5, phone: '' })).toEqual({ nickname: '', phone: null });
    expect(readAccountProfile('text')).toEqual({ nickname: '', phone: null });
  });
});

describe('profileFromAccount', () => {
  it("replaces the phone's profile with the account's", () => {
    expect(profileFromAccount(GUEST, { nickname: 'Rafi', phone: '+8801822222222' }, 'account@example.com')).toEqual({
      nickname: 'Rafi',
      photo: null,
      email: 'account@example.com',
      phone: '+8801822222222',
    });
  });

  it("leaves blank what the account doesn't have", () => {
    expect(profileFromAccount(GUEST, { nickname: '', phone: null }, 'account@example.com')).toEqual({
      ...EMPTY_PROFILE,
      email: 'account@example.com',
    });
  });

  it("keeps the photo when the phone's profile already belonged to this account", () => {
    const own = { ...GUEST, email: 'Account@Example.com' };
    expect(profileFromAccount(own, { nickname: 'Rafi', phone: null }, 'account@example.com')).toMatchObject({
      photo: 'file:///photo.jpg',
      nickname: 'Rafi',
      phone: null,
    });
  });
});

describe('the account photo', () => {
  it('reads photo_version from the metadata', () => {
    expect(readAccountPhoto({ nickname: 'Rafi', photo_version: '2026-11-19T10:00:00.000Z' })).toBe('2026-11-19T10:00:00.000Z');
    expect(readAccountPhoto({ photo_version: null })).toBeNull();
    expect(readAccountPhoto({ photo_version: '  ' })).toBeNull();
    expect(readAccountPhoto(undefined)).toBeNull();
  });

  it("downloads the account's photo, uploads the phone's when the account has none, else does nothing", () => {
    expect(photoOnLogIn('v1', 'file:///kept.jpg', false)).toBe('download');
    expect(photoOnLogIn('v1', null, false)).toBe('download');
    expect(photoOnLogIn(null, 'file:///kept.jpg', false)).toBe('upload');
    expect(photoOnLogIn(null, null, false)).toBe('none');
  });

  it("sends a change the account never received instead of downloading the account's older photo", () => {
    // A newer photo whose upload failed.
    expect(photoOnLogIn('v1', 'file:///newer.jpg', true)).toBe('upload');
    // A removal that failed.
    expect(photoOnLogIn('v1', null, true)).toBe('remove');
    expect(photoOnLogIn(null, 'file:///kept.jpg', true)).toBe('upload');
    expect(photoOnLogIn(null, null, true)).toBe('none');
  });
});
