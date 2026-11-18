/**
 * Read queries that return only what a screen shows, so nothing ever loads every transaction
 * (with years of entries that took seconds). Each one matches a tested function in
 * `src/lib/utils/ledger.util.ts` run on the full list; `queries.database.test.ts` checks that
 * on a real SQLite database. They take the database as a parameter so tests can pass one.
 */
import { and, count, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type { Transaction } from '@/lib/types';
import {
  addMonths,
  type DayGroup,
  daysInMonth,
  groupByDay,
  MONEY_TREE_MAX_DEPTH,
  type MoneyTree,
  moneyTree,
  type PeriodSpending,
} from '@/lib/utils';

import { rowToTransaction } from './mappers.database';
import * as schema from './schema.database';
import { accounts, transactions } from './schema.database';

/** Any synchronous Drizzle SQLite database with our schema (expo-sqlite in the app, better-sqlite3 in tests); the run-result type differs per driver. */
export type LedgerDatabase = BaseSQLiteDatabase<'sync', any, typeof schema>;

const live = isNull(transactions.deletedAt);
/** Newest first, exactly like `compareNewestFirst`: date, then when it was entered, then id. */
const newestFirst = [desc(transactions.date), desc(transactions.createdAt), desc(transactions.id)] as const;

export function getTransaction(database: LedgerDatabase, id: string): Transaction | null {
  const row = database.select().from(transactions).where(and(eq(transactions.id, id), live)).get();
  return row ? rowToTransaction(row) : null;
}

/** Transactions linked to `parentId` ("Linked to"), newest first. */
export function getChildren(database: LedgerDatabase, parentId: string): Transaction[] {
  return database
    .select()
    .from(transactions)
    .where(and(eq(transactions.parentId, parentId), live))
    .orderBy(...newestFirst)
    .all()
    .map(rowToTransaction);
}

/** For each of `parentIds` that has linked transactions: their total amount (for "left from this"). */
export function getChildTotals(database: LedgerDatabase, parentIds: readonly string[]): Map<string, number> {
  if (parentIds.length === 0) return new Map();
  const rows = database
    .select({ parentId: transactions.parentId, total: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(and(inArray(transactions.parentId, [...parentIds]), live))
    .groupBy(transactions.parentId)
    .all();
  return new Map(rows.map((r) => [r.parentId as string, r.total]));
}

/** `remainingOf`: the parent's amount minus everything linked to it. */
export function remainingFrom(parent: Transaction, childTotals: ReadonlyMap<string, number>): number {
  return parent.amount - (childTotals.get(parent.id) ?? 0);
}

/** Transactions dated `from`…`to` (inclusive `YYYY-MM-DD`), optionally only those touching one account. Newest first. */
export function getTransactionsBetween(
  database: LedgerDatabase,
  from: string,
  to: string,
  accountId?: string
): Transaction[] {
  return database
    .select()
    .from(transactions)
    .where(
      and(
        live,
        gte(transactions.date, from),
        lte(transactions.date, to),
        accountId ? or(eq(transactions.fromId, accountId), eq(transactions.toId, accountId)) : undefined
      )
    )
    .orderBy(...newestFirst)
    .all()
    .map(rowToTransaction);
}

/** `monthlySpending`: expenses per month for `count` months ending with `endMonthKey`, oldest first. */
export function getMonthlySpending(database: LedgerDatabase, endMonthKey: string, count: number): PeriodSpending[] {
  const first = addMonths(endMonthKey, 1 - count);
  const rows = database
    .select({ month: sql<string>`substr(${transactions.date}, 1, 7)`, total: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(
      and(
        live,
        eq(transactions.type, 'expense'),
        gte(transactions.date, `${first}-01`),
        lte(transactions.date, `${endMonthKey}-${daysInMonth(endMonthKey)}`)
      )
    )
    .groupBy(sql`substr(${transactions.date}, 1, 7)`)
    .all();
  const totals = new Map(rows.map((r) => [r.month, r.total]));
  return Array.from({ length: count }, (_, i) => {
    const key = addMonths(endMonthKey, i - count + 1);
    return { key, amount: totals.get(key) ?? 0 };
  });
}

export function countTransactions(database: LedgerDatabase): number {
  return database.select({ n: count() }).from(transactions).where(live).get()?.n ?? 0;
}

export type RecentDays = {
  /** Whole days, newest first, holding at least `minCount` transactions (or all of them). */
  days: DayGroup[];
  /** Older days exist. */
  hasMore: boolean;
};

/**
 * The transaction list's pages: `takeDays(groupByDay(all), minCount)` without loading all.
 * Finds the oldest day still needed (a running count per day, newest first), then loads
 * only the rows from that day on.
 */
export function getRecentDays(database: LedgerDatabase, minCount: number): RecentDays {
  // For each day: how many transactions are on newer days. A day is needed while that is
  // below `minCount`; the oldest such day is where the page starts.
  const [cutoff] = database.all<{ date: string }>(sql`
    SELECT date FROM (
      SELECT date, SUM(COUNT(*)) OVER (ORDER BY date DESC) - COUNT(*) AS newer
      FROM transactions WHERE deleted_at IS NULL GROUP BY date
    )
    WHERE newer < ${minCount}
    ORDER BY date ASC LIMIT 1
  `);
  if (!cutoff) return { days: [], hasMore: false };
  const rows = database
    .select()
    .from(transactions)
    .where(and(live, gte(transactions.date, cutoff.date)))
    .orderBy(...newestFirst)
    .all()
    .map(rowToTransaction);
  const older = database
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(live, lt(transactions.date, cutoff.date)))
    .limit(1)
    .all();
  return { days: groupByDay(rows), hasMore: older.length > 0 };
}

/** The newest `limit` transactions (Quick add looks at the last 100). */
export function getRecentTransactions(database: LedgerDatabase, limit: number): Transaction[] {
  return database
    .select()
    .from(transactions)
    .where(live)
    .orderBy(...newestFirst)
    .limit(limit)
    .all()
    .map(rowToTransaction);
}

/** The newest `limit` transactions touching one account (its history), and whether there are more. */
export function getAccountTransactions(
  database: LedgerDatabase,
  accountId: string,
  limit: number
): { transactions: Transaction[]; hasMore: boolean } {
  const rows = database
    .select()
    .from(transactions)
    .where(and(live, or(eq(transactions.fromId, accountId), eq(transactions.toId, accountId))))
    .orderBy(...newestFirst)
    .limit(limit + 1)
    .all()
    .map(rowToTransaction);
  return { transactions: rows.slice(0, limit), hasMore: rows.length > limit };
}

/**
 * `accountBalances` in SQL: opening balance + money in − money out, counting only
 * transactions on or after each account's opening date.
 */
export function getAccountBalances(database: LedgerDatabase): Map<string, number> {
  const moneyIn = database.$with('money_in').as(
    database
      .select({ accountId: transactions.toId, total: sql<number>`sum(${transactions.amount})`.as('total_in') })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.toId))
      .where(and(live, ne(transactions.type, 'expense'), gte(transactions.date, accounts.openingDate)))
      .groupBy(transactions.toId)
  );
  const moneyOut = database.$with('money_out').as(
    database
      .select({ accountId: transactions.fromId, total: sql<number>`sum(${transactions.amount})`.as('total_out') })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.fromId))
      .where(and(live, ne(transactions.type, 'income'), gte(transactions.date, accounts.openingDate)))
      .groupBy(transactions.fromId)
  );
  const rows = database
    .with(moneyIn, moneyOut)
    .select({
      id: accounts.id,
      balance: sql<number>`${accounts.openingBalance} + coalesce(${moneyIn.total}, 0) - coalesce(${moneyOut.total}, 0)`,
    })
    .from(accounts)
    .leftJoin(moneyIn, eq(moneyIn.accountId, accounts.id))
    .leftJoin(moneyOut, eq(moneyOut.accountId, accounts.id))
    .where(isNull(accounts.deletedAt))
    .all();
  return new Map(rows.map((r) => [r.id, r.balance]));
}

