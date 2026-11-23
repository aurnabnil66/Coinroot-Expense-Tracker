/**
 * Converts between the domain types the screens use (`src/lib/types`) and database rows.
 * The only differences: savings details are flattened into nullable columns on `accounts`,
 * and rows carry sync timestamps the domain types don't need.
 */
import type { Account, Category, Transaction } from '@/lib/types';

import type { AccountRow, CategoryRow, NewAccountRow, NewCategoryRow, NewTransactionRow, TransactionRow } from './schema.database';

export function rowToAccount(row: AccountRow): Account {
  const hasSavings =
    row.type === 'savings' ||
    row.installmentAmount !== null ||
    row.startDate !== null ||
    row.maturityDate !== null ||
    row.interestRate !== null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openingBalance: row.openingBalance,
    openingDate: row.openingDate,
    archived: row.archived,
    sortOrder: row.sortOrder,
    savings: hasSavings
      ? {
          installmentAmount: row.installmentAmount,
          startDate: row.startDate,
          maturityDate: row.maturityDate,
          interestRate: row.interestRate,
        }
      : null,
  };
}

export function accountToRow(account: Account): NewAccountRow {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    openingBalance: account.openingBalance,
    openingDate: account.openingDate,
    archived: account.archived,
    sortOrder: account.sortOrder,
    installmentAmount: account.savings?.installmentAmount ?? null,
    startDate: account.savings?.startDate ?? null,
    maturityDate: account.savings?.maturityDate ?? null,
    interestRate: account.savings?.interestRate ?? null,
  };
}

export function rowToCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, kind: row.kind, icon: row.icon, color: row.color, archived: row.archived };
}

export function categoryToRow(category: Category): NewCategoryRow {
  return { ...category };
}

export function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    fromId: row.fromId,
    toId: row.toId,
    amount: row.amount,
    note: row.note,
    parentId: row.parentId,
    receivedFrom: row.receivedFrom,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function transactionToRow(tx: Transaction): NewTransactionRow {
  return { ...tx };
}
