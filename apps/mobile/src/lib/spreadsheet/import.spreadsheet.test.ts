/**
 * Whole imports from differently laid-out sheets: Coinroot's own columns, a bank statement,
 * a diary with one signed amount column, a table pasted from Word, and a round trip through
 * the CSV export. Names, amounts and dates are invented.
 */
import { describe, expect, it } from '@jest/globals';

import type { Account, Category, Transaction } from '@/lib/types';

import { guessColumns, guessHeaderRow } from './columns.spreadsheet';
import { plainTaka, safeCell, transactionsToCsv } from './export.spreadsheet';
import { buildImport, defaultChoice, findDuplicates, guessAccountType, neededNames, withoutDuplicates } from './plan.spreadsheet';
import { type ImportOptions, readRows } from './rows.spreadsheet';
import { parseTable, unreadableFileReason } from './table.spreadsheet';
import { guessDateOrder } from './values.spreadsheet';

const TODAY = '2026-11-10';

const account = (id: string, name: string, type: Account['type'] = 'bank'): Account => ({
  id,
  name,
  type,
  openingBalance: 0,
  openingDate: '2026-01-01',
  archived: false,
  sortOrder: 0,
  savings: null,
});
const category = (id: string, name: string, kind: Category['kind']): Category => ({
  id,
  name,
  kind,
  icon: null,
  color: null,
  archived: false,
});

const ACCOUNTS = [account('a-bank', 'Main Bank'), account('a-cash', 'Cash', 'cash')];
const CATEGORIES = [
  category('c-food', 'Food', 'expense'),
  category('c-other', 'Other', 'expense'),
  category('s-salary', 'Salary', 'income_source'),
  category('s-other', 'Other Income', 'income_source'),
];

/** Reads a sheet the way the import screen does with the guessed settings. */
function importSheet(text: string, overrides: Partial<ImportOptions> = {}) {
  const table = parseTable(text);
  const headerRow = guessHeaderRow(table);
  const columns = guessColumns(table, headerRow);
  const dates = columns.date === undefined ? [] : table.slice((headerRow ?? -1) + 1).map((row) => row[columns.date!]);
  const options: ImportOptions = {
    headerRow,
    columns,
    dateOrder: guessDateOrder(dates).order,
    defaultType: 'expense',
    defaultAccount: null,
    today: TODAY,
    ...overrides,
  };
  const draft = readRows(table, options, ACCOUNTS.map((a) => a.name));
  return { table, options, draft };
}

function counter() {
  let n = 0;
  return () => `new-${++n}`;
}

