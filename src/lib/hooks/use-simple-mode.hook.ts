import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'simple-mode';
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return Storage.getItemSync(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

let current = readStored();

/** Turns Simple mode on or off and re-renders everything using `useSimpleMode`. */
export function setSimpleMode(next: boolean) {
  current = next;
  try {
    Storage.setItemSync(STORAGE_KEY, next ? 'on' : 'off');
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

/** Simple mode: quick-add buttons for usual entries and fewer fields. Persists across restarts. */
export function useSimpleMode(): boolean {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
