/**
 * In-memory stand-in for the database while the screens are being built.
 * Same reads (`getSnapshot` / `subscribe`, consumed by `useLedger`) and writes
 * (`ledgerStore.*`) the SQLite layer will provide later. Changes reset on reload.
 * Loading and writes are async with a small simulated delay, like the database,
 * so the screens' loading states and button spinners are exercised.
 *
 * Whether setup is done is saved in MMKV (`setupStateSetting`), so setup runs once.
 * A fresh install starts with setup and only the seed categories. After "Explore with
 * sample data" every launch reloads the samples. After the user's own setup, launches
 * skip setup but start with no accounts, since this mock keeps nothing (the DB will).
 */
import { clearLedgerData, seedSampleData, whenDatabaseReady } from '@/lib/db';
import { setupStateSetting } from '@/lib/storage';
import type { Account, Category, Transaction } from '@/lib/types';

import { sampleAccounts, sampleCategories, sampleTransactions } from './sample-data.mock';

export type LedgerStatus = 'idle' | 'loading' | 'ready' | 'error';

export type LedgerSnapshot = {
  status: LedgerStatus;
  /** Why the last load failed (status "error"). */
  error: string | null;
  /** False until first-time setup creates accounts (or the sample data is loaded). */
  setupDone: boolean;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
};

let snapshot: LedgerSnapshot = {
  status: 'idle',
  error: null,
  setupDone: false,
  accounts: [],
  categories: [],
  transactions: [],
};

const LOAD_DELAY_MS = 700;
const WRITE_DELAY_MS = 300;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Step 2 of the database work: the sample rows and "start over" are already written to SQLite
 * (once), while the screens still read this in-memory copy until step 3 switches them over.
 */
const sampleLedger = () => ({
  accounts: sampleAccounts,
  categories: sampleCategories,
  transactions: sampleTransactions,
});

const listeners = new Set<() => void>();

function commit(next: Partial<LedgerSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;
export type AccountInput = Omit<Account, 'id' | 'sortOrder'>;
export type CategoryInput = Omit<Category, 'id'>;

export const ledgerStore = {
  /** Subscribing starts the first load. */
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (snapshot.status === 'idle') void ledgerStore.load();
    return () => listeners.delete(listener);
  },

  /** Loads everything; also used to retry after an error. */
  async load() {
    if (snapshot.status === 'loading') return;
    commit({ status: 'loading', error: null });
    try {
      await delay(LOAD_DELAY_MS);
      await whenDatabaseReady();
      const setup = setupStateSetting.get();
      if (setup === 'sample') {
        // Fills the database for anyone who chose sample data before it existed; no-op otherwise.
        seedSampleData(sampleLedger());
        commit({ status: 'ready', setupDone: true, ...sampleLedger() });
      } else {
        // Seed categories only; accounts come from setup (or, after setup, aren't kept by this mock).
        commit({ status: 'ready', setupDone: setup === 'own', categories: sampleCategories });
      }
    } catch (e) {
      commit({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  getSnapshot(): LedgerSnapshot {
    return snapshot;
  },

  /** Skips setup and fills the app with the invented sample accounts and history. */
  async loadSampleData() {
    await delay(WRITE_DELAY_MS);
    await whenDatabaseReady();
    seedSampleData(sampleLedger());
    setupStateSetting.set('sample');
    commit({ setupDone: true, ...sampleLedger() });
  },

  /** Finishes first-time setup with the accounts the user chose. */
  async completeSetup(accounts: AccountInput[]) {
    await delay(WRITE_DELAY_MS);
    setupStateSetting.set('own');
    commit({
      setupDone: true,
      accounts: accounts.map((input, sortOrder) => ({ ...input, id: newId('acc'), sortOrder })),
      transactions: [],
    });
  },

  /** Removes all accounts and transactions and goes back to first-time setup. */
  async resetSetup() {
    await delay(WRITE_DELAY_MS);
    await whenDatabaseReady();
    clearLedgerData();
    setupStateSetting.set('none');
    commit({ setupDone: false, accounts: [], categories: sampleCategories, transactions: [] });
  },

  async addTransaction(input: TransactionInput): Promise<Transaction> {
    await delay(WRITE_DELAY_MS);
    const now = new Date().toISOString();
    const tx: Transaction = { ...input, id: newId('tx'), createdAt: now, updatedAt: now };
    commit({ transactions: [...snapshot.transactions, tx] });
    return tx;
  },

  async updateTransaction(id: string, input: TransactionInput) {
    await delay(WRITE_DELAY_MS);
    const updatedAt = new Date().toISOString();
    commit({
      transactions: snapshot.transactions.map((tx) => (tx.id === id ? { ...tx, ...input, updatedAt } : tx)),
    });
  },

  /** Deleting a parent keeps its children; they just lose the link. */
  async deleteTransaction(id: string) {
    await delay(WRITE_DELAY_MS);
    commit({
      transactions: snapshot.transactions
        .filter((tx) => tx.id !== id)
        .map((tx) => (tx.parentId === id ? { ...tx, parentId: null } : tx)),
    });
  },

  async addAccount(input: AccountInput): Promise<Account> {
    await delay(WRITE_DELAY_MS);
    const sortOrder = Math.max(-1, ...snapshot.accounts.map((a) => a.sortOrder)) + 1;
    const account: Account = { ...input, id: newId('acc'), sortOrder };
    commit({ accounts: [...snapshot.accounts, account] });
    return account;
  },

  async updateAccount(id: string, input: AccountInput) {
    await delay(WRITE_DELAY_MS);
    commit({ accounts: snapshot.accounts.map((a) => (a.id === id ? { ...a, ...input } : a)) });
  },

  async addCategory(input: CategoryInput): Promise<Category> {
    await delay(WRITE_DELAY_MS);
    const category: Category = { ...input, id: newId(input.kind === 'expense' ? 'cat' : 'src') };
    commit({ categories: [...snapshot.categories, category] });
    return category;
  },

  async updateCategory(id: string, input: CategoryInput) {
    await delay(WRITE_DELAY_MS);
    commit({ categories: snapshot.categories.map((c) => (c.id === id ? { ...c, ...input } : c)) });
  },
};
