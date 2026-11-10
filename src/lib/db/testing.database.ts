/**
 * Test-only: an in-memory SQLite database (better-sqlite3, a dev dependency) with the app's
 * real migrations applied, for running queries in Jest without a device. Never imported by the
 * app (it isn't in the barrel).
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import type { LedgerDatabase } from './queries.database';
import * as schema from './schema.database';

export function createTestDatabase(): LedgerDatabase {
  const sqlite = new Database(':memory:');
  const dir = join(__dirname, 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(dir, file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
  return drizzle(sqlite, { schema });
}
