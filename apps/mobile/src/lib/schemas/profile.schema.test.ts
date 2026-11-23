import { describe, expect, it } from '@jest/globals';

import { logInFormSchema, signUpFormSchema } from './auth.schema';
import { profileFormSchema } from './profile.schema';

const profile = (overrides: Record<string, unknown> = {}) =>
  profileFormSchema.safeParse({ nickname: 'Rahim', photo: null, email: '', phone: '', ...overrides });

const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe('profile form', () => {
  it('accepts a one-word nickname and empty optional fields', () => {
    const result = profile({ nickname: '  Rahim ' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ nickname: 'Rahim', photo: null, email: '', phone: null });
  });

  it('accepts nicknames in other scripts', () => {
    expect(profile({ nickname: 'রহিম' }).success).toBe(true);
  });

  it('rejects nicknames that are empty, two words, too short, too long or start with a number', () => {
    expect(firstError(profile({ nickname: ' ' }))).toBe('Enter a nickname');
    expect(firstError(profile({ nickname: 'Rahim Uddin' }))).toBe('Use one word, without spaces');
    expect(firstError(profile({ nickname: 'R' }))).toBe('Use at least 2 letters');
    expect(firstError(profile({ nickname: 'A'.repeat(16) }))).toBe('Keep it to 15 letters or fewer');
    expect(firstError(profile({ nickname: '7up' }))).toBe('Start with a letter and use only letters or numbers');
    expect(firstError(profile({ nickname: 'ra@him' }))).toBe('Start with a letter and use only letters or numbers');
  });

  it('checks the optional email and phone only when filled in', () => {
    expect(profile({ email: 'Name@Example.com ' }).data?.email).toBe('name@example.com');
    expect(profile({ email: 'not-an-email' }).success).toBe(false);
    expect(profile({ phone: '01712-345678' }).data?.phone).toBe('+8801712345678');
    expect(firstError(profile({ phone: '12345' }))).toBe('Enter an 11-digit mobile number, like 01XXXXXXXXX');
  });
});

describe('sign up and log in', () => {
  const signUp = (overrides: Record<string, unknown> = {}) =>
    signUpFormSchema.safeParse({ nickname: 'Rahim', photo: null, email: 'a@example.com', password: 'secret12', phone: '', ...overrides });

  it('needs an email and a password with a letter and a number', () => {
    expect(signUp().success).toBe(true);
    expect(firstError(signUp({ email: '' }))).toBe('Enter your email');
    expect(firstError(signUp({ password: 'short1' }))).toBe('Use at least 8 characters');
    expect(firstError(signUp({ password: 'onlyletters' }))).toBe('Use at least one letter and one number');
    expect(firstError(signUp({ password: '12345678' }))).toBe('Use at least one letter and one number');
  });

  it('log in only checks that the fields are filled in', () => {
    expect(logInFormSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true);
    expect(firstError(logInFormSchema.safeParse({ email: 'a@example.com', password: '' }))).toBe('Enter your password');
  });
});
