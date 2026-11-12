import { describe, expect, it } from '@jest/globals';

import { assignColumn, importQuestions, isConfident, notATableReason, sheetColumns } from './assess.spreadsheet';
import { guessColumns, guessHeaderRow } from './columns.spreadsheet';
import { type ImportOptions, readRows } from './rows.spreadsheet';
import { parseTable } from './table.spreadsheet';
import { guessDateOrder } from './values.spreadsheet';

const TODAY = '2026-11-10';

/** Reads a sheet with the guessed settings, like the import screen does. */
function assess(text: string, accountNames: string[] = ['Main Bank', 'Cash']) {
  const table = parseTable(text);
  const headerRow = guessHeaderRow(table);
  const columns = guessColumns(table, headerRow);
  const dates = guessDateOrder(columns.date === undefined ? [] : table.slice((headerRow ?? -1) + 1).map((row) => row[columns.date!] ?? ''));
  const options: ImportOptions = {
    headerRow,
    columns,
    dateOrder: dates.order,
    defaultType: 'expense',
    defaultAccount: null,
    today: TODAY,
  };
  const draft = readRows(table, options, accountNames);
  const questions = importQuestions(table, options, dates.ambiguous);
  return { table, options, draft, questions, confident: isConfident(draft, options, questions) };
}

const COINROOT_SHEET = [
  'ID,Date,Type,From,To/Category,Amount,Note,Linked to,Left from this (auto)',
  'T1,2026-11-01,Income,Salary,Office Bank,"50,000",November,,',
  'T2,2026-11-02,Transfer,Office Bank,Main Bank,40000,,,',
  'T3,2026-11-03,Transfer,Main Bank,Cash,"5,000",ATM,,4780',
  'T4,2026-11-03,Expense,Cash,Transport,220,CNG,T3,',
].join('\n');

describe('notATableReason', () => {
  it('stops a sheet of instructions', () => {
    const notes = [
      'How to use this tracker',
      '',
      '"1. One row per transaction. New ID each time (T1, T2, …), never reuse one."',
      '2. Type: Income = money comes in. Expense = money is spent. Transfer = money moves between your own accounts.',
      'Common entries',
      '• Salary / bonus:            Income    | Salary or Bonus     → Office Bank',
      '"• Dates as 2026-11-02; Amount as plain numbers (350, not 350 tk)."',
      '• For the app later: File → Download → Comma-separated values (.csv).',
    ].join('\n');
    expect(notATableReason(parseTable(notes))).toMatch(/notes, not a list of transactions/);
  });

  it('lets lists of entries through, with or without title rows', () => {
    expect(notATableReason(parseTable(COINROOT_SHEET))).toBeNull();
    const statement = ['Statement of account', 'Period: Nov 2026', '', 'Txn Date,Description,Debit,Credit', '01/11/2026,ATM,500,'].join('\n');
    expect(notATableReason(parseTable(statement))).toBeNull();
  });

  it('stops a list of names without dates or amounts', () => {
    expect(notATableReason(parseTable('Categories\nFood\nTransport\nRent'))).not.toBeNull();
  });
});

describe('confidence and questions', () => {
  it("is confident about Coinroot's own sheet and asks nothing", () => {
    const { confident, questions } = assess(COINROOT_SHEET);
    expect(questions).toEqual({ headerRow: false, dateOrder: false, account: false, type: false });
    expect(confident).toBe(true);
  });

  it('asks for the day / month order only when dates are ambiguous', () => {
    const sheet = 'Date,Account,Category,Amount\n05/03/2026,Cash,Food,-120\n06/03/2026,Cash,Salary,500';
    const { questions, confident } = assess(sheet);
    expect(questions.dateOrder).toBe(true);
    expect(questions.type).toBe(false); // the minus sign says which way
    expect(confident).toBe(false);

    expect(assess(sheet.replace('06/03', '16/03')).questions.dateOrder).toBe(false);
  });

  it('asks for an account and the title row on a bank statement', () => {
    const statement = ['Statement of account', '', 'Txn Date,Description,Debit,Credit', '21/11/2025,ATM,500,', '22/11/2025,Salary,,900'].join('\n');
    const { questions, confident } = assess(statement);
    expect(questions).toEqual({ headerRow: true, dateOrder: false, account: true, type: false });
    expect(confident).toBe(false);
  });

  it('asks the type when nothing in the sheet says it', () => {
    const { questions, confident } = assess('Date,Account,Category,Amount\n2026-11-01,Cash,Food,120\n2026-11-02,Cash,Food,80');
    expect(questions.type).toBe(true);
    expect(confident).toBe(false);
  });

  it('is not confident when many rows have problems, or without column names', () => {
    const broken = COINROOT_SHEET.replace('2026-11-02', 'soon').replace('2026-11-03', 'later');
    expect(assess(broken).confident).toBe(false);
    expect(assess(COINROOT_SHEET.split('\n').slice(1).join('\n')).confident).toBe(false);
  });
});

describe('sheetColumns and assignColumn', () => {
  it('lists each column with examples and what it is read as', () => {
    const { table, options } = assess(COINROOT_SHEET);
    const columns = sheetColumns(table, options.headerRow, options.columns);
    expect(columns.map((c) => [c.name, c.field, c.computed])).toEqual([
      ['ID', 'id', false],
      ['Date', 'date', false],
      ['Type', 'type', false],
      ['From', 'from', false],
      ['To/Category', 'to', false],
      ['Amount', 'amount', false],
      ['Note', 'note', false],
      ['Linked to', 'linkedTo', false],
      ['Left from this (auto)', null, true],
    ]);
    expect(columns[2].samples).toEqual(['Income', 'Transfer', 'Expense']);
  });

  it('names columns without a header by letter and skips empty ones', () => {
    const columns = sheetColumns(parseTable('2026-11-01,,120\n2026-11-02,,80'), null, {});
    expect(columns.map((c) => c.name)).toEqual(['Column A', 'Column C']);
  });

  it('keeps one field per column and one column per field', () => {
    expect(assignColumn({ date: 0, note: 2 }, 2, 'amount')).toEqual({ date: 0, amount: 2 });
    expect(assignColumn({ date: 0, amount: 1 }, 3, 'amount')).toEqual({ date: 0, amount: 3 });
    expect(assignColumn({ date: 0, amount: 1 }, 1, null)).toEqual({ date: 0 });
  });
});
