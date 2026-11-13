import { beforeEach, describe, expect, it } from '@jest/globals';

import { buildImport, guessColumns, guessHeaderRow, neededNames, parseTable, readRows } from '@/lib/spreadsheet';

import { rowToAccount, rowToCategory } from './mappers.database';
import { saveImport } from './import.database';
import { getAccountBalances, getTransactionsBetween, type LedgerDatabase } from './queries.database';
import { accounts, categories } from './schema.database';
import { createTestDatabase } from './testing.database';

let db: LedgerDatabase;
let n = 0;
const id = () => `id-${++n}`;
const NOW = '2026-11-10T00:00:00.000Z';

beforeEach(() => {
  db = createTestDatabase();
  db.insert(accounts)
    .values({ id: 'a-cash', name: 'Cash', type: 'cash', openingBalance: 100_000, openingDate: '2026-01-01', sortOrder: 0, createdAt: NOW, updatedAt: NOW })
    .run();
  db.insert(categories).values({ id: 'c-food', name: 'Food', kind: 'expense', createdAt: NOW, updatedAt: NOW }).run();
});

function plan(text: string) {
  const table = parseTable(text);
  const headerRow = guessHeaderRow(table);
  const draft = readRows(
    table,
    { headerRow, columns: guessColumns(table, headerRow), dateOrder: 'ymd', defaultType: 'expense', defaultAccount: null, today: '2026-11-10' },
    ['Cash']
  );
  expect(draft.problems).toEqual([]);
  const live = { accounts: db.select().from(accounts).all().map(rowToAccount), categories: db.select().from(categories).all().map(rowToCategory) };
  const needs = neededNames(draft.rows, live.accounts, live.categories);
  const office = needs.find((need) => need.name === 'Office Bank');
  return buildImport(draft.rows, needs, office ? { [office.key]: { action: 'create', accountType: 'bank', openingBalance: 1_000_000 } } : {}, id);
}

describe('saveImport', () => {
  it('adds accounts after the existing ones, categories and transactions; balances add up', () => {
    const result = saveImport(
      db,
      plan(
        [
          'ID,Date,Type,From,To/Category,Amount,Note,Linked to',
          'T1,2026-11-01,Income,Salary,Office Bank,50000,,',
          'T2,2026-11-02,Transfer,Office Bank,Cash,2000,ATM,',
          'T3,2026-11-02,Expense,Cash,Food,250,Lunch,T2',
          'T4,2026-11-03,Expense,Cash,Transport,40,,T2',
        ].join('\n')
      ),
      NOW
    );
    expect(result).toEqual({ accounts: 1, categories: 2, transactions: 4 });

    const office = db.select().from(accounts).all().find((a) => a.name === 'Office Bank')!;
    expect(office).toMatchObject({ sortOrder: 1, openingBalance: 1_000_000, openingDate: '2026-11-01', createdAt: NOW });
    const balances = getAccountBalances(db);
    expect(balances.get(office.id)).toBe(1_000_000 + 5_000_000 - 200_000);
    expect(balances.get('a-cash')).toBe(100_000 + 200_000 - 25_000 - 4_000);

    const rows = getTransactionsBetween(db, '2026-11-01', '2026-11-30');
    const atm = rows.find((tx) => tx.note === 'ATM')!;
    expect(rows.filter((tx) => tx.parentId === atm.id)).toHaveLength(2);
    expect(db.select().from(categories).all().map((c) => c.name).sort()).toEqual(['Food', 'Salary', 'Transport']);
  });

  it('a failure saves nothing', () => {
    const planned = plan('Date,Type,From,To,Amount\n2026-11-01,Expense,Cash,Food,10\n2026-11-02,Expense,Cash,Food,20');
    planned.transactions[1].id = planned.transactions[0].id;
    expect(() => saveImport(db, planned)).toThrow();
    expect(getTransactionsBetween(db, '2000-01-01', '2999-12-31')).toEqual([]);
  });
});
