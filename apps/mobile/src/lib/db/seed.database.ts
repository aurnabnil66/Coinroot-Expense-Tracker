import { count, isNull } from 'drizzle-orm';

import { type Database, db } from './client.database';
import { newId } from './id.database';
import { accounts, categories, transactions } from './schema.database';
import { defaultCategoryRows, type SampleLedger, sampleRows } from './seed-rows.database';

/** Rows per INSERT, well under SQLite's limit on bound values. */
const CHUNK = 100;

const nowIso = () => new Date().toISOString();

function insertInChunks<T>(rows: T[], insert: (chunk: T[]) => void) {
  for (let i = 0; i < rows.length; i += CHUNK) insert(rows.slice(i, i + CHUNK));
}

/**
 * First launch: adds the default categories and income sources. Runs only while the table
 * has never had a row (deleted rows count), so it never brings back what the user removed.
 * Returns how many were added.
 */
export function seedDefaultCategories(database: Database = db): number {
  return database.transaction((tx) => {
    const [{ total }] = tx.select({ total: count() }).from(categories).all();
    if (total > 0) return 0;
    const rows = defaultCategoryRows(newId);
    tx.insert(categories).values(rows).run();
    return rows.length;
  });
}

/**
 * "Explore with sample data": writes the sample accounts and history once. Skipped (returns
 * false) when there are live accounts already, so choosing it again never duplicates them.
 */
export function seedSampleData(sample: SampleLedger, database: Database = db): boolean {
  return database.transaction((tx) => {
    const [{ live }] = tx.select({ live: count() }).from(accounts).where(isNull(accounts.deletedAt)).all();
    if (live > 0) return false;
    const existing = tx
      .select({ id: categories.id, name: categories.name, kind: categories.kind })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .all();
    const rows = sampleRows(sample, existing, newId);
    insertInChunks(rows.categories, (chunk) => tx.insert(categories).values(chunk).run());
    insertInChunks(rows.accounts, (chunk) => tx.insert(accounts).values(chunk).run());
    insertInChunks(rows.transactions, (chunk) => tx.insert(transactions).values(chunk).run());
    return true;
  });
}

/**
 * "Set up accounts again": marks every account and transaction deleted (soft delete, so it
 * can sync later). Categories are kept.
 */
export function clearLedgerData(database: Database = db): void {
  const now = nowIso();
  database.transaction((tx) => {
    tx.update(transactions).set({ deletedAt: now, updatedAt: now }).where(isNull(transactions.deletedAt)).run();
    tx.update(accounts).set({ deletedAt: now, updatedAt: now }).where(isNull(accounts.deletedAt)).run();
  });
}

/** How many live rows each table has (for checks and debugging). */
export function ledgerCounts(database: Database = db) {
  const live = <T extends typeof accounts | typeof categories | typeof transactions>(table: T) =>
    database.select({ n: count() }).from(table).where(isNull(table.deletedAt)).all()[0].n;
  return { accounts: live(accounts), categories: live(categories), transactions: live(transactions) };
}
