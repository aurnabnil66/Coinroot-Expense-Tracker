/**
 * Saving a spreadsheet import (`buildImport` in `src/lib/spreadsheet`): new accounts (placed
 * after the existing ones), new categories and the transactions, all in one transaction, so
 * a failure leaves the database as it was. Nothing existing is changed.
 */
import { sql } from 'drizzle-orm';

import type { ImportPlan } from '@/lib/spreadsheet';

import { accountToRow, categoryToRow, transactionToRow } from './mappers.database';
import type { LedgerDatabase } from './queries.database';
import { accounts, categories, transactions } from './schema.database';

/** Rows per INSERT, well under SQLite's limit on bound values. */
const CHUNK = 100;

export function saveImport(database: LedgerDatabase, plan: ImportPlan, now = new Date().toISOString()) {
  database.transaction((tx) => {
    const [{ max }] = tx.select({ max: sql<number | null>`max(${accounts.sortOrder})` }).from(accounts).all();
    const start = (max ?? -1) + 1;
    const stamps = { createdAt: now, updatedAt: now };
    if (plan.accounts.length > 0) {
      tx.insert(accounts)
        .values(plan.accounts.map((account, i) => ({ ...accountToRow({ ...account, sortOrder: start + i }), ...stamps })))
        .run();
    }
    if (plan.categories.length > 0) {
      tx.insert(categories)
        .values(plan.categories.map((category) => ({ ...categoryToRow(category), ...stamps })))
        .run();
    }
    for (let i = 0; i < plan.transactions.length; i += CHUNK) {
      tx.insert(transactions)
        .values(plan.transactions.slice(i, i + CHUNK).map(transactionToRow))
        .run();
    }
  });
  return { accounts: plan.accounts.length, categories: plan.categories.length, transactions: plan.transactions.length };
}
