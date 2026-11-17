/**
 * Turns Supabase Auth errors into short, user-facing messages.
 * Pure (reads only `code`, `name`, `status` and `message`), so it is tested without a server.
 */
export const AUTH_MESSAGES = {
  wrongPassword: 'Wrong email or password.',
  notConfirmed: 'Confirm your email first: open the link we sent you, then log in.',
  accountExists: 'An account with this email already exists. Log in instead.',
  weakPassword: 'Choose a stronger password.',
  samePassword: 'Choose a password different from your current one.',
  tooManyEmails: 'Too many emails sent. Wait a few minutes and try again.',
  tooManyTries: 'Too many tries. Wait a few minutes and try again.',
  signUpOff: 'New accounts are turned off right now.',
  badEmail: "This email address can't be used. Check it and try again.",
  sessionEnded: 'Your session ended. Log in again.',
  offline: "Can't reach the server. Check your internet connection and try again.",
  linkExpired: 'This link has expired or was already used. Ask for a new one.',
  notConfigured: "Sign-in isn't set up in this copy of Coinroot.",
} as const;

const BY_CODE: Record<string, string> = {
  invalid_credentials: AUTH_MESSAGES.wrongPassword,
  email_not_confirmed: AUTH_MESSAGES.notConfirmed,
  user_already_exists: AUTH_MESSAGES.accountExists,
  email_exists: AUTH_MESSAGES.accountExists,
  weak_password: AUTH_MESSAGES.weakPassword,
  same_password: AUTH_MESSAGES.samePassword,
  over_email_send_rate_limit: AUTH_MESSAGES.tooManyEmails,
  over_request_rate_limit: AUTH_MESSAGES.tooManyTries,
  signup_disabled: AUTH_MESSAGES.signUpOff,
  email_provider_disabled: AUTH_MESSAGES.signUpOff,
  email_address_invalid: AUTH_MESSAGES.badEmail,
  email_address_not_authorized: AUTH_MESSAGES.badEmail,
  session_not_found: AUTH_MESSAGES.sessionEnded,
  session_expired: AUTH_MESSAGES.sessionEnded,
  refresh_token_not_found: AUTH_MESSAGES.sessionEnded,
  refresh_token_already_used: AUTH_MESSAGES.sessionEnded,
  otp_expired: AUTH_MESSAGES.linkExpired,
};

type ErrorLike = { code?: unknown; name?: unknown; status?: unknown };

/** The message for a Supabase Auth error (or a thrown network error), else `fallback`. */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const { code, name, status } = error as ErrorLike;
  if (typeof code === 'string' && BY_CODE[code]) return BY_CODE[code];
  // supabase-js reports a failed request (no internet, server down) as AuthRetryableFetchError.
  if (name === 'AuthRetryableFetchError' || (name === 'TypeError' && status === undefined)) return AUTH_MESSAGES.offline;
  if (status === 429) return AUTH_MESSAGES.tooManyTries;
  return fallback;
}
