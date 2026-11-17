import { describe, expect, it } from '@jest/globals';

import { AUTH_MESSAGES, authErrorMessage } from './auth-messages.supabase';

const FALLBACK = 'Could not log in. Please try again.';

describe('authErrorMessage', () => {
  it('maps known error codes', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', status: 400 }, FALLBACK)).toBe(AUTH_MESSAGES.wrongPassword);
    expect(authErrorMessage({ code: 'email_not_confirmed' }, FALLBACK)).toBe(AUTH_MESSAGES.notConfirmed);
    expect(authErrorMessage({ code: 'user_already_exists' }, FALLBACK)).toBe(AUTH_MESSAGES.accountExists);
    expect(authErrorMessage({ code: 'over_email_send_rate_limit', status: 429 }, FALLBACK)).toBe(AUTH_MESSAGES.tooManyEmails);
  });

  it('treats failed requests as offline', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', status: 0 }, FALLBACK)).toBe(AUTH_MESSAGES.offline);
    expect(authErrorMessage(new TypeError('Network request failed'), FALLBACK)).toBe(AUTH_MESSAGES.offline);
  });

  it('treats an unknown 429 as too many tries', () => {
    expect(authErrorMessage({ code: 'something_new', status: 429 }, FALLBACK)).toBe(AUTH_MESSAGES.tooManyTries);
  });

  it('falls back for anything else', () => {
    expect(authErrorMessage({ code: 'unexpected_failure', status: 500 }, FALLBACK)).toBe(FALLBACK);
    expect(authErrorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK);
    expect(authErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(authErrorMessage('text', FALLBACK)).toBe(FALLBACK);
  });
});
