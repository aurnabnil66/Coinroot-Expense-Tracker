import { useSyncExternalStore } from 'react';

import { type SyncSnapshot, syncStore } from '@/lib/supabase';

/** Cloud sync status for Settings: off / idle / syncing / error / blocked, plus the last sync time. */
export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot, syncStore.getSnapshot);
}
