/**
 * Drizzle schema for the on-device SQLite database. It mirrors the domain types in
 * `src/lib/types` and is ready for Supabase sync later:
 * - ids are UUID text generated on the device (`newId` in `id.database.ts`), so rows made offline never clash
 * - every table has `created_at` / `updated_at` (ISO timestamps, used to find changes),
 *   `deleted_at` (deleting only sets it, so the delete can sync too) and `synced_updated_at`
 *   (what the cloud last confirmed; see `sync.database.ts`)
 * - money is integer poisha; dates are `YYYY-MM-DD` text
 *
 * After changing this file run `bunx drizzle-kit generate` to add a migration.
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// No native modules here: drizzle-kit loads this file in Node to generate migrations.
import { ACCOUNT_TYPES, CATEGORY_KINDS, TRANSACTION_TYPES } from '@/lib/types';

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** Columns every table has, for sync. */
const syncColumns = {
  /** UUID v4 from `newId()`; the app always sets it. */
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull().default(nowIso),
  updatedAt: text('updated_at').notNull().default(nowIso),
  /** Set instead of deleting the row; `null` while the row is live. */
  deletedAt: text('deleted_at'),
  /**
   * The `updated_at` the cloud last confirmed (pushed or pulled), `null` if never synced.
   * A row needs uploading while this differs from `updated_at`, so every write that bumps
   * `updated_at` is picked up without a separate flag. Device-only: not in backups or the cloud.
   */
  syncedUpdatedAt: text('synced_updated_at'),
};

/** `column IN ('a', 'b')` for a check constraint. */
const oneOf = (column: string, values: readonly string[]) =>
  sql.raw(`${column} IN (${values.map((v) => `'${v}'`).join(', ')})`);

export const accounts = sqliteTable(
  'accounts',
  {
    ...syncColumns,
    name: text('name').notNull(),
    type: text('type', { enum: ACCOUNT_TYPES }).notNull(),
    /** Poisha at the start of `openingDate`. */
    openingBalance: integer('opening_balance').notNull().default(0),
    /** `YYYY-MM-DD`; only transactions on or after this day count towards the balance. */
    openingDate: text('opening_date').notNull(),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    // Savings / DPS details (all null for other accounts).
    /** Poisha per installment. */
    installmentAmount: integer('installment_amount'),
    startDate: text('start_date'),
    maturityDate: text('maturity_date'),
    /** Percent per year, e.g. 8.5. */
    interestRate: real('interest_rate'),
  },
  (table) => [
    check('accounts_type_check', oneOf('type', ACCOUNT_TYPES)),
    index('accounts_sort_idx').on(table.sortOrder),
  ]
);

export const categories = sqliteTable(
  'categories',
  {
    ...syncColumns,
    name: text('name').notNull(),
    /** `expense` category or `income_source`. */
    kind: text('kind', { enum: CATEGORY_KINDS }).notNull(),
    icon: text('icon'),
    /** A swatch key from `CATEGORY_COLORS`. */
    color: text('color'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    check('categories_kind_check', oneOf('kind', CATEGORY_KINDS)),
    index('categories_kind_idx').on(table.kind),
  ]
);

/**
 * `from_id` / `to_id` point to an account or a category depending on `type`
 * (income: source → account, expense: account → category, transfer: account → account),
 * so they have no foreign keys; the app checks them. `parent_id` has none either, so
 * synced rows can arrive in any order.
 */
export const transactions = sqliteTable(
  'transactions',
  {
    ...syncColumns,
    /** `YYYY-MM-DD` */
    date: text('date').notNull(),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    fromId: text('from_id').notNull(),
    toId: text('to_id').notNull(),
    /** Poisha, always positive. */
    amount: integer('amount').notNull(),
    note: text('note').notNull().default(''),
    /** The transaction this money came from (the money tree). */
    parentId: text('parent_id'),
    /** Income only: who paid ("Received from"). */
    receivedFrom: text('received_from'),
  },
  (table) => [
    check('transactions_type_check', oneOf('type', TRANSACTION_TYPES)),
    check('transactions_amount_check', sql`${table.amount} > 0`),
    check('transactions_from_to_check', sql`${table.fromId} <> ${table.toId}`),
    index('transactions_date_idx').on(table.date),
    index('transactions_from_idx').on(table.fromId),
    index('transactions_to_idx').on(table.toId),
    index('transactions_parent_idx').on(table.parentId),
  ]
);

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
export type CategoryRow = typeof categories.$inferSelect;
export type NewCategoryRow = typeof categories.$inferInsert;
export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransactionRow = typeof transactions.$inferInsert;
