import type { Account, Category, Transaction } from '@/lib/types';

import { toMonthKey } from './date.util';

/**
 * Account balance = opening balance + money in − money out,
 * counting only transactions on/after the account's opening date.
 */
export function accountBalance(account: Account, transactions: readonly Transaction[]): number {
  let balance = account.openingBalance;
  for (const tx of transactions) {
    if (tx.date < account.openingDate) continue;
    const moneyIn = tx.type !== 'expense' && tx.toId === account.id;
    const moneyOut = tx.type !== 'income' && tx.fromId === account.id;
    if (moneyIn) balance += tx.amount;
    if (moneyOut) balance -= tx.amount;
  }
  return balance;
}

export function accountBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[]
): Map<string, number> {
  return new Map(accounts.map((account) => [account.id, accountBalance(account, transactions)]));
}

export function childrenOf(parentId: string, transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter((tx) => tx.parentId === parentId);
}

/** What's left of a transaction's money after the transactions linked to it: amount − children. */
export function remainingOf(parent: Transaction, transactions: readonly Transaction[]): number {
  return childrenOf(parent.id, transactions).reduce((left, child) => left - child.amount, parent.amount);
}

/**
 * Transactions that put money into `accountId` and can be picked as "Linked to" for
 * money leaving it — e.g. the ATM withdrawal into Cash for a rickshaw fare paid in cash.
 */
export function linkableParents(
  accountId: string,
  transactions: readonly Transaction[],
  excludeId?: string
): Transaction[] {
  return transactions
    .filter((tx) => tx.id !== excludeId && tx.type !== 'expense' && tx.toId === accountId)
    .sort(compareNewestFirst);
}

export type CategoryTotal = {
  categoryId: string;
  amount: number;
  /** Share of the month's expenses, 0–1. */
  share: number;
};

export type MonthlySummary = {
  income: number;
  expenses: number;
  /** income − expenses (transfers are never counted). */
  saved: number;
  /** Transfers into savings accounts (e.g. DPS installments). */
  movedToSavings: number;
  byCategory: CategoryTotal[];
};

export function monthlySummary(
  monthKey: string,
  transactions: readonly Transaction[],
  accounts: readonly Account[]
): MonthlySummary {
  const savingsIds = new Set(accounts.filter((a) => a.type === 'savings').map((a) => a.id));
  const byCategory = new Map<string, number>();
  let income = 0;
  let expenses = 0;
  let movedToSavings = 0;

  for (const tx of transactions) {
    if (toMonthKey(tx.date) !== monthKey) continue;
    if (tx.type === 'income') {
      income += tx.amount;
    } else if (tx.type === 'expense') {
      expenses += tx.amount;
      byCategory.set(tx.toId, (byCategory.get(tx.toId) ?? 0) + tx.amount);
    } else if (savingsIds.has(tx.toId) && !savingsIds.has(tx.fromId)) {
      movedToSavings += tx.amount;
    }
  }

  return {
    income,
    expenses,
    saved: income - expenses,
    movedToSavings,
    byCategory: [...byCategory]
      .map(([categoryId, amount]) => ({
        categoryId,
        amount,
        share: expenses > 0 ? amount / expenses : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function compareNewestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

export type DayGroup = {
  date: string;
  /** Money spent that day (expenses only). */
  spent: number;
  data: Transaction[];
};

/** Groups transactions by day, newest day first, newest entry first within a day. */
export function groupByDay(transactions: readonly Transaction[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const tx of [...transactions].sort(compareNewestFirst)) {
    let group = groups.get(tx.date);
    if (!group) {
      group = { date: tx.date, spent: 0, data: [] };
      groups.set(tx.date, group);
    }
    group.data.push(tx);
    if (tx.type === 'expense') group.spent += tx.amount;
  }
  return [...groups.values()];
}

/** Looks up account / category / income-source names for a transaction's from and to. */
export function nameLookup(
  accounts: readonly Account[],
  categories: readonly Category[]
): (id: string) => string {
  const names = new Map<string, string>();
  for (const item of [...accounts, ...categories]) names.set(item.id, item.name);
  return (id) => names.get(id) ?? 'Unknown';
}
