/**
 * The ledger the screens use, backed by SQLite. The shared snapshot (`getSnapshot` /
 * `subscribe`, read by `useLedger`) holds only the small lists (accounts, categories) and a
 * `version` that goes up after every write. Transactions are never all loaded: screens ask
 * for what they show with `useLedgerQuery` + `queries.database.ts`, which re-run when
 * `version` changes.
 * Writes are async, throw on failure (screens show it with `setError('root', …)`), and keep
 * the sync columns current: new UUIDs, `updated_at` on every change, and soft deletes.
 *
 * Whether setup is done comes from `setupStateSetting` (MMKV): `none` shows first-time
 * setup, `own` / `sample` show the app.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { sampleAccounts, sampleCategories, sampleTransactions } from '@/lib/mocks';
import type { Backup } from '@/lib/schemas';
import { type ImportPlan, transactionsToCsv } from '@/lib/spreadsheet';
import { setupStateSetting } from '@/lib/storage';
import type { Account, Category, Transaction } from '@/lib/types';

import { db } from './client.database';
import { newId } from './id.database';
import { readBackup, restoreBackup } from './backup.database';
import { saveImport } from './import.database';
import { accountToRow, categoryToRow, rowToAccount, rowToCategory, rowToTransaction, transactionToRow } from './mappers.database';
import { accounts, categories, transactions } from './schema.database';
import { clearLedgerData, seedSampleData } from './seed.database';
import { whenDatabaseReady } from './setup.database';

export type LedgerStatus = 'idle' | 'loading' | 'ready' | 'error';

export type LedgerSnapshot = {
  status: LedgerStatus;
  /** Why the last load failed (status "error"). */
  error: string | null;
  /** False until first-time setup creates accounts (or the sample data is loaded). */
  setupDone: boolean;
  accounts: Account[];
  categories: Category[];
  /** Goes up after every load and write; queries re-run when it changes. */
  version: number;
};

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;
export type AccountInput = Omit<Account, 'id' | 'sortOrder'>;
export type CategoryInput = Omit<Category, 'id'>;

let snapshot: LedgerSnapshot = {
  status: 'idle',
  error: null,
  setupDone: setupStateSetting.get() !== 'none',
  accounts: [],
  categories: [],
  version: 0,
};

const listeners = new Set<() => void>();

function commit(next: Partial<LedgerSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

const nowIso = () => new Date().toISOString();

/** Every live (not deleted) account and category, as domain objects. */
function readLists(): Pick<LedgerSnapshot, 'accounts' | 'categories'> {
  return {
    accounts: db
      .select()
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt))
      .all()
      .map(rowToAccount),
    // Insertion order, so the seeded list keeps its order and new ones come last.
    categories: db.select().from(categories).where(isNull(categories.deletedAt)).orderBy(sql`rowid`).all().map(rowToCategory),
  };
}

/** Re-reads the database after a write and tells the screens. */
function refresh() {
  commit({ ...readLists(), setupDone: setupStateSetting.get() !== 'none', version: snapshot.version + 1 });
}

/** Waits for the database, runs the write, then refreshes the snapshot. */
async function write<T>(run: () => T): Promise<T> {
  await whenDatabaseReady();
  const result = run();
  refresh();
  return result;
}

const sampleLedger = () => ({ accounts: sampleAccounts, categories: sampleCategories, transactions: sampleTransactions });

/** The next free sort position, so a new account goes last. */
function nextSortOrder(): number {
  const [{ max }] = db.select({ max: sql<number | null>`max(${accounts.sortOrder})` }).from(accounts).all();
  return (max ?? -1) + 1;
}