describe('Coinroot layout (the spreadsheet this app replaces)', () => {
  const sheet = [
    'ID,Date,Type,From,To/Category,Amount,Note,Linked to,Left from this (auto)',
    'T1,2026-11-01,Income,Salary,Office Bank,"50,000",November,,',
    'T2,2026-11-02,Transfer,Office Bank,Main Bank,40000,,,',
    'T3,2026-11-03,Transfer,Main Bank,Cash,"5,000",ATM,,4780',
    'T4,2026-11-03,Expense,Cash,Transport,220,CNG,T3,',
    'T5,2026-11-04,Expense,cash,food,150.50,Lunch,,',
  ].join('\n');

  it('finds the columns and ignores the computed one', () => {
    const { options } = importSheet(sheet);
    expect(options.headerRow).toBe(0);
    expect(options.columns).toEqual({ id: 0, date: 1, type: 2, from: 3, to: 4, amount: 5, note: 6, linkedTo: 7 });
  });

  it('reads every row, matches names without case, creates the unknown ones and links T4 to T3', () => {
    const { draft } = importSheet(sheet);
    expect(draft.problems).toEqual([]);
    expect(draft.rows).toHaveLength(5);

    const needs = neededNames(draft.rows, ACCOUNTS, CATEGORIES);
    const byName = Object.fromEntries(needs.map((n) => [`${n.role}:${n.name}`, n.existingId]));
    expect(byName).toEqual({
      'account:Office Bank': null,
      'account:Main Bank': 'a-bank',
      'account:Cash': 'a-cash',
      'expense:Transport': null,
      'expense:Food': 'c-food',
      'income_source:Salary': 's-salary',
    });
    expect(needs.find((n) => n.name === 'Office Bank')?.firstDate).toBe('2026-11-01');

    const plan = buildImport(draft.rows, needs, {}, counter(), new Date('2026-11-10T00:00:00Z'));
    expect(plan.accounts.map((a) => [a.name, a.type, a.openingDate])).toEqual([['Office Bank', 'bank', '2026-11-01']]);
    expect(plan.categories.map((c) => [c.name, c.kind])).toEqual([['Transport', 'expense']]);
    const [salary, , atm, cng, lunch] = plan.transactions;
    expect(salary).toMatchObject({ type: 'income', fromId: 's-salary', toId: plan.accounts[0].id, amount: 5_000_000 });
    expect(cng.parentId).toBe(atm.id);
    expect(lunch).toMatchObject({ fromId: 'a-cash', toId: 'c-food', amount: 15_050, note: 'Lunch' });
    // Later rows in the sheet count as entered later.
    expect(atm.createdAt < cng.createdAt).toBe(true);
  });

  it('can map an unknown name to an existing account instead', () => {
    const { draft } = importSheet(sheet);
    const needs = neededNames(draft.rows, ACCOUNTS, CATEGORIES);
    const office = needs.find((n) => n.name === 'Office Bank')!;
    const plan = buildImport(draft.rows, needs, { [office.key]: { action: 'use', id: 'a-bank' } }, counter());
    expect(plan.accounts).toEqual([]);
    expect(plan.transactions[0].toId).toBe('a-bank');
  });

  it('names each broken row', () => {
    const broken = [
      'ID,Date,Type,From,To/Category,Amount,Note,Linked to',
      'T1,2026-11-01,Income,Salary,Main Bank,abc,,',
      'T2,31/02/2026,Expense,Cash,Food,100,,',
      'T3,2026-11-02,Refund,Cash,Food,100,,',
      'T4,2026-11-02,Transfer,Cash,cash,100,,',
      'T5,2026-11-02,Expense,Cash,Food,100,,T9',
      'T6,2026-11-02,Expense,Cash,Food,100,,T7',
      'T7,2026-11-02,Expense,Cash,Food,100,,',
      'T7,2026-11-02,Expense,Cash,Food,100,,',
      'T9,2099-01-01,Expense,Cash,Food,0,,',
      ',,,,Total,500,,',
    ].join('\n');
    const { draft } = importSheet(broken, { dateOrder: 'dmy' });
    expect(draft.problems).toEqual([
      { line: 2, message: 'amount "abc" isn\'t a number (at most 2 decimals)' },
      { line: 3, message: 'date "31/02/2026" isn\'t a date' },
      { line: 4, message: 'type "Refund" isn\'t Income, Expense or Transfer' },
      { line: 5, message: 'transfer to the same account' },
      { line: 6, message: 'linked to "T9", which isn\'t in the file (or has a problem)' },
      { line: 7, message: 'linked to an expense (row 8); link to income or a transfer' },
      { line: 9, message: 'ID "T7" is also used on row 8' },
      { line: 10, message: 'date 2099-01-01 is in the future' },
      { line: 10, message: 'amount is 0' },
    ]);
    expect(draft.skipped).toBe(1);
    expect(draft.rows.map((r) => r.line)).toEqual([8]);
  });
});

describe('a bank statement (debit / credit columns, title rows above the header)', () => {
  const statement = [
    'Account statement',
    'Period: Oct 2026',
    'Txn Date,Description,Debit,Credit,Balance',
    '25/10/2026,Card payment Groceries,"1,200.00",,48800',
    '26/10/2026,Salary October,,"60,000.00",108800',
    '27/10/2026,ATM withdrawal,"3,000.00",,105800',
    '28/10/2026,Fee,15,15,105785',
  ].join('\n');

  it('skips the title rows and reads debit as money out, credit as money in', () => {
    const { options, draft } = importSheet(statement, { defaultAccount: 'Main Bank' });
    expect(options.headerRow).toBe(2);
    expect(options.columns).toEqual({ date: 0, note: 1, moneyOut: 2, moneyIn: 3 });
    expect(options.dateOrder).toBe('dmy');
    expect(draft.problems).toEqual([{ line: 7, message: 'has both money in and money out' }]);
    expect(draft.rows.map((r) => [r.type, r.fromName, r.toName, r.amount])).toEqual([
      ['expense', 'Main Bank', 'Other', 120_000],
      ['income', 'Other Income', 'Main Bank', 6_000_000],
      ['expense', 'Main Bank', 'Other', 300_000],
    ]);
  });

  it('without an account to use, every row says so', () => {
    const { draft } = importSheet(statement);
    expect(draft.problems[0]).toEqual({ line: 4, message: 'no account it was paid from' });
  });
});

