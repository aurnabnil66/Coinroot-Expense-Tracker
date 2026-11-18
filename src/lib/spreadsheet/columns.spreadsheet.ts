/**
 * Which column holds what. A sheet can be laid out like Coinroot (Type, From, To/Category),
 * like a diary (Date, Category, Amount), or like a bank statement (Date, Description,
 * Debit, Credit); the columns are guessed from their names and the user can change them.
 */
import type { Table } from './table.spreadsheet';
import { parseAmountCell, parseDateCell } from './values.spreadsheet';

export const IMPORT_FIELDS = [
  'date',
  'amount',
  'moneyOut',
  'moneyIn',
  'type',
  'account',
  'category',
  'from',
  'to',
  'note',
  'receivedFrom',
  'id',
  'linkedTo',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Column index for each field the sheet has. */
export type ColumnMap = Partial<Record<ImportField, number>>;

export const IMPORT_FIELD_INFO: Record<ImportField, { label: string; hint: string }> = {
  date: { label: 'Date', hint: 'Required' },
  amount: { label: 'Amount', hint: 'One amount column; minus means money out' },
  moneyOut: { label: 'Money out', hint: 'Spent / debit / withdrawal column' },
  moneyIn: { label: 'Money in', hint: 'Received / credit / deposit column' },
  type: { label: 'Type', hint: 'Income / Expense / Transfer' },
  account: { label: 'Account', hint: 'Cash, bank, wallet… the money came from or went to' },
  category: { label: 'Category', hint: 'What it was for, or where income came from' },
  from: { label: 'From', hint: 'Coinroot layout: account, or income source' },
  to: { label: 'To / Category', hint: 'Coinroot layout: category, or account' },
  note: { label: 'Note', hint: 'Description, details, shop' },
  receivedFrom: { label: 'Received from', hint: 'Who paid (income)' },
  id: { label: 'Row ID', hint: 'Only needed for "Linked to"' },
  linkedTo: { label: 'Linked to', hint: 'ID of the row this money came from' },
};

/** Column names people use for each field, compared without case, spaces or punctuation. */
const HEADER_WORDS: Record<ImportField, readonly string[]> = {
  date: ['date', 'day', 'transactiondate', 'txndate', 'postingdate', 'valuedate', 'trandate', 'তারিখ'],
  amount: ['amount', 'amt', 'amounttk', 'amountbdt', 'amounttaka', 'taka', 'tk', 'bdt', 'value', 'cost', 'price', 'টাকা', 'পরিমাণ'],
  moneyOut: ['moneyout', 'out', 'debit', 'dr', 'withdrawal', 'withdrawals', 'withdraw', 'spent', 'paid', 'expense', 'expenses', 'outflow', 'payment', 'payments', 'খরচ'],
  moneyIn: ['moneyin', 'in', 'credit', 'cr', 'deposit', 'deposits', 'received', 'receipt', 'receipts', 'income', 'inflow', 'আয়'],
  type: ['type', 'kind', 'transactiontype', 'txntype', 'inout', 'incomeexpense', 'ধরন'],
  account: ['account', 'accounts', 'wallet', 'bank', 'paidwith', 'paidfrom', 'method', 'paymentmethod', 'mode', 'paymentmode', 'অ্যাকাউন্ট'],
  category: ['category', 'categories', 'head', 'expensehead', 'purpose', 'cat', 'group', 'খাত'],
  from: ['from'],
  to: ['to', 'tocategory', 'categoryto'],
  note: ['note', 'notes', 'description', 'desc', 'details', 'detail', 'memo', 'remarks', 'remark', 'narration', 'particulars', 'comment', 'comments', 'item', 'items', 'reason', 'বিবরণ'],
  receivedFrom: ['receivedfrom', 'party', 'client', 'payer', 'customer', 'fromwhom'],
  id: ['id', 'no', 'sl', 'slno', 'serial', 'ref', 'reference', 'refno'],
  linkedTo: ['linkedto', 'linked', 'parent', 'parentid'],
};

/** Columns that are computed in the sheet and must not be imported (e.g. a running balance). */
const IGNORED_WORDS = ['leftfromthisauto', 'leftfromthis', 'balance', 'runningbalance', 'closingbalance', 'total'];

const normalise = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');

/** A column the sheet calculates (e.g. "Left from this (auto)", "Balance"), never imported. */
export const isComputedColumn = (name: string) => IGNORED_WORDS.includes(normalise(name));

/** "Withdrawal Amt." → "withdrawal", "Debit Amount (Tk)" → "debit": the name without an amount / currency ending. */
const AMOUNT_ENDING = /(amount|amt|taka|tk|bdt)+$/;

function fieldForWord(word: string): ImportField | 'ignore' | null {
  if (IGNORED_WORDS.includes(word)) return 'ignore';
  for (const field of IMPORT_FIELDS) {
    if (HEADER_WORDS[field].includes(word)) return field;
  }
  return null;
}

function fieldForHeader(cell: string): ImportField | 'ignore' | null {
  const word = normalise(cell);
  if (!word) return null;
  const exact = fieldForWord(word);
  if (exact) return exact;
  const short = word.replace(AMOUNT_ENDING, '');
  return short && short !== word ? fieldForWord(short) : null;
}

/** 1, 2, 3… (or counting down): a serial-number column, never the amount. */
function isCounting(cells: readonly string[]): boolean {
  if (cells.length < 2 || !cells.every((cell) => /^\d+$/.test(cell))) return false;
  const numbers = cells.map(Number);
  const step = numbers[1] - numbers[0];
  return Math.abs(step) === 1 && numbers.every((n, i) => i === 0 || n - numbers[i - 1] === step);
}

/**
 * The row that holds column names: among the first rows, the one with the most known names
 * (title rows above it are skipped). `null` when the sheet has no header row.
 */
export function guessHeaderRow(table: Table): number | null {
  let best = -1;
  let bestScore = 1;
  for (let index = 0; index < Math.min(table.length, 10); index++) {
    const score = table[index].filter((cell) => fieldForHeader(cell) !== null).length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  if (best >= 0) return best;
  // Unknown names: still a header when the first row has no dates or amounts at all.
  const first = table[0] ?? [];
  const looksLikeData = first.some((cell) => {
    const amount = parseAmountCell(cell);
    return parseDateCell(cell, 'dmy') !== null || (amount !== null && amount !== 'empty');
  });
  return first.filter(Boolean).length >= 2 && !looksLikeData ? 0 : null;
}

/** Fields guessed from the header names, then from the values for date and amount. */
export function guessColumns(table: Table, headerRow: number | null): ColumnMap {
  const columns: ColumnMap = {};
  const header = headerRow === null ? [] : table[headerRow];
  // Calculated columns (a running balance) are never guessed as the amount either.
  const ignored: number[] = [];
  header.forEach((cell, index) => {
    const field = fieldForHeader(cell);
    if (field === 'ignore') ignored.push(index);
    else if (field && columns[field] === undefined) columns[field] = index;
  });

  // A sheet with both "From" and a separate "Account" is unusual; prefer the Coinroot layout.
  if (columns.from !== undefined || columns.to !== undefined) {
    if (columns.to === undefined && columns.category !== undefined) {
      columns.to = columns.category;
      delete columns.category;
    }
  }

  // Without names (or unknown ones), look at the values.
  const data = table.slice(headerRow === null ? 0 : headerRow + 1, (headerRow ?? -1) + 31);
  const width = table[0]?.length ?? 0;
  const used = new Set([...Object.values(columns), ...ignored]);
  const filledCells = (index: number) => data.map((row) => row[index] ?? '').filter(Boolean);
  const share = (index: number, test: (cell: string) => boolean) => {
    const filled = filledCells(index);
    return filled.length === 0 ? 0 : filled.filter(test).length / filled.length;
  };
  if (columns.date === undefined) {
    for (let i = 0; i < width; i++) {
      if (!used.has(i) && share(i, (cell) => parseDateCell(cell, 'dmy') !== null || parseDateCell(cell, 'mdy') !== null) > 0.8) {
        columns.date = i;
        used.add(i);
        break;
      }
    }
  }
  if (columns.amount === undefined && columns.moneyIn === undefined && columns.moneyOut === undefined) {
    for (let i = 0; i < width; i++) {
      if (used.has(i) || isCounting(filledCells(i))) continue;
      const isAmount = (cell: string) => {
        const parsed = parseAmountCell(cell);
        return parsed !== null && parsed !== 'empty';
      };
      if (share(i, isAmount) > 0.8) {
        columns.amount = i;
        break;
      }
    }
  }
  return columns;
}

/** What the column list shows: "A · Date" or "Column A". */
export function columnLabel(table: Table, headerRow: number | null, index: number, letter: string): string {
  const name = headerRow === null ? '' : (table[headerRow]?.[index] ?? '');
  return name ? `${letter} · ${name}` : `Column ${letter}`;
}
