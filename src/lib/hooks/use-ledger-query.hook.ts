import { type DependencyList, useMemo } from 'react';

import { db, type LedgerDatabase } from '@/lib/db';

import { useLedger } from './use-ledger.hook';

/**
 * Runs a read query (from `@/lib/db`, e.g. `getRecentDays`) against the database and returns
 * its result, re-running it after any write (the ledger's `version`) or when `deps` change.
 * `deps` must be plain values (strings, numbers, booleans, null). Returns `undefined` until the
 * ledger is ready. Queries are synchronous and return only what the screen shows, so they're
 * cheap enough to run during render.
 *
 * ```ts
 * const page = useLedgerQuery((database) => getRecentDays(database, limit), [limit]);
 * ```
 */
export function useLedgerQuery<T>(query: (database: LedgerDatabase) => T, deps: DependencyList): T | undefined {
  const { status, version } = useLedger();
  // `deps` are plain values (ids, dates, limits), so one string key stands for all of them.
  const key = JSON.stringify(deps);
  // `query` is a new function every render; what it reads is listed in `deps` (as `key`).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (status === 'ready' ? query(db) : undefined), [status, version, key]);
}
