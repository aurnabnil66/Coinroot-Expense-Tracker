import { useSyncExternalStore } from 'react';

import { ledgerStore, type LedgerSnapshot } from '@/lib/db';

/**
 * All accounts, categories and transactions, re-rendering on every change.
 * Check `status` first: the lists are empty until it is "ready".
 * Backed by SQLite (`ledgerStore` in `src/lib/db`): one shared snapshot, reloaded after every write.
 */
export function useLedger(): LedgerSnapshot {
  return useSyncExternalStore(ledgerStore.subscribe, ledgerStore.getSnapshot, ledgerStore.getSnapshot);
}