describe('a diary: date, category, account, one signed amount', () => {
  it('minus is money out, plain is money in, and a category that is an account makes a transfer', () => {
    const diary = [
      'Date;Category;Account;Amount;Details',
      '1 Nov 2026;Food;Cash;-250;Tea',
      '2 Nov 2026;Salary;Main Bank;80000;',
      '3 Nov 2026;Cash;Main Bank;-2000;ATM',
      '4 Nov 2026;Cash;Main Bank;500;Deposit back',
    ].join('\n');
    const { options, draft } = importSheet(diary);
    expect(options.columns).toEqual({ date: 0, category: 1, account: 2, amount: 3, note: 4 });
    expect(draft.problems).toEqual([]);
    expect(draft.rows.map((r) => [r.type, r.fromName, r.toName])).toEqual([
      ['expense', 'Cash', 'Food'],
      ['income', 'Salary', 'Main Bank'],
      ['transfer', 'Main Bank', 'Cash'],
      ['transfer', 'Cash', 'Main Bank'],
    ]);
  });

  it('only positive amounts and no type: the chosen default type', () => {
    const sheet = ['Date,Item,Cost', '01/11/2026,Rice,450', '02/11/2026,Bus,40'].join('\n');
    const { options, draft } = importSheet(sheet, { defaultAccount: 'Cash' });
    expect(options.columns).toEqual({ date: 0, note: 1, amount: 2 });
    expect(draft.rows.map((r) => [r.type, r.fromName, r.toName, r.note])).toEqual([
      ['expense', 'Cash', 'Other', 'Rice'],
      ['expense', 'Cash', 'Other', 'Bus'],
    ]);
  });
});

describe('a table pasted from Word or a spreadsheet (tab-separated)', () => {
  it('reads tabs and Bengali digits', () => {
    const pasted = 'তারিখ\tবিবরণ\tখাত\tটাকা\n০১/১১/২০২৬\tবাজার\tFood\t১,২০০\n';
    const { options, draft } = importSheet(pasted, { defaultAccount: 'Cash' });
    expect(options.columns).toEqual({ date: 0, note: 1, category: 2, amount: 3 });
    expect(draft.rows).toEqual([
      expect.objectContaining({ date: '2026-11-01', type: 'expense', fromName: 'Cash', toName: 'Food', amount: 120_000, note: 'বাজার' }),
    ]);
  });

  it('no header row: columns found from the values', () => {
    const { options, draft } = importSheet('2026-11-01,Lunch,300\n2026-11-02,Snacks,120', { defaultAccount: 'Cash' });
    expect(options.headerRow).toBeNull();
    expect(options.columns).toEqual({ date: 0, amount: 2 });
    expect(draft.rows).toHaveLength(2);
  });
});

describe('guessing the amount column', () => {
  it('a serial-number column (1, 2, 3…) is not the amount', () => {
    const { options, draft } = importSheet('1,05/03/2026,Food,500\n2,06/03/2026,Food,900\n3,07/03/2026,Food,300', {
      defaultAccount: 'Cash',
    });
    expect(options.columns.amount).toBe(3);
    expect(draft.rows.map((row) => row.amount)).toEqual([50_000, 90_000, 30_000]);
  });

  it('reads "Withdrawal Amt." / "Deposit Amt." as money out / in', () => {
    const sheet = ['Txn Date,Details,Withdrawal Amt.,Deposit Amt.,Balance', '05/03/2026,ATM,,500,1500', '06/03/2026,Shop,200,,1300'].join('\n');
    const { options, draft } = importSheet(sheet, { defaultAccount: 'Main Bank' });
    expect(options.columns).toEqual({ date: 0, note: 1, moneyOut: 2, moneyIn: 3 });
    expect(draft.rows.map((row) => row.type)).toEqual(['income', 'expense']);
  });

  it('never guesses a calculated balance column as the amount', () => {
    const { options } = importSheet('Date,Details,Balance,Figure\n05/03/2026,ATM,1500,500\n06/03/2026,Shop,1300,200');
    expect(options.columns.amount).toBe(3);
  });
});

describe('links two levels down', () => {
  it('a row linked to a left-out row is left out too, with its row named', () => {
    const sheet = [
      'ID,Date,Type,From,To/Category,Amount,Linked to',
      'T1,2026-11-03,Expense,Cash,Food,100,',
      'T2,2026-11-03,Transfer,Main Bank,Cash,5000,T1',
      'T3,2026-11-03,Expense,Cash,Food,220,T2',
    ].join('\n');
    const { draft } = importSheet(sheet);
    expect(draft.rows.map((row) => row.ref)).toEqual(['T1']);
    expect(draft.problems.map((p) => p.line)).toEqual([3, 4]);
    expect(draft.problems[1].message).toMatch(/linked to "T2"/);
  });
});

