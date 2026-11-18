import { AUTH_MESSAGES } from './auth-messages.supabase';

/**
 * Reads an email link that opened the app (`coinroot://auth-callback…`).
 *
 * Auth uses the PKCE flow: the link carries a one-time `?code=` (plus `sb_flow_id`), which
 * only signs in together with the secret this phone stored when it asked for the email
 * (sign-up or password reset). Links carrying tokens (`#access_token=…`) are never accepted,
 * so a link from someone else can't sign this phone into their account.
 * Errors come in the query or fragment (`?error=access_denied&error_code=otp_expired&…`).
 * Pure and tested.
 */
export type AuthLink =
  | { kind: 'code'; code: string; flowId: string | null }
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

/** Query and fragment values of a URL (fragment values win). */
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
  // Tokens in a link are ignored on purpose (see above): only a code this phone can redeem counts.
  const code = params.code?.trim();
  if (code) return { kind: 'code', code, flowId: params.sb_flow_id?.trim() || null };
  return { kind: 'none' };
}
