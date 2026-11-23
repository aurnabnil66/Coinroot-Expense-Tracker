import { z } from 'zod';

import { ACCOUNT_TYPES, CATEGORY_KINDS, TRANSACTION_TYPES } from '@/lib/types';
import { isDateKey } from '@/lib/utils';

/**
 * The backup file: every live account, category and transaction as JSON. `format` goes up
 * when the shape changes, so an older app can refuse a newer file instead of misreading it,
 * and this app upgrades older files before checking them (`upgradeBackup`).
 * - 1: transactions had `party` ("Received from")
 * - 2: renamed to `receivedFrom`
 */
export const BACKUP_FORMAT = 2;
export const BACKUP_APP = 'coinroot';

const id = z.string().min(1).max(100);
const dateKey = z.string().refine(isDateKey, 'not a YYYY-MM-DD date');
const nullableDate = dateKey.nullable();
const timestamp = z.string().min(1).max(40);
const poisha = z.number().int().safe();

const accountRow = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  type: z.enum(ACCOUNT_TYPES),
  openingBalance: poisha,
  openingDate: dateKey,
  archived: z.boolean(),
  sortOrder: z.number().int(),
  installmentAmount: poisha.nullable(),
  startDate: nullableDate,
  maturityDate: nullableDate,
  interestRate: z.number().finite().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const categoryRow = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  kind: z.enum(CATEGORY_KINDS),
  icon: z.string().max(100).nullable(),
  color: z.string().max(40).nullable(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const transactionRow = z.object({
  id,
  date: dateKey,
  type: z.enum(TRANSACTION_TYPES),
  fromId: id,
  toId: id,
  amount: poisha.positive(),
  note: z.string().max(1000),
  parentId: id.nullable(),
  receivedFrom: z.string().max(200).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  format: z.literal(BACKUP_FORMAT),
  exportedAt: timestamp,
  accounts: z.array(accountRow),
  categories: z.array(categoryRow),
  transactions: z.array(transactionRow),
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupAccount = z.infer<typeof accountRow>;
export type BackupCategory = z.infer<typeof categoryRow>;
export type BackupTransaction = z.infer<typeof transactionRow>;

export type BackupCheck = { ok: true; backup: Backup } | { ok: false; errors: string[] };

/** Most problems listed; the rest are summed up, so a broken file doesn't flood the dialog. */
const MAX_ERRORS = 8;

/**
 * Reads a backup file's text and checks everything before anything is restored: the file is a
 * Coinroot backup in a format this app knows, every row is well formed, ids are unique, and
 * every from / to / "Linked to" points at a row of the right kind in the same file.
 */
export function checkBackup(text: string): BackupCheck {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["This isn't a Coinroot backup file (it isn't valid JSON)."] };
  }

  const header = z.object({ app: z.unknown(), format: z.unknown() }).safeParse(json);
  if (!header.success || header.data.app !== BACKUP_APP) {
    return { ok: false, errors: ["This isn't a Coinroot backup file."] };
  }
  if (typeof header.data.format === 'number' && header.data.format > BACKUP_FORMAT) {
    return { ok: false, errors: ['This backup was made by a newer version of Coinroot. Update the app, then try again.'] };
  }

  const parsed = backupSchema.safeParse(upgradeBackup(json));
  if (!parsed.success) {
    return { ok: false, errors: summarise(parsed.error.issues.map(describeIssue)) };
  }

  const errors = referenceErrors(parsed.data);
  return errors.length > 0 ? { ok: false, errors: summarise(errors) } : { ok: true, backup: parsed.data };
}

/** Brings an older backup file's JSON to the current format (anything unexpected is left for the checks). */
export function upgradeBackup(json: unknown): unknown {
  if (!json || typeof json !== 'object') return json;
  const file = json as Record<string, unknown>;
  if (file.format !== 1) return json;
  const transactions = Array.isArray(file.transactions)
    ? file.transactions.map((row: unknown) => {
        if (!row || typeof row !== 'object' || 'receivedFrom' in row) return row;
        // A row without `party` (hand-edited, or written by a lenient tool) means no payer.
        const { party = null, ...rest } = row as Record<string, unknown>;
        return { ...rest, receivedFrom: party };
      })
    : file.transactions;
  return { ...file, format: 2, transactions };
}

const TABLE_LABELS: Record<string, string> = { accounts: 'Account', categories: 'Category', transactions: 'Transaction' };

/** "Transaction 14: amount is invalid" (rows numbered from 1, as a person counts them). */
function describeIssue(issue: z.core.$ZodIssue): string {
  const [table, index, field] = issue.path;
  if (typeof table === 'string' && typeof index === 'number' && TABLE_LABELS[table]) {
    const what = typeof field === 'string' ? `${field} is invalid` : 'is invalid';
    return `${TABLE_LABELS[table]} ${index + 1}: ${what}`;
  }
  return `The file is damaged (${issue.path.join('.') || 'top level'}).`;
}

function referenceErrors(backup: Backup): string[] {
  const errors: string[] = [];
  const duplicates = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    ids.forEach((value, i) => {
      if (seen.has(value)) errors.push(`${label} ${i + 1}: the same id appears twice`);
      seen.add(value);
    });
  };
  duplicates('Account', backup.accounts.map((a) => a.id));
  duplicates('Category', backup.categories.map((c) => c.id));
  duplicates('Transaction', backup.transactions.map((t) => t.id));

  const accountIds = new Set(backup.accounts.map((a) => a.id));
  const categoryKind = new Map(backup.categories.map((c) => [c.id, c.kind]));
  const transactionIds = new Set(backup.transactions.map((t) => t.id));
  const isAccount = (value: string) => accountIds.has(value);
  const isExpenseCategory = (value: string) => categoryKind.get(value) === 'expense';
  const isIncomeSource = (value: string) => categoryKind.get(value) === 'income_source';

  backup.transactions.forEach((tx, i) => {
    const row = `Transaction ${i + 1}`;
    if (tx.type === 'expense') {
      if (!isAccount(tx.fromId)) errors.push(`${row}: unknown account it was paid from`);
      if (!isExpenseCategory(tx.toId)) errors.push(`${row}: unknown expense category`);
    } else if (tx.type === 'income') {
      if (!isIncomeSource(tx.fromId)) errors.push(`${row}: unknown income source`);
      if (!isAccount(tx.toId)) errors.push(`${row}: unknown account it was received in`);
    } else {
      if (!isAccount(tx.fromId) || !isAccount(tx.toId)) errors.push(`${row}: unknown account in the transfer`);
      else if (tx.fromId === tx.toId) errors.push(`${row}: transfer to the same account`);
    }
    if (tx.parentId !== null && !transactionIds.has(tx.parentId)) errors.push(`${row}: linked to a missing transaction`);
  });
  return errors;
}

function summarise(errors: string[]): string[] {
  if (errors.length <= MAX_ERRORS) return errors;
  return [...errors.slice(0, MAX_ERRORS), `…and ${errors.length - MAX_ERRORS} more problems.`];
}