/**
 * `receivedFromSuggestions`: "Received from" names, most recently used first, each once (ignoring
 * case and surrounding spaces). The name is spelled as in its latest use.
 */
export function getReceivedFromNames(database: LedgerDatabase): string[] {
  // SQLite returns the other columns from the row that has the max() — the latest use.
  const rows = database.all<{ name: string }>(sql`
    SELECT trim(received_from) AS name, max(date || ' ' || created_at) AS latest
    FROM transactions
    WHERE deleted_at IS NULL AND received_from IS NOT NULL AND trim(received_from) <> ''
    GROUP BY lower(trim(received_from))
    ORDER BY latest DESC
  `);
  return rows.map((r) => r.name);
}

/**
 * `linkableParents`, newest first and capped at `limit`: money that came into `accountId`
 * (income or transfers in), offered as "Linked to" for money leaving it. `keepId` (the
 * current link) is always included.
 */
export function getLinkableParents(
  database: LedgerDatabase,
  accountId: string,
  { excludeId, keepId, limit = 30 }: { excludeId?: string; keepId?: string | null; limit?: number } = {}
): Transaction[] {
  const rows = database
    .select()
    .from(transactions)
    .where(
      and(
        live,
        ne(transactions.type, 'expense'),
        eq(transactions.toId, accountId),
        excludeId ? ne(transactions.id, excludeId) : undefined
      )
    )
    .orderBy(...newestFirst)
    .limit(limit)
    .all()
    .map(rowToTransaction);
  if (keepId && !rows.some((tx) => tx.id === keepId)) {
    const kept = getTransaction(database, keepId);
    if (kept) rows.push(kept);
  }
  return rows;
}

