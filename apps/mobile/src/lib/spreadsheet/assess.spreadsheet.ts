/**
 * Decides how much the import has to ask. A file that isn't a list of entries is stopped early;
 * a sheet whose columns were read with confidence goes straight to a summary; otherwise only the
 * questions that matter for this sheet are shown.
 */
import { isComputedColumn, type ColumnMap, type ImportField } from './columns.spreadsheet';
import { amountsAreSigned, type Draft, type ImportOptions } from './rows.spreadsheet';
import { columnLetter, isEmptyRow, type Table } from './table.spreadsheet';
import { parseAmountCell, parseDateCell } from './values.spreadsheet';

const isDate = (cell: string) =>
  parseDateCell(cell, 'dmy') !== null || parseDateCell(cell, 'mdy') !== null;
const isAmount = (cell: string) => {
  const parsed = parseAmountCell(cell);
  return parsed !== null && parsed !== 'empty';
};

/** A row with a date in one cell and an amount in another. */
function looksLikeEntry(row: readonly string[]): boolean {
  const dateAt = row.findIndex(isDate);
  return dateAt >= 0 && row.some((cell, i) => i !== dateAt && isAmount(cell));
}

/**
 * Why the table isn't a list of transactions (e.g. a sheet of instructions or notes), or `null`
 * when it is one: at least one row needs a date and an amount. Kept lenient on purpose: stopping a
 * real sheet is worse than showing the column step for an odd one.
 */
export function notATableReason(table: Table): string | null {
  if (table.some((row) => !isEmptyRow(row) && looksLikeEntry(row))) return null;
  return (
    "This looks like notes, not a list of transactions: no rows have a date and an amount. " +
    'If it came from Google Sheets or Excel, open the sheet (tab) with your entries and download that one as CSV.'
  );
}

export type ImportQuestions = {
  /** Which row holds the column names: only when there are title rows above them, or no names. */
  headerRow: boolean;
  /** Day / month order: only when dates like 05/03 could be read both ways. */
  dateOrder: boolean;
  /** An account for rows without one: only when the sheet has no account (or From / To) column. */
  account: boolean;
  /** Expense or income for rows that don't say: only with no type column, in / out columns or minus signs. */
  type: boolean;
};

/** The questions this sheet needs answered, beyond which column is what. */
export function importQuestions(table: Table, options: ImportOptions, ambiguousDates: boolean): ImportQuestions {
  const { columns, headerRow } = options;
  const coinrootLayout = columns.from !== undefined || columns.to !== undefined;
  const inOut = columns.moneyIn !== undefined || columns.moneyOut !== undefined;
  return {
    headerRow: headerRow !== 0,
    dateOrder: columns.date !== undefined && ambiguousDates,
    account: columns.account === undefined && !coinrootLayout,
    type: columns.type === undefined && !inOut && !amountsAreSigned(table, options),
  };
}

/** The rows a draft covers: ready ones plus the ones with problems. */
export const draftRowCount = (draft: Draft) => draft.rows.length + new Set(draft.problems.map((p) => p.line)).size;

/**
 * Whether the guessed columns can be shown as a summary instead of asking: the sheet has column
 * names, a date and an amount, no extra question to answer, and at most 1 in 10 rows has a problem.
 */
export function isConfident(draft: Draft, options: ImportOptions, questions: ImportQuestions): boolean {
  const { columns } = options;
  const hasAmount = columns.amount !== undefined || columns.moneyIn !== undefined || columns.moneyOut !== undefined;
  if (options.headerRow === null || columns.date === undefined || !hasAmount) return false;
  if (questions.dateOrder || questions.account || questions.type) return false;
  if (draft.rows.length === 0) return false;
  const problemRows = draftRowCount(draft) - draft.rows.length;
  return problemRows <= draftRowCount(draft) / 10;
}

export type SheetColumn = {
  index: number;
  /** The column's name in the sheet, or "Column C" without one. */
  name: string;
  /** Up to 3 different example values. */
  samples: string[];
  /** The field it's read as, if any. */
  field: ImportField | null;
  /** Calculated in the sheet (e.g. a running balance), so not imported. */
  computed: boolean;
};

/** The sheet's columns (empty ones left out), each with examples and what it's read as. */
export function sheetColumns(table: Table, headerRow: number | null, columns: ColumnMap): SheetColumn[] {
  const width = Math.max(0, ...table.map((row) => row.length));
  const data = table.slice(headerRow === null ? 0 : headerRow + 1);
  const fieldAt = new Map<number, ImportField>();
  (Object.keys(columns) as ImportField[]).forEach((field) => fieldAt.set(columns[field]!, field));

  const result: SheetColumn[] = [];
  for (let index = 0; index < width; index++) {
    const header = headerRow === null ? '' : (table[headerRow]?.[index] ?? '').trim();
    const samples: string[] = [];
    for (const row of data) {
      const value = (row[index] ?? '').trim();
      if (value && !samples.includes(value)) samples.push(value);
      if (samples.length === 3) break;
    }
    if (!header && samples.length === 0) continue;
    result.push({
      index,
      name: header || `Column ${columnLetter(index)}`,
      samples,
      field: fieldAt.get(index) ?? null,
      computed: header !== '' && isComputedColumn(header),
    });
  }
  return result;
}

/** Reads `index` as `field` (or nothing): one field per column, one column per field. */
export function assignColumn(columns: ColumnMap, index: number, field: ImportField | null): ColumnMap {
  const next: ColumnMap = { ...columns };
  (Object.keys(next) as ImportField[]).forEach((other) => {
    if (next[other] === index) delete next[other];
  });
  if (field) next[field] = index;
  return next;
}
