import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState } from 'react';

import { db } from './client.database';
import migrations from './migrations/migrations';

export type DatabaseStatus =
  | { status: 'preparing'; error: null }
  | { status: 'ready'; error: null }
  | { status: 'error'; error: Error };

let preparing: Promise<void> | null = null;

/**
 * Creates or updates the tables (the generated migrations). Runs once per app start however often it's called; await it before touching the
 * database. After a failure the next call tries again.
 */
export function whenDatabaseReady(): Promise<void> {
  preparing ??= (async () => {
    await migrate(db, migrations);
  })().catch((e: unknown) => {
    preparing = null;
    throw e;
  });
  return preparing;
}

/**
 * Waits for `whenDatabaseReady` when mounted. Nothing should read the database until this is
 * `ready`; remount (e.g. with a new `key`) to try again after an error.
 */
export function useDatabaseSetup(): DatabaseStatus {
  const [state, setState] = useState<DatabaseStatus>({ status: 'preparing', error: null });
  useEffect(() => {
    let active = true;
    whenDatabaseReady().then(
      () => active && setState({ status: 'ready', error: null }),
      (e: unknown) => active && setState({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) })
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
