/**
 * Reading single cells from someone else's spreadsheet: amounts written many ways
 * ("1,20,000", "৳500", "Tk 50.5", "(200)", "-75", Bengali digits), dates in any common
 * order or with month names (and Excel's day numbers), and transaction types in plain words.
 */
import type { TransactionType } from '@/lib/types';
import { isDateKey, parseTaka } from '@/lib/utils';

const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';

/** "১২৩" → "123"; other characters stay. */
export function toAsciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)));
}

export type ParsedAmount = {
  /** Poisha, always positive. */
  poisha: number;
  /** Written as negative: "-500", "500-", "(500)". */
  negative: boolean;
};

/** A cell's amount, `null` when it isn't one (or has more than two decimals), `'empty'` when blank. */
export function parseAmountCell(cell: string): ParsedAmount | null | 'empty' {
  let text = toAsciiDigits(cell).trim();
  if (text === '' || text === '-') return 'empty';
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/৳|bdt|taka|tk\.?/gi, '').trim();
  if (text.startsWith('-') || text.startsWith('−')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }
  const poisha = parseTaka(text.trim());
  return poisha === null ? null : { poisha, negative };
}

/** How day / month / year are ordered in numeric dates like 05/03/2024. */
export type DateOrder = 'dmy' | 'mdy' | 'ymd';

export const DATE_ORDER_LABELS: Record<DateOrder, string> = {
  dmy: 'Day / month / year',
  mdy: 'Month / day / year',
  ymd: 'Year / month / day',
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n: number) => String(n).padStart(2, '0');

function toKey(year: number, month: number, day: number): string | null {
  const full = year < 100 ? 2000 + year : year;
  const key = `${full}-${pad(month)}-${pad(day)}`;
  if (!isDateKey(key)) return null;
  // isDateKey checks the shape; this rejects 31 Feb and the like.
  const date = new Date(Date.UTC(full, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? key : null;
}

/** Excel stores dates as days since 30 Dec 1899; a CSV sometimes keeps the bare number. */
function fromExcelSerial(serial: number): string | null {
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  return toKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** The date part, without a time ("2024-03-05 10:30", "2024-03-05T10:30:00Z", "5/3/2024 9:15 AM"). */
function withoutTime(text: string): string {
  return text
    .replace(/T\d{1,2}:\d{2}.*$/i, '')
    .replace(/[\s,]+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?m\.?)?$/i, '')
    .trim();
}

/**
 * A cell's date as `YYYY-MM-DD`, or `null`. Numeric dates use `order` unless they start with
 * a four-digit year; dates with a month name ("5 Nov 2026", "Nov 5, 2026", "05-Nov-26") work in
 * any order; whole numbers between 20000 and 80000 are Excel day numbers.
 */
export function parseDateCell(cell: string, order: DateOrder): string | null {
  const text = withoutTime(toAsciiDigits(cell).trim());
  if (text === '') return null;

  if (/^\d{5}$/.test(text)) {
    const serial = Number(text);
    return serial >= 20_000 && serial <= 80_000 ? fromExcelSerial(serial) : null;
  }

  const monthToken = /[a-z]{3,}/i.exec(text);
  if (monthToken) {
    const month = MONTHS.indexOf(monthToken[0].slice(0, 3).toLowerCase()) + 1;
    if (month === 0) return null;
    const numbers = (text.match(/\d+/g) ?? []).map(Number);
    if (numbers.length !== 2) return null;
    const yearIndex = numbers.findIndex((n) => n > 31);
    const year = yearIndex >= 0 ? numbers[yearIndex] : numbers[1];
    const day = yearIndex >= 0 ? numbers[1 - yearIndex] : numbers[0];
    return toKey(year, month, day);
  }

  const parts = text.split(/[-/.\s]+/);
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
  const [a, b, c] = parts.map(Number);
  if (parts[0].length === 4) return toKey(a, b, c);
  // "26/03/05" when the user said dates are year first.
  if (order === 'ymd') return parts[0].length === 2 ? toKey(a, b, c) : null;
  if (parts[2].length !== 4 && parts[2].length !== 2) return null;
  return order === 'mdy' ? toKey(c, a, b) : toKey(c, b, a);
}

export type DateOrderGuess = {
  order: DateOrder;
  /** Every numeric date would read the same as day-first or month-first (e.g. 05/03/2024). */
  ambiguous: boolean;
};

/**
 * Looks at all the dates in a column: a first number over 12 means day first, a second number
 * over 12 means month first. With no clue, day first (how dates are written in Bangladesh).
 */
export function guessDateOrder(cells: readonly string[]): DateOrderGuess {
  let dayFirst = false;
  let monthFirst = false;
  let numeric = false;
  let yearFirst = 0;
  let total = 0;
  for (const cell of cells) {
    const text = withoutTime(toAsciiDigits(cell).trim());
    const parts = text.split(/[-/.\s]+/);
    if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) continue;
    total += 1;
    if (parts[0].length === 4) {
      yearFirst += 1;
      continue;
    }
    numeric = true;
    if (Number(parts[0]) > 12) dayFirst = true;
    if (Number(parts[1]) > 12) monthFirst = true;
  }
  if (total > 0 && yearFirst === total) return { order: 'ymd', ambiguous: false };
  if (monthFirst && !dayFirst) return { order: 'mdy', ambiguous: false };
  return { order: 'dmy', ambiguous: numeric && !dayFirst };
}

const TYPE_WORDS: Record<TransactionType, readonly string[]> = {
  expense: ['expense', 'expenses', 'exp', 'spent', 'spend', 'spending', 'paid', 'payment', 'debit', 'dr', 'out', 'cost', 'withdrawal', 'withdraw', 'খরচ', 'ব্যয়'],
  income: ['income', 'inc', 'received', 'receive', 'receipt', 'credit', 'cr', 'in', 'earning', 'earnings', 'deposit', 'আয়'],
  transfer: ['transfer', 'transfers', 'trf', 'tfr', 'move', 'moved', 'transferred', 'স্থানান্তর'],
};

/** "Expense", "dr", "Paid", "Transfer"… → the type, or `null` when the word isn't one of them. */
export function parseTypeCell(cell: string): TransactionType | null {
  const word = cell.trim().toLowerCase().replace(/[.\s]+$/, '');
  for (const type of Object.keys(TYPE_WORDS) as TransactionType[]) {
    if (TYPE_WORDS[type].includes(word)) return type;
  }
  return null;
}