/** How many live transactions are linked to `parentId` (for the delete message). */
export function countChildren(database: LedgerDatabase, parentId: string): number {
  return (
    database
      .select({ n: count() })
      .from(transactions)
      .where(and(live, eq(transactions.parentId, parentId)))
      .get()?.n ?? 0
  );
}


/** Ids per `IN (…)` lookup, well under SQLite's limit on bound values. */
const ID_CHUNK = 500;

/**
 * `moneyTree` for one entry, reading only that tree: the chain up through "Linked to" (one
 * lookup per step), then every live entry below the root in one recursive query (one level
 * deeper than the tree goes, so "left" at the deepest level still counts what's linked to it).
 * No row limit: the totals count the whole tree, and `moneyTree` itself caps what's shown.
 */
export function getMoneyTree(database: LedgerDatabase, id: string): MoneyTree | null {
  const entry = getTransaction(database, id);
  if (!entry) return null;
  const chain = [entry];
  const seen = new Set([entry.id]);
  for (let step = entry; step.parentId && !seen.has(step.parentId) && chain.length <= MONEY_TREE_MAX_DEPTH; ) {
    const parent = getTransaction(database, step.parentId);
    if (!parent) break;
    chain.push(parent);
    seen.add(parent.id);
    step = parent;
  }
  const root = chain[chain.length - 1];

  const below = database.all<{ id: string }>(sql`
    WITH RECURSIVE tree(id, depth) AS (
      SELECT ${root.id}, 0
      UNION
      SELECT t.id, tree.depth + 1
      FROM transactions t JOIN tree ON t.parent_id = tree.id
      WHERE t.deleted_at IS NULL AND tree.depth <= ${MONEY_TREE_MAX_DEPTH}
    )
    SELECT DISTINCT id FROM tree WHERE id <> ${root.id}
  `);
  const ids = below.map((row) => row.id).filter((rowId) => !seen.has(rowId));
  const rows: Transaction[] = [...chain];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    rows.push(
      ...database
        .select()
        .from(transactions)
        .where(and(inArray(transactions.id, ids.slice(i, i + ID_CHUNK)), live))
        .all()
        .map(rowToTransaction)
    );
  }
  return moneyTree(id, rows);
}
