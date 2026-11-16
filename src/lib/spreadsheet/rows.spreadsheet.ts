/**
 * Step 1 of an import: each sheet row becomes a transaction with names (not ids yet), or a
 * problem naming its row ("Row 14: date "31/02/2024" isn't a date"). Works for any layout the
 * columns describe: Coinroot's (Type, From, To/Category), account + category, one signed amount,
 * or separate money in / money out columns.
 */
import type { TransactionType } from '@/lib/types';

import type { ColumnMap, ImportField } from './columns.spreadsheet';
import { isEmptyRow, type Table } from './table.spreadsheet';
import { type DateOrder, parseAmountCell, parseDateCell, parseTypeCell, type ParsedAmount } from './values.spreadsheet';

/** Category names used when a row has none (the default categories have these). */
export const FALLBACK_EXPENSE_CATEGORY = 'Other';
export const FALLBACK_INCOME_SOURCE = 'Other Income';

export type ImportOptions = {
  /** Index of the row with column names; data starts below it. `null`: no header row. */
  headerRow: number | null;
  columns: ColumnMap;
  dateOrder: DateOrder;
  /** Type of rows with nothing that says otherwise (no type column, sign or in / out column). */
  defaultType: 'expense' | 'income';
  /** Account name for rows that don't name one. */
  defaultAccount: string | null;
  /** Today (`YYYY-MM-DD`); later dates are a problem, like in the form. */
  today: string;
};

export type DraftRow = {
  /** The sheet's row number (1 = first row). */
  line: number;
  date: string;
  type: TransactionType;
  fromName: string;
  toName: string;
  /** Poisha, positive. */
  amount: number;
  note: string;
  party: string | null;
  /** The row's own ID (e.g. "T12") and the ID it's linked to, for "Linked to". */
  ref: string | null;
  linkedRef: string | null;
};

export type RowProblem = { line: number; message: string };

export type Draft = {
  rows: DraftRow[];
  problems: RowProblem[];
  /** "Total" rows left out. */
  skipped: number;
};

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const key = (name: string) => name.trim().toLowerCase();
const TOTAL_ROW = /^(grand\s*)?(sub\s*)?totals?:?$|^sum:?$|^মোট:?$/i;

/** With one amount column, a minus anywhere means the plain amounts are money in. */
export function amountsAreSigned(table: Table, { headerRow, columns }: Pick<ImportOptions, 'headerRow' | 'columns'>): boolean {
  const index = columns.amount;
  if (index === undefined) return false;
  return table.slice(headerRow === null ? 0 : headerRow + 1).some((row) => {
    const amount = parseAmountCell((row[index] ?? '').trim());
    return amount !== null && amount !== 'empty' && amount.negative;
  });
}