describe('files that are not tables', () => {
  it('explains what to do with Excel, Word and binary files', () => {
    expect(unreadableFileReason('money.xlsx', 'PK…')).toMatch(/Save it as CSV/);
    expect(unreadableFileReason('money.docx', 'PK…')).toMatch(/Word files/);
    expect(unreadableFileReason('download', 'PK\u0003\u0004')).toMatch(/isn't a text table/);
    expect(unreadableFileReason('money.csv', 'Date,Amount')).toBeNull();
  });
});

describe('duplicates', () => {
  it('leaves out entries already in the app and re-links to the recorded one', () => {
    const recorded: Transaction = {
      id: 'old-atm',
      date: '2026-11-03',
      type: 'transfer',
      fromId: 'a-bank',
      toId: 'a-cash',
      amount: 500_000,
      note: '',
      parentId: null,
      receivedFrom: null,
      createdAt: '',
      updatedAt: '',
    };
    const sheet = [
      'ID,Date,Type,From,To/Category,Amount,Linked to',
      'T1,2026-11-03,Transfer,Main Bank,Cash,5000,',
      'T2,2026-11-03,Expense,Cash,Food,220,T1',
    ].join('\n');
    const { draft } = importSheet(sheet);
    const needs = neededNames(draft.rows, ACCOUNTS, CATEGORIES);
    const plan = buildImport(draft.rows, needs, {}, counter());
    const duplicates = findDuplicates(plan.transactions, [recorded]);
    expect([...duplicates.keys()]).toEqual([0]);
    const kept = withoutDuplicates(plan, duplicates);
    expect(kept.transactions).toHaveLength(1);
    expect(kept.transactions[0].parentId).toBe('old-atm');
  });
});

describe('export', () => {
  it('plain taka numbers', () => {
    expect(plainTaka(125_050)).toBe('1250.5');
    expect(plainTaka(125_005)).toBe('1250.05');
    expect(plainTaka(50_000)).toBe('500');
  });

  it('an exported file imports back to the same entries', () => {
    const transactions: Transaction[] = [
      { id: 'x1', date: '2026-11-01', type: 'income', fromId: 's-salary', toId: 'a-bank', amount: 5_000_000, note: 'Nov, "full"', parentId: null, receivedFrom: 'Office', createdAt: '2026-11-01T09:00:00Z', updatedAt: '' },
      { id: 'x2', date: '2026-11-02', type: 'transfer', fromId: 'a-bank', toId: 'a-cash', amount: 500_000, note: '', parentId: null, receivedFrom: null, createdAt: '2026-11-02T09:00:00Z', updatedAt: '' },
      { id: 'x3', date: '2026-11-02', type: 'expense', fromId: 'a-cash', toId: 'c-food', amount: 15_050, note: 'Lunch', parentId: 'x2', receivedFrom: null, createdAt: '2026-11-02T10:00:00Z', updatedAt: '' },
    ];
    const csv = transactionsToCsv(ACCOUNTS, CATEGORIES, transactions);
    expect(csv.split('\r\n')[0]).toBe('ID,Date,Type,From,To/Category,Amount,Note,Received from,Linked to');

    const { draft } = importSheet(csv);
    expect(draft.problems).toEqual([]);
    const needs = neededNames(draft.rows, ACCOUNTS, CATEGORIES);
    expect(needs.every((n) => n.existingId)).toBe(true);
    const plan = buildImport(draft.rows, needs, {}, counter());
    const strip = (tx: Transaction) => [tx.date, tx.type, tx.fromId, tx.toId, tx.amount, tx.note, tx.receivedFrom];
    expect(plan.transactions.map(strip)).toEqual(transactions.map(strip));
    expect(plan.transactions[2].parentId).toBe(plan.transactions[1].id);
  });
});

it('export keeps text Excel would run as a formula as plain text, and imports it back unchanged', () => {
  expect(safeCell('=SUM(A1)')).toBe("'=SUM(A1)");
  expect(safeCell('Lunch')).toBe('Lunch');
  const tx: Transaction = { id: 'x1', date: '2026-11-01', type: 'expense', fromId: 'a-cash', toId: 'c-food', amount: 10_000, note: '=HYPERLINK("x")', parentId: null, receivedFrom: null, createdAt: '', updatedAt: '' };
  const csv = transactionsToCsv(ACCOUNTS, CATEGORIES, [tx]);
  expect(csv).toContain("'=HYPERLINK");
  expect(importSheet(csv).draft.rows[0].note).toBe('=HYPERLINK("x")');
});

it('guessAccountType and defaultChoice', () => {
  expect(guessAccountType('Cash in hand')).toBe('cash');
  expect(guessAccountType('My DPS')).toBe('savings');
  expect(guessAccountType('Mobile Wallet')).toBe('mobile_wallet');
  expect(guessAccountType('Office account')).toBe('bank');
  expect(defaultChoice({ key: 'k', role: 'account', name: 'Cash', count: 1, firstDate: '', existingId: 'a' })).toEqual({ action: 'use', id: 'a' });
});
