import { describe, expect, it } from '@jest/globals';

import { authLinkParams, readAuthLink } from './auth-link.supabase';
import { AUTH_MESSAGES } from './auth-messages.supabase';

describe('authLinkParams', () => {
  it('reads tokens from the fragment', () => {
    expect(authLinkParams('coinroot://auth-callback#access_token=a.b.c&refresh_token=r1&type=signup&expires_in=3600')).toEqual({
      access_token: 'a.b.c',
      refresh_token: 'r1',
      type: 'signup',
      expires_in: '3600',
    });
  });

  it('reads the query and decodes values', () => {
    expect(authLinkParams('coinroot://auth-callback?error=access_denied&error_description=Email+link+is+invalid%21')).toEqual({
      error: 'access_denied',
      error_description: 'Email link is invalid!',
    });
  });

  it('lets the fragment win over the query', () => {
    expect(authLinkParams('coinroot://x?type=a#type=recovery')).toEqual({ type: 'recovery' });
  });

  it('handles empty and missing URLs', () => {
    expect(authLinkParams(null)).toEqual({});
    expect(authLinkParams('coinroot://auth-callback')).toEqual({});
    expect(authLinkParams('coinroot://auth-callback?#')).toEqual({});
  });

  it('keeps a badly encoded value as it is', () => {
    expect(authLinkParams('coinroot://x#note=100%')).toEqual({ note: '100%' });
  });
});

describe('readAuthLink', () => {
  it('reads a one-time code and its flow id', () => {
    expect(readAuthLink(authLinkParams('coinroot://auth-callback?code=8c5f2a&sb_flow_id=flow_123'))).toEqual({
      kind: 'code',
      code: '8c5f2a',
      flowId: 'flow_123',
    });
    expect(readAuthLink({ code: 'abc' })).toEqual({ kind: 'code', code: 'abc', flowId: null });
  });

  it('never accepts tokens from a link (someone else could send them)', () => {
    const crafted = 'coinroot://auth-callback#access_token=a.b.c&refresh_token=r1&type=signup';
    expect(readAuthLink(authLinkParams(crafted))).toEqual({ kind: 'none' });
    expect(readAuthLink({ access_token: 'a', refresh_token: 'r', type: 'recovery' })).toEqual({ kind: 'none' });
  });

  it('explains an expired link', () => {
    expect(readAuthLink({ error: 'access_denied', error_code: 'otp_expired', error_description: 'Email link is invalid or has expired' })).toEqual({
      kind: 'error',
      message: AUTH_MESSAGES.linkExpired,
    });
  });

  it("shows other errors' description, even when a code is there too", () => {
    expect(readAuthLink({ error: 'server_error', error_description: 'Something broke' })).toEqual({ kind: 'error', message: 'Something broke' });
    expect(readAuthLink({ error: 'server_error', code: 'abc' })).toMatchObject({ kind: 'error' });
  });

  it('needs a code', () => {
    expect(readAuthLink({ code: '  ' })).toEqual({ kind: 'none' });
    expect(readAuthLink({})).toEqual({ kind: 'none' });
  });
});
