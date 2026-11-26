import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { type UpdateSnapshot, updateStore } from '@/lib/updates';

/** Whether a newer APK is out (banner, Settings → App updates), and the check's status. */
export function useAppUpdate(): UpdateSnapshot {
  return useSyncExternalStore(updateStore.subscribe, updateStore.getSnapshot, updateStore.getSnapshot);
}

/** Runs the daily update check now (if due) and whenever the app comes back to the foreground. */
export function useDailyUpdateCheck() {
  useEffect(() => {
    updateStore.checkIfDue();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') updateStore.checkIfDue();
    });
    return () => subscription.remove();
  }, []);
}
