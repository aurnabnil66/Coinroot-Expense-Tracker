import { useSyncExternalStore } from 'react';

import { lastBackupSetting } from '@/lib/storage';

/** When a backup file was last shared (ISO time), or `null` if never. */
export function useLastBackupAt(): string | null {
  return useSyncExternalStore(lastBackupSetting.subscribe, lastBackupSetting.get, () => lastBackupSetting.fallback);
}
