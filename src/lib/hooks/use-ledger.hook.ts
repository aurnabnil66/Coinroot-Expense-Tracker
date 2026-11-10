import { useSyncExternalStore } from 'react';

import { ledgerStore, type LedgerSnapshot } from '@/lib/db';

/**
 * Load status, setup state, all accounts and categories (small lists), and the `version` that
 * changes after every write. Check `status` first: the lists are empty until it is "ready".
 * Transactions are read per screen with `useLedgerQuery` (never all at once).
 */
export function useLedger(): LedgerSnapshot {
  return useSyncExternalStore(ledgerStore.subscribe, ledgerStore.getSnapshot, ledgerStore.getSnapshot);
}
