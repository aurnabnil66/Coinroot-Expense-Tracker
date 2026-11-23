import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema.database';

export const DATABASE_NAME = 'coinroot.db';

/**
 * The app's one SQLite connection. `enableChangeListener` lets Drizzle's `useLiveQuery`
 * re-render screens when rows change; WAL keeps reads fast while a write is in progress.
 */
const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
sqlite.execSync('PRAGMA journal_mode = WAL;');

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
