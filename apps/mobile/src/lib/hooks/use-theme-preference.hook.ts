import { useSyncExternalStore } from 'react';

import { createEnumSetting } from '@/lib/storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

const themeSetting = createEnumSetting<ThemePreference>('theme-preference', THEME_PREFERENCES, 'system');

/** Saves the app theme and re-renders everything using `useThemePreference`. */
export function setThemePreference(next: ThemePreference) {
  themeSetting.set(next);
}

/** Light, dark, or 'system' (follow the device). Persists across restarts. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(themeSetting.subscribe, themeSetting.get, () => themeSetting.fallback);
}
