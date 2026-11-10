import { useSyncExternalStore } from 'react';

import { createBooleanSetting } from '@/lib/storage';

const simpleModeSetting = createBooleanSetting('simple-mode', false);

/** Turns Simple mode on or off and re-renders everything using `useSimpleMode`. */
export function setSimpleMode(next: boolean) {
  simpleModeSetting.set(next);
}

/** Simple mode: quick-add buttons for usual entries and fewer fields. Persists across restarts. */
export function useSimpleMode(): boolean {
  return useSyncExternalStore(simpleModeSetting.subscribe, simpleModeSetting.get, () => simpleModeSetting.fallback);
}
