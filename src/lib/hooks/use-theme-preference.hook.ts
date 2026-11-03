import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-preference';
const listeners = new Set<() => void>();

function readStored(): ThemePreference {
  try {
    const value = Storage.getItemSync(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    // Storage unavailable (e.g. web without SQLite support): fall back to the device setting.
    return 'system';
  }
}

let current = readStored();

/** Saves the app theme and re-renders everything using `useThemePreference`. */
export function setThemePreference(next: ThemePreference) {
  current = next;
  try {
    Storage.setItemSync(STORAGE_KEY, next);
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

/** Light, dark, or 'system' (follow the device). Persists across restarts. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
