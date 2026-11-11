/**
 * Transactions as a spreadsheet (CSV) in the same columns the import reads, so a file can be
 * opened in Excel / Google Sheets and imported again. Amounts are plain taka numbers
 * ("1250.5"), which spreadsheets read as numbers.
 */
import { TRANSACTION_TYPE_LABELS } from '@/lib/constants';
import type { Account, Category, Transaction } from '@/lib/types';
import { compareNewestFirst, nameLookup, POISHA_PER_TAKA } from '@/lib/utils';

import { toCsv } from './table.spreadsheet';

export const EXPORT_COLUMNS = ['ID', 'Date', 'Type', 'From', 'To/Category', 'Amount', 'Note', 'Received from', 'Linked to'];

/** Poisha as a plain number: 125050 → "1250.5", 50000 → "500". */
export function plainTaka(poisha: number): string {
  const whole = Math.floor(poisha / POISHA_PER_TAKA);
  const fraction = poisha % POISHA_PER_TAKA;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}

/** The CSV text: a header row, then every transaction oldest first with IDs T1, T2, … */
export function transactionsToCsv(
  accounts: readonly Account[],
  categories: readonly Category[],
  transactions: readonly Transaction[]
): string {
  const nameOf = nameLookup(accounts, categories);
  const ordered = [...transactions].sort(compareNewestFirst).reverse();
  const refs = new Map(ordered.map((tx, i) => [tx.id, `T${i + 1}`]));
  const rows = ordered.map((tx) => [
    refs.get(tx.id)!,
    tx.date,
    TRANSACTION_TYPE_LABELS[tx.type],
    nameOf(tx.fromId),
    nameOf(tx.toId),
    plainTaka(tx.amount),
    tx.note,
    tx.party ?? '',
    tx.parentId ? (refs.get(tx.parentId) ?? '') : '',
  ]);
  return toCsv([EXPORT_COLUMNS, ...rows]);
}
