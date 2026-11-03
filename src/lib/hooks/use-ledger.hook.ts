import { useSyncExternalStore } from 'react';

import { ledgerStore, type LedgerSnapshot } from '@/lib/mocks';

/**
 * All accounts, categories and transactions, re-rendering on every change.
 * Check `status` first: the lists are empty until it is "ready".
 * Backed by the in-memory sample store for now; becomes Drizzle live queries later.
 */
export function useLedger(): LedgerSnapshot {
  return useSyncExternalStore(ledgerStore.subscribe, ledgerStore.getSnapshot, ledgerStore.getSnapshot);
}
