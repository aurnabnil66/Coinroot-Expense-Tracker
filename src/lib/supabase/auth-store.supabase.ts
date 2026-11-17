import type { Session, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { createSetting } from '@/lib/storage';

import { AUTH_MESSAGES, authErrorMessage } from './auth-messages.supabase';
import type { AuthLink } from './auth-link.supabase';
import { getSupabase } from './client.supabase';

/**
 * Sign-in with Supabase Auth (email + password). Signing in is optional: the app works
 * fully without it, and SQLite stays the source of truth.
 *
 * Supabase keeps the real session (tokens) in its own encrypted storage. The account's id
 * and email are mirrored into a plain MMKV setting so `useAuth()` can read them
 * synchronously on the first render; `onAuthStateChange` keeps the mirror up to date
 * (sign-in, sign-out, a refresh token that stopped working).
 */
export type AuthSession = {
  userId: string;
  email: string;
};

/** A failure with a message that can be shown to the user as is. */
export class AuthError extends Error {}

const sessionSetting = createSetting<AuthSession | null>({
  key: 'auth-session',
  fallback: null,
  read: (storage, key) => {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    try {
      const value = JSON.parse(raw) as Partial<AuthSession>;
      return typeof value.userId === 'string' && typeof value.email === 'string'
        ? { userId: value.userId, email: value.email }
        : undefined;
    } catch {
      return undefined;
    }
  },
  write: (storage, key, value) => {
    if (value) storage.set(key, JSON.stringify(value));
    else storage.remove(key);
  },
});

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email ?? '' };
}

function remember(next: AuthSession | null) {
  const current = sessionSetting.get();
  if (current?.userId === next?.userId && current?.email === next?.email) return;
  sessionSetting.set(next);
}

let listening = false;

/** Starts following Supabase's session (once). Without Supabase settings there is no session. */
function listen() {
  if (listening) return;
  listening = true;
  const supabase = getSupabase();
  if (!supabase) {
    remember(null);
    return;
  }
  // Runs right away with the stored session (INITIAL_SESSION), then on every change.
  // Don't call other Supabase methods inside this callback: it runs under the auth lock.
  supabase.auth.onAuthStateChange((_event, session) => remember(toAuthSession(session)));
}

function client(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) throw new AuthError(AUTH_MESSAGES.notConfigured);
  listen();
  return supabase;
}

/** Runs one Supabase call; every failure (returned or thrown) becomes an `AuthError`. */
async function run<R extends { data: unknown; error: unknown }>(fallback: string, call: () => Promise<R>): Promise<R['data']> {
  let result: R;
  try {
    result = await call();
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError(authErrorMessage(e, fallback));
  }
  if (result.error) throw new AuthError(authErrorMessage(result.error, fallback));
  return result.data;
}

/** Where email links send the user back to: `coinroot://auth-callback` (the `auth-callback` route). */
const authRedirectUrl = () => Linking.createURL('auth-callback');

export const authStore = {
  subscribe(listener: () => void) {
    listen();
    return sessionSetting.subscribe(listener);
  },
  getSession: sessionSetting.get,
  fallback: sessionSetting.fallback,

  /**
   * Creates the account. When the project asks for email confirmation there is no session
   * yet (`session: null`): the user opens the emailed link, then is signed in.
   */
  async signUp({ email, password }: { email: string; password: string }): Promise<{ session: AuthSession | null }> {
    const data = await run('Could not create your account. Please try again.', () =>
      client().auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl() } })
    );
    // With confirmation on, an email that is already registered comes back as a user with no identities.
    if (data.user && data.user.identities?.length === 0) throw new AuthError(AUTH_MESSAGES.accountExists);
    const session = toAuthSession(data.session);
    if (session) remember(session);
    return { session };
  },

  async signIn({ email, password }: { email: string; password: string }): Promise<AuthSession> {
    const data = await run('Could not log in. Please try again.', () =>
      client().auth.signInWithPassword({ email, password })
    );
    const session = toAuthSession(data.session);
    if (!session) throw new AuthError('Could not log in. Please try again.');
    remember(session);
    return session;
  },

  /** Signs out on this phone only (other devices stay signed in). Local data stays. */
  async signOut(): Promise<void> {
    await run('Could not log out. Please try again.', async () => {
      const { error } = await client().auth.signOut({ scope: 'local' });
      return { data: null, error };
    });
    remember(null);
  },

  /** Emails a link that opens the app's "New password" step. */
  async sendPasswordReset(email: string): Promise<void> {
    await run('Could not send the email. Please try again.', () =>
      client().auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() })
    );
  },

  /** Signs in from an email link (confirm sign-up or reset password). */
  async openLink(link: Extract<AuthLink, { kind: 'session' }>): Promise<AuthSession> {
    const data = await run("This link didn't work. Ask for a new one.", () =>
      client().auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
    );
    const session = toAuthSession(data.session);
    if (!session) throw new AuthError("This link didn't work. Ask for a new one.");
    remember(session);
    return session;
  },

  /** Sets a new password for the signed-in account (after a reset link). */
  async updatePassword(password: string): Promise<void> {
    await run('Could not save the new password. Please try again.', () => client().auth.updateUser({ password }));
  },
};
