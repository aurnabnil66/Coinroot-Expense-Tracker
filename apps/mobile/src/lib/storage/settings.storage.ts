import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Small device-only settings (theme, Simple mode, …), stored in MMKV.
 * These are never synced: ledger data lives in SQLite.
 */
const STORAGE_ID = 'coinroot.settings';

let instance: MMKV | null | undefined;

/** Opens the MMKV instance on first use. Returns `null` where storage is unavailable (e.g. web server render). */
function getStorage(): MMKV | null {
  if (instance === undefined) {
    try {
      instance = createMMKV({ id: STORAGE_ID });
    } catch {
      instance = null;
    }
  }
  return instance;
}

export type Setting<T> = {
  /** Current value (cached in memory, so it is cheap and stable for `useSyncExternalStore`). */
  get: () => T;
  /** Saves the value and notifies subscribers. Keeps the in-memory value if saving fails. */
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
  /** Value used before storage is read (and on the server). */
  fallback: T;
};

type SettingOptions<T> = {
  key: string;
  fallback: T;
  /** Reads the stored value. Return `undefined` for missing or invalid data to use the fallback. */
  read: (storage: MMKV, key: string) => T | undefined;
  write: (storage: MMKV, key: string, value: T) => void;
};

/** Defines one persisted setting with an in-memory cache and change listeners. */
export function createSetting<T>({ key, fallback, read, write }: SettingOptions<T>): Setting<T> {
  const listeners = new Set<() => void>();
  let loaded = false;
  let current = fallback;

  function get(): T {
    if (!loaded) {
      loaded = true;
      try {
        const storage = getStorage();
        current = (storage && read(storage, key)) ?? fallback;
      } catch {
        current = fallback;
      }
    }
    return current;
  }

  function set(next: T) {
    loaded = true;
    current = next;
    try {
      const storage = getStorage();
      if (storage) write(storage, key, next);
    } catch {
      // Keep the in-memory choice for this session.
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { get, set, subscribe, fallback };
}

/** Stored as a string; anything not in `allowed` falls back. */
export function createEnumSetting<T extends string>(key: string, allowed: readonly T[], fallback: T): Setting<T> {
  return createSetting<T>({
    key,
    fallback,
    read: (storage, k) => {
      const value = storage.getString(k);
      return allowed.includes(value as T) ? (value as T) : undefined;
    },
    write: (storage, k, value) => storage.set(k, value),
  });
}

export function createBooleanSetting(key: string, fallback: boolean): Setting<boolean> {
  return createSetting<boolean>({
    key,
    fallback,
    read: (storage, k) => storage.getBoolean(k),
    write: (storage, k, value) => storage.set(k, value),
  });
}
