/**
 * In-memory stand-in for the database while the screens are being built.
 * Same reads (`getSnapshot` / `subscribe`, consumed by `useLedger`) and writes
 * (`ledgerStore.*`) the SQLite layer will provide later. Changes reset on reload.
 * Loading and writes are async with a small simulated delay, like the database,
 * so the screens' loading states and button spinners are exercised.
 */
import type { Account, Category, Transaction } from '@/lib/types';

import { sampleAccounts, sampleCategories, sampleTransactions } from './sample-data.mock';

export type LedgerStatus = 'idle' | 'loading' | 'ready' | 'error';

export type LedgerSnapshot = {
  status: LedgerStatus;
  /** Why the last load failed (status "error"). */
  error: string | null;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
};

let snapshot: LedgerSnapshot = {
  status: 'idle',
  error: null,
  accounts: [],
  categories: [],
  transactions: [],
};

const LOAD_DELAY_MS = 700;
const WRITE_DELAY_MS = 300;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
      commit({
        status: 'ready',
        accounts: sampleAccounts,
        categories: sampleCategories,
        transactions: sampleTransactions,
      });
    } catch (e) {
      commit({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  getSnapshot(): LedgerSnapshot {
    return snapshot;
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
