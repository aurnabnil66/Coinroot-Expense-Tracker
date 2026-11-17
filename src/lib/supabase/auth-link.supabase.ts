import { AUTH_MESSAGES } from './auth-messages.supabase';

/**
 * Reads an email link that opened the app (`coinroot://auth-callback…`).
 *
 * Supabase puts the result in the URL fragment (`#access_token=…&refresh_token=…&type=signup`),
 * or an error in the query or fragment (`?error=access_denied&error_code=otp_expired&error_description=…`).
 * Pure and tested.
 */
export type AuthLink =
  | { kind: 'session'; accessToken: string; refreshToken: string; purpose: 'confirm' | 'recovery' }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parsePairs(text: string, into: Record<string, string>) {
  for (const pair of text.split('&')) {
    if (!pair) continue;
    const at = pair.indexOf('=');
    const key = decode(at < 0 ? pair : pair.slice(0, at));
    if (key) into[key] = at < 0 ? '' : decode(pair.slice(at + 1));
  }
}

/** Query and fragment values of a URL; fragment values win (that's where Supabase puts tokens). */
export function authLinkParams(url: string | null | undefined): Record<string, string> {
  const params: Record<string, string> = {};
  if (!url) return params;
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt < 0 ? url : url.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  if (queryAt >= 0) parsePairs(beforeHash.slice(queryAt + 1), params);
  if (hashAt >= 0) parsePairs(url.slice(hashAt + 1), params);
  return params;
}

export function readAuthLink(params: Record<string, string | undefined>): AuthLink {
  const { error, error_code: errorCode, error_description: description } = params;
  if (error || errorCode || description) {
    if (errorCode === 'otp_expired') return { kind: 'error', message: AUTH_MESSAGES.linkExpired };
    return { kind: 'error', message: description || "This link didn't work. Ask for a new one." };
  }
  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (accessToken && refreshToken) {
    return { kind: 'session', accessToken, refreshToken, purpose: params.type === 'recovery' ? 'recovery' : 'confirm' };
  }
  return { kind: 'none' };
}
