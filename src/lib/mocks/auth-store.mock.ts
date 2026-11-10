/**
 * Stand-in for Supabase Auth until sync is built. Same shape the real client will have:
 * async `signUp` / `signIn` / `signOut` that throw `AuthError` with a user-facing message,
 * and a session that survives restarts (MMKV; Supabase keeps its own session storage).
 *
 * Accounts created this session are remembered in memory only (passwords are never
 * saved anywhere), so a wrong password for one of them fails like the real thing.
 * Any other email and password work, since there is no server to check them yet.
 */
import { createSetting } from '@/lib/storage';

export type AuthSession = {
  userId: string;
  email: string;
};

export class AuthError extends Error {}

const DELAY_MS = 900;
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, DELAY_MS));

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

/** Accounts created while the app is open: email → password (memory only). */
const createdThisSession = new Map<string, { userId: string; password: string }>();

const newUserId = () => `user-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const authStore = {
  subscribe: sessionSetting.subscribe,
  getSession: sessionSetting.get,
  fallback: sessionSetting.fallback,

  async signUp({ email, password }: { email: string; password: string }): Promise<AuthSession> {
    await delay();
    if (createdThisSession.has(email)) throw new AuthError('An account with this email already exists. Log in instead.');
    const userId = newUserId();
    createdThisSession.set(email, { userId, password });
    const session = { userId, email };
    sessionSetting.set(session);
    return session;
  },

  async signIn({ email, password }: { email: string; password: string }): Promise<AuthSession> {
    await delay();
    const known = createdThisSession.get(email);
    if (known && known.password !== password) throw new AuthError('Wrong email or password.');
    const session = { userId: known?.userId ?? newUserId(), email };
    sessionSetting.set(session);
    return session;
  },

  async signOut(): Promise<void> {
    await delay();
    sessionSetting.set(null);
  },
};
