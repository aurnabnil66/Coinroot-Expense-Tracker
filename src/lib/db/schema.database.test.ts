import { describe, expect, it } from '@jest/globals';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

import type { Account, Category, Transaction } from '@/lib/types';

import { accounts, categories, transactions } from './schema.database';

const columnsOf = (table: Parameters<typeof getTableConfig>[0]) =>
  Object.fromEntries(getTableConfig(table).columns.map((c) => [c.name, c]));

const SYNC_COLUMNS = ['id', 'created_at', 'updated_at', 'deleted_at'];

describe('database schema', () => {
  it.each([
    ['accounts', accounts],
    ['categories', categories],
    ['transactions', transactions],
  ] as const)('%s has the sync columns (uuid id, timestamps, soft delete)', (_name, table) => {
    const columns = columnsOf(table);
    expect(Object.keys(columns)).toEqual(expect.arrayContaining(SYNC_COLUMNS));
    expect(columns.id.primary).toBe(true);
    expect(columns.deleted_at.notNull).toBe(false);
  });

  it('has a column for every domain field', () => {
    // Domain field names (camelCase) → expected snake_case column; savings details are flattened.
    const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const accountKeys: (keyof Account)[] = ['id', 'name', 'type', 'openingBalance', 'openingDate', 'archived', 'sortOrder'];
    const savingsKeys = ['installmentAmount', 'startDate', 'maturityDate', 'interestRate'];
    const categoryKeys: (keyof Category)[] = ['id', 'name', 'kind', 'icon', 'color', 'archived'];
    const transactionKeys: (keyof Transaction)[] = [
      'id', 'date', 'type', 'fromId', 'toId', 'amount', 'note', 'parentId', 'receivedFrom', 'createdAt', 'updatedAt',
    ];
    expect(Object.keys(columnsOf(accounts))).toEqual(expect.arrayContaining([...accountKeys, ...savingsKeys].map(snake)));
    expect(Object.keys(columnsOf(categories))).toEqual(expect.arrayContaining(categoryKeys.map(snake)));
    expect(Object.keys(columnsOf(transactions))).toEqual(expect.arrayContaining(transactionKeys.map(snake)));
  });

  it('stores money as integer poisha', () => {
    expect(columnsOf(transactions).amount.getSQLType()).toBe('integer');
    expect(columnsOf(accounts).opening_balance.getSQLType()).toBe('integer');
    expect(columnsOf(accounts).installment_amount.getSQLType()).toBe('integer');
  });

  it('guards amounts, types and transfers with check constraints', () => {
    expect(getTableConfig(transactions).checks.map((c) => c.name).sort()).toEqual([
      'transactions_amount_check',
      'transactions_from_to_check',
      'transactions_type_check',
    ]);
    expect(getTableConfig(accounts).checks.map((c) => c.name)).toEqual(['accounts_type_check']);
    expect(getTableConfig(categories).checks.map((c) => c.name)).toEqual(['categories_kind_check']);
  });
});
