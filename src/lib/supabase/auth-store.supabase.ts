import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { createSetting, photoPendingSetting, profileSetting, saveProfile } from '@/lib/storage';

import {
  type AccountProfile,
  EMPTY_PROFILE,
  photoOnLogIn,
  profileFromAccount,
  readAccountPhoto,
  readAccountProfile,
} from './account-profile.supabase';
import { AUTH_MESSAGES, authErrorMessage } from './auth-messages.supabase';
import type { AuthLink } from './auth-link.supabase';
import { type CoinrootSupabase, getSupabase } from './client.supabase';
import { downloadAccountPhoto, removeAccountPhoto, uploadAccountPhoto } from './profile-photo.supabase';

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
async function applyAccountProfile(supabase: CoinrootSupabase, session: Session) {
  const metadata = session.user.user_metadata;
  const email = session.user.email ?? '';
  let profile = profileFromAccount(profileSetting.get(), readAccountProfile(metadata), email);
  const pending = photoPendingSetting.get() === accountKey(email);
  const photo = photoOnLogIn(readAccountPhoto(metadata), profile.photo, pending);
  if (photo === 'download') {
    try {
      profile = { ...profile, photo: await downloadAccountPhoto(supabase, session.user.id) };
    } catch {
      // Offline or missing: keep what the phone has; the next log-in tries again.
    }
  }
  try {
    profile = await saveProfile(profile);
  } catch {
    // Keep the profile already on the phone.
  }
  if (photo === 'upload' || photo === 'remove') {
    // A change the account never received, or a photo picked at sign-up before the email was confirmed.
    if (!pending) markPhotoPending(email);
    void sendPendingPhoto(supabase, session.user.id, email).catch(() => undefined);
  }
}

const accountKey = (email: string) => email.trim().toLowerCase();

/** Bumped by every photo change, so an upload that finishes after a newer change doesn't clear its flag. */
let photoChanges = 0;
/** Photo uploads run one at a time, so an older one can't land after a newer one. */
let photoQueue: Promise<void> = Promise.resolve();

/** Notes that this account's photo on the phone (or its removal) has to reach the cloud. */
function markPhotoPending(email: string) {
  photoChanges += 1;
  photoPendingSetting.set(accountKey(email));
}

/**
 * Sends the phone's current photo (or removes the account's, when the phone has none) if a change
 * for this account is waiting, then clears the flag unless a newer change came in meanwhile.
 * Throws on failure; the change stays waiting for the next profile save or log-in.
 */
function sendPendingPhoto(supabase: CoinrootSupabase, userId: string, email: string): Promise<void> {
  const send = photoQueue.then(async () => {
    if (photoPendingSetting.get() !== accountKey(email)) return;
    const changes = photoChanges;
    await savePhotoOnAccount(supabase, userId, profileSetting.get().photo);
    if (changes === photoChanges) photoPendingSetting.set(null);
  });
  photoQueue = send.catch(() => undefined);
  return send;
}

/** Waits for `promise`, but at most `ms`. */
const within = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);

/** How long log-out waits for a photo that hasn't reached the account yet. */
const SIGN_OUT_PHOTO_MS = 10_000;

/** Uploads (or, for `null`, removes) the account's photo and records it in `user_metadata.photo_version`. */
async function savePhotoOnAccount(supabase: CoinrootSupabase, userId: string, uri: string | null) {
  const version = uri ? await uploadAccountPhoto(supabase, userId, uri) : null;
  if (!uri) await removeAccountPhoto(supabase, userId);
  const { error } = await supabase.auth.updateUser({ data: { photo_version: version } });
  if (error) throw error;
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

  /** Logs in; the account's nickname, email, phone and photo become the profile on this phone. */
  async signIn({ email, password }: { email: string; password: string }): Promise<AuthSession> {
    const supabase = client();
    const data = await run('Could not log in. Please try again.', () => supabase.auth.signInWithPassword({ email, password }));
    const session = toAuthSession(data.session);
    if (!data.session || !session) throw new AuthError('Could not log in. Please try again.');
    await applyAccountProfile(supabase, data.session);
    remember(session);
    return session;
  },

  /**
   * Signs out on this phone only (other devices stay signed in) and clears the profile
   * (nickname, email, phone, photo), which belongs to the account.
   */
  async signOut(): Promise<void> {
    const supabase = getSupabase();
    const current = sessionSetting.get();
    if (supabase && current) {
      // Last chance for a photo that hasn't reached the account: the phone's copy is removed below.
      await within(sendPendingPhoto(supabase, current.userId, current.email).catch(() => undefined), SIGN_OUT_PHOTO_MS);
    }
    await run('Could not log out. Please try again.', async () => {
      const { error } = await client().auth.signOut({ scope: 'local' });
      return { data: null, error };
    });
    remember(null);
    photoPendingSetting.set(null);
    await saveProfile(EMPTY_PROFILE).catch(() => profileSetting.set(EMPTY_PROFILE));
  },

  /** Emails a link that opens the app's "New password" step. */
  async sendPasswordReset(email: string): Promise<void> {
    await run('Could not send the email. Please try again.', () =>
      client().auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() })
    );
  },

  /**
   * Signs in from an email link (confirm sign-up or reset password) by redeeming its one-time
   * code with the secret this phone stored when it asked for the email. Fails for a link this
   * phone didn't ask for. `purpose` says which email it was.
   */
  async openLink(link: Extract<AuthLink, { kind: 'code' }>): Promise<{ session: AuthSession; purpose: 'confirm' | 'recovery' }> {
    const supabase = client();
    const data = await run("This link didn't work. Ask for a new one.", () =>
      supabase.auth.exchangeCodeForSession(link.code, link.flowId ? { flowId: link.flowId } : undefined)
    );
    const session = toAuthSession(data.session);
    if (!data.session || !session) throw new AuthError("This link didn't work. Ask for a new one.");
    await applyAccountProfile(supabase, data.session);
    remember(session);
    // supabase-js returns `redirectType: 'recovery'` for a password-reset link (not in its types).
    const redirectType = (data as { redirectType?: string | null }).redirectType;
    return { session, purpose: redirectType === 'recovery' ? 'recovery' : 'confirm' };
  },

  /**
   * Saves an edited nickname / phone on the account while signed in, and the profile photo
   * on the phone (already saved there) when `photoChanged` or when an earlier change never
   * reached the account. Best effort: offline, the nickname / phone go with the next edit
   * and the photo stays waiting (`photoPendingSetting`) for the next save, log-in or log-out.
   */
  async updateAccountProfile(profile: AccountProfile, { photoChanged = false }: { photoChanged?: boolean } = {}): Promise<void> {
    const supabase = getSupabase();
    const session = sessionSetting.get();
    if (!supabase || !session) return;
    if (photoChanged) markPhotoPending(session.email);
    try {
      await supabase.auth.updateUser({ data: profile });
    } catch {
      // Offline: the next edit sends it.
    }
    await sendPendingPhoto(supabase, session.userId, session.email).catch(() => undefined);
  },

  /** Sets a new password for the signed-in account (after a reset link). */
  async updatePassword(password: string): Promise<void> {
    await run('Could not save the new password. Please try again.', () => client().auth.updateUser({ password }));
  },
};