export const ledgerStore = {
  /** Subscribing starts the first load. */
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (snapshot.status === 'idle') void ledgerStore.load();
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): LedgerSnapshot {
    return snapshot;
  },

  /** Loads everything; also used to retry after an error. */
  async load() {
    if (snapshot.status === 'loading') return;
    commit({ status: 'loading', error: null });
    try {
      await whenDatabaseReady();
      const lists = readLists();
      commit({
        status: 'ready',
        error: null,
        ...lists,
        setupDone: setupStateSetting.get() !== 'none',
        version: snapshot.version + 1,
      });
    } catch (e) {
      commit({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  /** Skips setup and fills the app with the invented sample accounts and history (written once). */
  loadSampleData: () =>
    write(() => {
      seedSampleData(sampleLedger());
      setupStateSetting.set('sample');
    }),

  /** Finishes first-time setup with the accounts the user chose. */
  completeSetup: (inputs: AccountInput[]) =>
    write(() => {
      const now = nowIso();
      const start = nextSortOrder();
      db.transaction((tx) => {
        inputs.forEach((input, i) => {
          tx.insert(accounts)
            .values({ ...accountToRow({ ...input, id: newId(), sortOrder: start + i }), createdAt: now, updatedAt: now })
            .run();
        });
      });
      setupStateSetting.set('own');
    }),

  /** Removes all accounts and transactions (soft delete) and goes back to first-time setup. Categories stay. */
  resetSetup: () =>
    write(() => {
      clearLedgerData();
      setupStateSetting.set('none');
    }),

  /**
   * Re-reads the lists after cloud sync changed the database, so screens and queries update.
   * Returns the new `version` (the sync ignores this bump when deciding whether to sync again).
   */
  refreshAfterSync(): number {
    refresh();
    return snapshot.version;
  },

  /** Every live row as a backup (reads the whole database, so only for an explicit backup). */
  async exportBackup(): Promise<Backup> {
    await whenDatabaseReady();
    return readBackup(db);
  },

  /**
   * Replaces everything with a backup that `checkBackup` accepted. Finishes first-time setup
   * when the backup has accounts (restoring onto a new phone).
   */
  restoreBackup: (backup: Backup) =>
    write(() => {
      const restored = restoreBackup(db, backup);
      if (restored.accounts > 0) setupStateSetting.set('own');
      return restored;
    }),

  /** Adds what a spreadsheet import planned (`buildImport`); everything already here stays. */
  importSpreadsheet: (plan: ImportPlan) => write(() => saveImport(db, plan)),

  /** Every live transaction as CSV text in the import's columns (reads them all, so only on request). */
  async exportSpreadsheet(): Promise<string> {
    await whenDatabaseReady();
    const all = db.select().from(transactions).where(isNull(transactions.deletedAt)).all().map(rowToTransaction);
    return transactionsToCsv(snapshot.accounts, readLists().categories, all);
  },

  addTransaction: (input: TransactionInput): Promise<Transaction> =>
    write(() => {
      const now = nowIso();
      const tx: Transaction = { ...input, id: newId(), createdAt: now, updatedAt: now };
      db.insert(transactions).values(transactionToRow(tx)).run();
      return tx;
    }),

  updateTransaction: (id: string, input: TransactionInput) =>
    write(() => {
      db.update(transactions)
        .set({ ...input, updatedAt: nowIso() })
        .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
        .run();
    }),

  /** Deleting a parent keeps its children; they just lose the link. */
  deleteTransaction: (id: string) =>
    write(() => {
      const now = nowIso();
      db.transaction((tx) => {
        tx.update(transactions)
          .set({ parentId: null, updatedAt: now })
          .where(and(eq(transactions.parentId, id), isNull(transactions.deletedAt)))
          .run();
        tx.update(transactions).set({ deletedAt: now, updatedAt: now }).where(eq(transactions.id, id)).run();
      });
    }),

  addAccount: (input: AccountInput): Promise<Account> =>
    write(() => {
      const now = nowIso();
      const account: Account = { ...input, id: newId(), sortOrder: nextSortOrder() };
      db.insert(accounts)
        .values({ ...accountToRow(account), createdAt: now, updatedAt: now })
        .run();
      return account;
    }),

  updateAccount: (id: string, input: AccountInput) =>
    write(() => {
      // Everything but the id and position comes from the form.
      const { id: _id, sortOrder: _sortOrder, ...fields } = accountToRow({ ...input, id, sortOrder: 0 });
      db.update(accounts)
        .set({ ...fields, updatedAt: nowIso() })
        .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
        .run();
    }),

  addCategory: (input: CategoryInput): Promise<Category> =>
    write(() => {
      const now = nowIso();
      const category: Category = { ...input, id: newId() };
      db.insert(categories)
        .values({ ...categoryToRow(category), createdAt: now, updatedAt: now })
        .run();
      return category;
    }),

  updateCategory: (id: string, input: CategoryInput) =>
    write(() => {
      db.update(categories)
        .set({ ...input, updatedAt: nowIso() })
        .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
        .run();
    }),
};
