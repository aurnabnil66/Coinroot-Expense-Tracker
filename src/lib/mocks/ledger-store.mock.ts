/**
 * In-memory stand-in for the database while the screens are being built.
 * Same reads (`getSnapshot` / `subscribe`, consumed by `useLedger`) and writes
 * (`ledgerStore.*`) the SQLite layer will provide later. Changes reset on reload.
 */
import type { Account, Category, Transaction } from '@/lib/types';

import { sampleAccounts, sampleCategories, sampleTransactions } from './sample-data.mock';

export type LedgerSnapshot = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
};

let snapshot: LedgerSnapshot = {
  accounts: sampleAccounts,
  categories: sampleCategories,
  transactions: sampleTransactions,
};

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
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): LedgerSnapshot {
    return snapshot;
  },

  addTransaction(input: TransactionInput): Transaction {
    const now = new Date().toISOString();
    const tx: Transaction = { ...input, id: newId('tx'), createdAt: now, updatedAt: now };
    commit({ transactions: [...snapshot.transactions, tx] });
    return tx;
  },

  updateTransaction(id: string, input: TransactionInput) {
    const updatedAt = new Date().toISOString();
    commit({
      transactions: snapshot.transactions.map((tx) => (tx.id === id ? { ...tx, ...input, updatedAt } : tx)),
    });
  },

  /** Deleting a parent keeps its children; they just lose the link. */
  deleteTransaction(id: string) {
    commit({
      transactions: snapshot.transactions
        .filter((tx) => tx.id !== id)
        .map((tx) => (tx.parentId === id ? { ...tx, parentId: null } : tx)),
    });
  },

  addAccount(input: AccountInput): Account {
    const sortOrder = Math.max(-1, ...snapshot.accounts.map((a) => a.sortOrder)) + 1;
    const account: Account = { ...input, id: newId('acc'), sortOrder };
    commit({ accounts: [...snapshot.accounts, account] });
    return account;
  },

  updateAccount(id: string, input: AccountInput) {
    commit({ accounts: snapshot.accounts.map((a) => (a.id === id ? { ...a, ...input } : a)) });
  },

  addCategory(input: CategoryInput): Category {
    const category: Category = { ...input, id: newId(input.kind === 'expense' ? 'cat' : 'src') };
    commit({ categories: [...snapshot.categories, category] });
    return category;
  },

  updateCategory(id: string, input: CategoryInput) {
    commit({ categories: snapshot.categories.map((c) => (c.id === id ? { ...c, ...input } : c)) });
  },
};
