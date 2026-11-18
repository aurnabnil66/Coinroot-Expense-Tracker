/**
 * Backup and restore against the database. File handling (writing, sharing, picking) lives in
 * `src/lib/storage/backup-file.storage.ts`; checking a file is `checkBackup` in `src/lib/schemas`.
 */
import { asc, getTableColumns, isNull, sql } from 'drizzle-orm';

import { BACKUP_APP, BACKUP_FORMAT, type Backup } from '@/lib/schemas';

import type { LedgerDatabase } from './queries.database';
import { accounts, categories, transactions } from './schema.database';

/** Rows per INSERT, well under SQLite's limit on bound values. */
const CHUNK = 100;

/**
 * Every live account, category and transaction, oldest first, as a backup. A "Linked to" that
 * points at an entry not in the file (e.g. one cloud sync couldn't store yet) is left out, so
 * the file always passes `checkBackup`.
 */
export function readBackup(database: LedgerDatabase, exportedAt = new Date().toISOString()): Backup {
  // Backups hold the ledger only: no soft-delete or sync bookkeeping.
  const withoutDeletedAt = <T extends { deletedAt: string | null; syncedUpdatedAt: string | null }>({
    deletedAt: _deletedAt,
    syncedUpdatedAt: _syncedUpdatedAt,
    ...row
  }: T) => row;
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt,
    accounts: database
      .select()
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt))
      .all()
      .map(withoutDeletedAt),
    categories: database.select().from(categories).where(isNull(categories.deletedAt)).orderBy(sql`rowid`).all().map(withoutDeletedAt),
    transactions: linksInsideFile(
      database
        .select()
        .from(transactions)
        .where(isNull(transactions.deletedAt))
        .orderBy(asc(transactions.date), asc(transactions.createdAt), asc(transactions.id))
        .all()
        .map(withoutDeletedAt)
    ),
  };
}

/** Clears a `parentId` whose transaction isn't among `rows`. */
function linksInsideFile<T extends { id: string; parentId: string | null }>(rows: T[]): T[] {
  const ids = new Set(rows.map((row) => row.id));
  return rows.map((row) => (row.parentId !== null && !ids.has(row.parentId) ? { ...row, parentId: null } : row));
}

type LedgerTable = typeof accounts | typeof categories | typeof transactions;

/** `SET field = excluded.column` for every column but the id, so an upsert takes the backup's values. */
function takeIncoming(table: LedgerTable) {
  return Object.fromEntries(
    Object.entries(getTableColumns(table))
      .filter(([, column]) => column.name !== 'id')
      .map(([field, column]) => [field, sql.raw(`excluded.${column.name}`)])
  );
}

/**
 * Makes the database match a checked backup, in one transaction: every current row is marked
 * deleted, then each backup row is written back (updating a row with the same id, so restoring
 * your own backup brings the same rows back). Soft deletes and fresh `updated_at` keep it
 * ready for sync. Returns how many rows of each kind were restored.
 */
export function restoreBackup(database: LedgerDatabase, backup: Backup, now = new Date().toISOString()) {
  // A fresh `updated_at` and no `synced_updated_at`: restored rows upload on the next sync.
  const keyed = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((row) => ({ ...row, updatedAt: now, deletedAt: null, syncedUpdatedAt: null }));
  database.transaction((tx) => {
    for (const table of [transactions, accounts, categories]) {
      tx.update(table).set({ deletedAt: now, updatedAt: now }).where(isNull(table.deletedAt)).run();
    }
    const upsert = (table: LedgerTable, rows: Record<string, unknown>[]) => {
      const set = takeIncoming(table);
      for (let i = 0; i < rows.length; i += CHUNK) {
        tx.insert(table)
          .values(rows.slice(i, i + CHUNK) as never)
          .onConflictDoUpdate({ target: table.id, set })
          .run();
      }
    };
    upsert(categories, keyed(backup.categories));
    upsert(accounts, keyed(backup.accounts));
    upsert(transactions, keyed(backup.transactions));
  });
  return { accounts: backup.accounts.length, categories: backup.categories.length, transactions: backup.transactions.length };
}
