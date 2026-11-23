/**
 * Builds the rows the app adds on its own: the default categories (first launch) and the
 * sample data ("Explore with sample data"). Pure functions, so they're unit-tested without
 * a device; `seed.database.ts` writes them.
 */
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import type { Account, Category, CategoryKind, Transaction } from '@/lib/types';

import { accountToRow, categoryToRow, transactionToRow } from './mappers.database';
import type { NewAccountRow, NewCategoryRow, NewTransactionRow } from './schema.database';

type MakeId = () => string;

export function defaultCategoryRows(makeId: MakeId): NewCategoryRow[] {
  return DEFAULT_CATEGORIES.map(({ name, kind, color }) => ({ id: makeId(), name, kind, color, icon: null, archived: false }));
}

export type SampleLedger = {
  accounts: readonly Account[];
  categories: readonly Category[];
  transactions: readonly Transaction[];
};

export type SampleRows = {
  /** Only categories the database doesn't have yet (matched by kind + name). */
  categories: NewCategoryRow[];
  accounts: NewAccountRow[];
  transactions: NewTransactionRow[];
};

const categoryKey = (kind: CategoryKind, name: string) => `${kind}|${name.trim().toLowerCase()}`;

/**
 * Gives every sample row a fresh UUID and rewrites the links (from / to / parent) to match.
 * Sample categories that already exist (e.g. the seeded "Food") are reused, not duplicated.
 */
export function sampleRows(
  sample: SampleLedger,
  existingCategories: readonly Pick<Category, 'id' | 'name' | 'kind'>[],
  makeId: MakeId
): SampleRows {
  const ids = new Map<string, string>();
  const existing = new Map(existingCategories.map((c) => [categoryKey(c.kind, c.name), c.id]));

  const categories: NewCategoryRow[] = [];
  for (const category of sample.categories) {
    const found = existing.get(categoryKey(category.kind, category.name));
    if (found) {
      ids.set(category.id, found);
    } else {
      const id = makeId();
      ids.set(category.id, id);
      existing.set(categoryKey(category.kind, category.name), id);
      categories.push(categoryToRow({ ...category, id }));
    }
  }

  const accounts = sample.accounts.map((account) => {
    const id = makeId();
    ids.set(account.id, id);
    return accountToRow({ ...account, id });
  });

  // Ids first, so a child can point at a parent listed after it.
  for (const tx of sample.transactions) ids.set(tx.id, makeId());
  const mapped = (id: string) => {
    const next = ids.get(id);
    if (!next) throw new Error(`Sample data refers to an unknown id: ${id}`);
    return next;
  };
  const transactions = sample.transactions.map((tx) =>
    transactionToRow({
      ...tx,
      id: mapped(tx.id),
      fromId: mapped(tx.fromId),
      toId: mapped(tx.toId),
      parentId: tx.parentId ? mapped(tx.parentId) : null,
    })
  );

  return { categories, accounts, transactions };
}
