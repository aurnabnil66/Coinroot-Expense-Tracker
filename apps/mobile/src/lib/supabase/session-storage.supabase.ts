import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Where Supabase keeps the signed-in session (access + refresh tokens) on the phone.
 *
 * SecureStore (Keychain / Keystore) only fits about 2 KB per value and a session can be
 * larger, so the session goes into its own AES-256 encrypted MMKV instance and only the
 * random encryption key lives in SecureStore. Separate from `coinroot.settings`, which is
 * plain and holds no secrets.
 *
 * If the secure key can't be read or saved, the session is kept in memory only: signing
 * in still works, it just doesn't survive a restart.
 */
const KEY_NAME = 'coinroot.auth-key';
const STORAGE_ID = 'coinroot.auth';
/** 32 hex characters = the 32 bytes AES-256 needs. */
const KEY_BYTES = 16;

const memory = new Map<string, string>();
let opening: Promise<MMKV | null> | null = null;

async function encryptionKey(): Promise<string> {
  const saved = await SecureStore.getItemAsync(KEY_NAME);
  if (saved) return saved;
  const key = Array.from(getRandomBytes(KEY_BYTES), (byte) => byte.toString(16).padStart(2, '0')).join('');
  // Readable after the first unlock, so a background token refresh can still read it.
  await SecureStore.setItemAsync(KEY_NAME, key, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  return key;
}

function openStorage(): Promise<MMKV | null> {
  opening ??= encryptionKey()
    .then((key) => createMMKV({ id: STORAGE_ID, encryptionKey: key, encryptionType: 'AES-256' }))
    .catch(() => null);
  return opening;
}

/** The `storage` adapter for the Supabase auth client (async get / set / remove of strings). */
export const authSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const storage = await openStorage();
    return (storage ? storage.getString(key) : memory.get(key)) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const storage = await openStorage();
    if (storage) storage.set(key, value);
    else memory.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    const storage = await openStorage();
    if (storage) storage.remove(key);
    else memory.delete(key);
  },
};
