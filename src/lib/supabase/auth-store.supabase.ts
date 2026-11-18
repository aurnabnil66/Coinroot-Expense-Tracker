import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { createSetting, profileSetting, saveProfile } from '@/lib/storage';

import { type AccountProfile, EMPTY_PROFILE, profileFromAccount, readAccountProfile } from './account-profile.supabase';
import { AUTH_MESSAGES, authErrorMessage } from './auth-messages.supabase';
import type { AuthLink } from './auth-link.supabase';
import { type CoinrootSupabase, getSupabase } from './client.supabase';

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

function client(): CoinrootSupabase {
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

/**
 * After logging in, the profile on the phone becomes the account's: nickname, sign-in email
 * and phone, blank where the account has none. Never fails the log-in.
 */
async function applyAccountProfile(session: Session) {
  const account = readAccountProfile(session.user.user_metadata);
  try {
    await saveProfile(profileFromAccount(profileSetting.get(), account, session.user.email ?? ''));
  } catch {
    // Keep the profile already on the phone.
  }
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
  async signUp({ email, password, profile }: { email: string; password: string; profile: AccountProfile }): Promise<{ session: AuthSession | null }> {
    const data = await run('Could not create your account. Please try again.', () =>
      client().auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl(), data: profile } })
    );
    // With confirmation on, an email that is already registered comes back as a user with no identities.
    if (data.user && data.user.identities?.length === 0) throw new AuthError(AUTH_MESSAGES.accountExists);
    const session = toAuthSession(data.session);
    if (session) remember(session);
    return { session };
  },

  /** Logs in; the account's nickname, email and phone become the profile on this phone. */
  async signIn({ email, password }: { email: string; password: string }): Promise<AuthSession> {
    const supabase = client();
    const data = await run('Could not log in. Please try again.', () => supabase.auth.signInWithPassword({ email, password }));
    const session = toAuthSession(data.session);
    if (!data.session || !session) throw new AuthError('Could not log in. Please try again.');
    await applyAccountProfile(data.session);
    remember(session);
    return session;
  },

  /**
   * Signs out on this phone only (other devices stay signed in) and clears the profile
   * (nickname, email, phone, photo), which belongs to the account.
   */
  async signOut(): Promise<void> {
    await run('Could not log out. Please try again.', async () => {
      const { error } = await client().auth.signOut({ scope: 'local' });
      return { data: null, error };
    });
    remember(null);
    await saveProfile(EMPTY_PROFILE).catch(() => profileSetting.set(EMPTY_PROFILE));
  },

  /** Emails a link that opens the app's "New password" step. */
  async sendPasswordReset(email: string): Promise<void> {
    await run('Could not send the email. Please try again.', () =>
      client().auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() })
    );
  },

  /** Signs in from an email link (confirm sign-up or reset password). */
  async openLink(link: Extract<AuthLink, { kind: 'session' }>): Promise<AuthSession> {
    const supabase = client();
    const data = await run("This link didn't work. Ask for a new one.", () =>
      supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
    );
    const session = toAuthSession(data.session);
    if (!data.session || !session) throw new AuthError("This link didn't work. Ask for a new one.");
    await applyAccountProfile(data.session);
    remember(session);
    return session;
  },

  /**
   * Saves an edited nickname / phone on the account while signed in. Best effort: the
   * profile is already saved on the phone, and the next edit or log-in sends it again.
   */
  async updateAccountProfile(profile: AccountProfile): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !sessionSetting.get()) return;
    try {
      await supabase.auth.updateUser({ data: profile });
    } catch {
      // Offline: kept on the phone.
    }
  },

  /** Sets a new password for the signed-in account (after a reset link). */
  async updatePassword(password: string): Promise<void> {
    await run('Could not save the new password. Please try again.', () => client().auth.updateUser({ password }));
  },
};
