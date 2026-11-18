import { describe, expect, it } from '@jest/globals';

import { EMPTY_PROFILE, profileFromAccount, readAccountProfile } from './account-profile.supabase';

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