/** The sheet's data rows read as transactions. `accountNames`: the user's accounts, to spot transfers. */
export function readRows(table: Table, options: ImportOptions, accountNames: readonly string[]): Draft {
  const { columns, dateOrder, defaultType, defaultAccount, today } = options;
  const start = options.headerRow === null ? 0 : options.headerRow + 1;
  const cell = (row: readonly string[], field: ImportField) => {
    const index = columns[field];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };
  const data = table
    .slice(start)
    .map((row, i) => ({ row, line: start + i + 1 }))
    .filter(({ row }) => !isEmptyRow(row));

  const signed = amountsAreSigned(table, options);
  // Names that are accounts: the user's, plus everything in the sheet's account column.
  const accounts = new Set(
    [...accountNames, ...data.map(({ row }) => cell(row, 'account')), defaultAccount ?? ''].map(key).filter(Boolean)
  );
  const isAccount = (name: string) => name !== '' && accounts.has(key(name));
  const coinrootLayout = columns.from !== undefined || columns.to !== undefined;

  const rows: DraftRow[] = [];
  const problems: RowProblem[] = [];
  let skipped = 0;

  for (const { row, line } of data) {
    const issues: string[] = [];

    const dateText = cell(row, 'date');
    if (!dateText) {
      if (row.some((value) => TOTAL_ROW.test(value))) {
        skipped += 1;
        continue;
      }
      problems.push({ line, message: 'no date' });
      continue;
    }
    const date = parseDateCell(dateText, dateOrder);
    if (!date) issues.push(`date "${dateText}" isn't a date`);
    else if (date > today) issues.push(`date ${date} is in the future`);

    // Amount, and which way the money went when the sheet says so.
    let amount = 0;
    let direction: 'in' | 'out' | null = null;
    const describe = (text: string, parsed: ParsedAmount | null | 'empty') =>
      parsed === null ? `amount "${text}" isn't a number (at most 2 decimals)` : null;
    if (columns.amount !== undefined) {
      const text = cell(row, 'amount');
      const parsed = parseAmountCell(text);
      if (parsed === 'empty') issues.push('no amount');
      else if (parsed === null) issues.push(describe(text, parsed)!);
      else {
        amount = parsed.poisha;
        direction = parsed.negative ? 'out' : signed ? 'in' : null;
      }
    } else {
      const outText = cell(row, 'moneyOut');
      const inText = cell(row, 'moneyIn');
      const out = parseAmountCell(outText);
      const into = parseAmountCell(inText);
      const bad = [describe(outText, out), describe(inText, into)].filter(Boolean) as string[];
      const outAmount = out && out !== 'empty' ? out.poisha : 0;
      const inAmount = into && into !== 'empty' ? into.poisha : 0;
      if (bad.length > 0) issues.push(...bad);
      else if (outAmount > 0 && inAmount > 0) issues.push('has both money in and money out');
      else if (outAmount > 0) [amount, direction] = [outAmount, 'out'];
      else if (inAmount > 0) [amount, direction] = [inAmount, 'in'];
      else issues.push('no amount');
    }
    if (amount === 0 && !issues.some((issue) => /amount|money/.test(issue))) issues.push('amount is 0');

    let type: TransactionType | null = null;
    const typeText = cell(row, 'type');
    if (typeText) {
      type = parseTypeCell(typeText);
      if (!type) issues.push(`type "${typeText}" isn't Income, Expense or Transfer`);
    }

    const account = cell(row, 'account') || defaultAccount || '';
    const category = cell(row, 'category');
    const fromCell = cell(row, 'from');
    const toCell = cell(row, 'to');
    if (!type && !typeText) {
      if (coinrootLayout) {
        const fromAccount = isAccount(fromCell);
        const toAccount = isAccount(toCell);
        if (direction === 'in') type = fromAccount ? 'transfer' : 'income';
        else if (direction === 'out') type = toAccount ? 'transfer' : 'expense';
        else if (fromAccount && toAccount) type = 'transfer';
        else if (toAccount) type = 'income';
        else if (fromAccount) type = 'expense';
        else type = defaultType;
      } else if (isAccount(category) && !sameName(category, account)) {
        // e.g. an ATM withdrawal filed under "Cash": money moved, not spent.
        type = 'transfer';
      } else {
        type = direction === 'in' ? 'income' : direction === 'out' ? 'expense' : defaultType;
      }
    }

    let fromName = '';
    let toName = '';
    if (type) {
      if (coinrootLayout) {
        fromName = fromCell || (type === 'income' ? category || FALLBACK_INCOME_SOURCE : account);
        toName = toCell || (type === 'expense' ? category || FALLBACK_EXPENSE_CATEGORY : account);
      } else if (type === 'expense') {
        [fromName, toName] = [account, category || FALLBACK_EXPENSE_CATEGORY];
      } else if (type === 'income') {
        [fromName, toName] = [category || FALLBACK_INCOME_SOURCE, account];
      } else {
        [fromName, toName] = direction === 'in' ? [category, account] : [account, category];
      }

      if (type === 'expense' && !fromName) issues.push('no account it was paid from');
      if (type === 'income' && !toName) issues.push('no account it was received in');
      if (type === 'transfer') {
        if (!fromName || !toName) issues.push('a transfer needs two accounts');
        else if (sameName(fromName, toName)) issues.push('transfer to the same account');
      }
    }

    let note = cell(row, 'note');
    let party: string | null = cell(row, 'party') || null;
    if (party && type !== 'income') {
      // "Received from" only applies to income; keep the name in the note instead of losing it.
      note = [note, party].filter(Boolean).join(' · ');
      party = null;
    }

    if (issues.length > 0 || !type || !date) {
      issues.forEach((message) => problems.push({ line, message }));
      continue;
    }
    rows.push({
      line,
      date,
      type,
      fromName,
      toName,
      amount,
      note,
      party,
      ref: cell(row, 'id') || null,
      linkedRef: cell(row, 'linkedTo') || null,
    });
  }

  problems.push(...linkProblems(rows));
  const badLines = new Set(problems.map((p) => p.line));
  problems.sort((a, b) => a.line - b.line);
  return { rows: rows.filter((row) => !badLines.has(row.line)), problems, skipped };
}

/**
 * IDs used twice, links to IDs that aren't in the sheet, and links to expenses. A row linked to a
 * row that is left out is left out too (and so on down the tree), so no link is dropped silently.
 */
function linkProblems(rows: readonly DraftRow[]): RowProblem[] {
  const problems: RowProblem[] = [];
  const byRef = new Map<string, DraftRow>();
  for (const row of rows) {
    if (!row.ref) continue;
    const seen = byRef.get(key(row.ref));
    if (seen) problems.push({ line: row.line, message: `ID "${row.ref}" is also used on row ${seen.line}` });
    else byRef.set(key(row.ref), row);
  }
  const bad = new Set(problems.map((p) => p.line));
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (!row.linkedRef || bad.has(row.line)) continue;
      const parent = byRef.get(key(row.linkedRef));
      let message: string | null = null;
      if (!parent || bad.has(parent.line)) message = `linked to "${row.linkedRef}", which isn't in the file (or has a problem)`;
      else if (parent === row) message = 'linked to itself';
      else if (parent.type === 'expense') message = `linked to an expense (row ${parent.line}); link to income or a transfer`;
      if (message) {
        problems.push({ line: row.line, message });
        bad.add(row.line);
        changed = true;
      }
    }
  }
  return problems;
}
