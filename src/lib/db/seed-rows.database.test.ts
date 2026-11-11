import { describe, expect, it } from '@jest/globals';

import { DEFAULT_CATEGORIES } from '@/lib/constants';
import type { Account, Category, Transaction } from '@/lib/types';

import { accountToRow, rowToAccount, rowToTransaction, transactionToRow } from './mappers.database';
import type { AccountRow, TransactionRow } from './schema.database';
import { defaultCategoryRows, sampleRows } from './seed-rows.database';

const counter = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const sync = { createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', deletedAt: null };

const cash: Account = {
  id: 'acc-cash', name: 'Cash', type: 'cash', openingBalance: 150000, openingDate: '2026-11-01',
  archived: false, sortOrder: 0, savings: null,
};
const dps: Account = {
  id: 'acc-dps', name: 'Savings (DPS)', type: 'savings', openingBalance: 0, openingDate: '2026-11-01',
  archived: false, sortOrder: 1,
  savings: { installmentAmount: 500000, startDate: '2026-11-01', maturityDate: null, interestRate: 8.5 },
};
const food: Category = { id: 'cat-food', name: 'Food', kind: 'expense', icon: null, color: 'orange', archived: false };
const pets: Category = { id: 'cat-pets', name: 'Pets', kind: 'expense', icon: null, color: 'teal', archived: false };
const tx = (fields: Partial<Transaction> & Pick<Transaction, 'id' | 'fromId' | 'toId'>): Transaction => ({
  date: '2026-11-05', type: 'expense', amount: 5000, note: '', parentId: null, party: null,
  createdAt: sync.createdAt, updatedAt: sync.updatedAt, ...fields,
});

describe('defaultCategoryRows', () => {
  it('adds every default category with its own id', () => {
    const rows = defaultCategoryRows(counter());
    expect(rows).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.find((r) => r.name === 'Bank Charges')).toMatchObject({ kind: 'expense', archived: false });
    expect(rows.filter((r) => r.kind === 'income_source').map((r) => r.name)).toContain('Salary');
  });
});

describe('sampleRows', () => {
  const atm = tx({ id: 'tx-atm', type: 'transfer', fromId: 'acc-dps', toId: 'acc-cash', amount: 100000 });
  const lunch = tx({ id: 'tx-lunch', fromId: 'acc-cash', toId: 'cat-food', parentId: 'tx-atm' });
  const vet = tx({ id: 'tx-vet', fromId: 'acc-cash', toId: 'cat-pets' });
  const sample = { accounts: [cash, dps], categories: [food, pets], transactions: [lunch, atm, vet] };

  it('reuses existing categories by name and adds only the missing ones', () => {
    const rows = sampleRows(sample, [{ id: 'db-food', name: 'food', kind: 'expense' }], counter());
    expect(rows.categories.map((c) => c.name)).toEqual(['Pets']);
    const lunchRow = rows.transactions.find((t) => t.note === '' && t.parentId);
    expect(lunchRow?.toId).toBe('db-food');
  });

  it('gives every row a new id and keeps the links (from, to, parent) pointing at them', () => {
    const rows = sampleRows(sample, [], counter());
    const accountIds = new Map(sample.accounts.map((a, i) => [a.id, rows.accounts[i].id]));
    const txIds = new Map(sample.transactions.map((t, i) => [t.id, rows.transactions[i].id]));
    const [lunchRow, atmRow] = rows.transactions;

    expect(rows.accounts.every((a) => !a.id.startsWith('acc-'))).toBe(true);
    expect(lunchRow.parentId).toBe(txIds.get('tx-atm')); // a parent listed after its child still maps
    expect(atmRow).toMatchObject({ fromId: accountIds.get('acc-dps'), toId: accountIds.get('acc-cash'), amount: 100000 });
  });

  it('refuses links to ids that are not in the sample', () => {
    const broken = { ...sample, transactions: [tx({ id: 'tx-x', fromId: 'acc-missing', toId: 'cat-food' })] };
    expect(() => sampleRows(broken, [], counter())).toThrow('unknown id: acc-missing');
  });
});

describe('row mappers', () => {
  it('flattens savings details into columns and back', () => {
    const row = { ...accountToRow(dps), ...sync } as AccountRow;
    expect(row).toMatchObject({ installmentAmount: 500000, interestRate: 8.5, maturityDate: null });
    expect(rowToAccount(row)).toEqual(dps);
  });

  it('keeps savings null for everyday accounts', () => {
    const row = { ...accountToRow(cash), ...sync } as AccountRow;
    expect(rowToAccount(row).savings).toBeNull();
  });

  it('round-trips transactions', () => {
    const original = tx({ id: 'tx-1', type: 'income', fromId: 'src-x', toId: 'acc-cash', party: 'Client A' });
    expect(rowToTransaction({ ...transactionToRow(original), deletedAt: null } as TransactionRow)).toEqual(original);
  });
});
