/**
 * Step 2 of an import: the names a sheet uses are matched to the user's accounts, categories and
 * income sources (ignoring case); each unknown one is created or mapped to an existing one.
 * Then the rows become ready-to-save accounts, categories and transactions with new ids and
 * "Linked to" turned into parent ids. Rows already in the app can be left out.
 */
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import type { Account, AccountType, Category, CategoryKind, Transaction } from '@/lib/types';

import type { DraftRow } from './rows.spreadsheet';

export type NameRole = 'account' | CategoryKind;

export type NameNeed = {
  /** `role:lowercase name`, the key for choices. */
  key: string;
  role: NameRole;
  /** As first written in the sheet. */
  name: string;
  /** How many rows use it. */
  count: number;
  /** The earliest row using it (a new account's opening date). */
  firstDate: string;
  /** The user's account / category with this name, if any. */
  existingId: string | null;
};

export type NameChoice =
  | { action: 'use'; id: string }
  | { action: 'create'; accountType: AccountType; openingBalance: number };

const nameKey = (role: NameRole, name: string) => `${role}:${name.trim().toLowerCase()}`;

/** Which names each row uses, by role: expense = account → category, income = source → account. */
function namesOf(row: DraftRow): [NameRole, string][] {
  if (row.type === 'expense') return [['account', row.fromName], ['expense', row.toName]];
  if (row.type === 'income') return [['income_source', row.fromName], ['account', row.toName]];
  return [['account', row.fromName], ['account', row.toName]];
}

const ROLE_ORDER: Record<NameRole, number> = { account: 0, expense: 1, income_source: 2 };

/** Every name the rows use, matched to the user's own where possible. Accounts first, then most used. */
export function neededNames(rows: readonly DraftRow[], accounts: readonly Account[], categories: readonly Category[]): NameNeed[] {
  const needs = new Map<string, NameNeed>();
  for (const row of rows) {
    for (const [role, name] of namesOf(row)) {
      const key = nameKey(role, name);
      const need = needs.get(key);
      if (need) {
        need.count += 1;
        if (row.date < need.firstDate) need.firstDate = row.date;
      } else {
        const existing = findExisting(role, name, accounts, categories);
        // A matched name shows as the user spells it.
        needs.set(key, { key, role, name: existing?.name ?? name.trim(), count: 1, firstDate: row.date, existingId: existing?.id ?? null });
      }
    }
  }
  return [...needs.values()].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.count - a.count);
}

function findExisting(
  role: NameRole,
  name: string,
  accounts: readonly Account[],
  categories: readonly Category[]
): { id: string; name: string } | null {
  const wanted = name.trim().toLowerCase();
  const same = <T extends { name: string; archived: boolean }>(items: readonly T[]) =>
    // Prefer one that isn't archived.
    [...items.filter((item) => !item.archived), ...items.filter((item) => item.archived)].find(
      (item) => item.name.trim().toLowerCase() === wanted
    );
  const match = role === 'account' ? same(accounts) : same(categories.filter((c) => c.kind === role));
  return match ? { id: match.id, name: match.name } : null;
}

/** A sensible type for a new account from its name; the user can change it. */
export function guessAccountType(name: string): AccountType {
  const text = name.toLowerCase();
  if (/cash|hand|pocket|নগদ/.test(text)) return 'cash';
  if (/dps|saving|fdr|deposit|সঞ্চয়/.test(text)) return 'savings';
  if (/wallet|mobile|mfs/.test(text)) return 'mobile_wallet';
  return 'bank';
}

/** Use the matching account / category, or create a new one. */
export function defaultChoice(need: NameNeed): NameChoice {
  return need.existingId
    ? { action: 'use', id: need.existingId }
    : { action: 'create', accountType: guessAccountType(need.name), openingBalance: 0 };
}

export type ImportPlan = {
  /** New ones to create. */
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
};

/**
 * The records to save. `choices` holds one choice per need key (missing ones use
 * `defaultChoice`). Entries keep the sheet's order within a day (later rows count as newer).
 */
export function buildImport(
  rows: readonly DraftRow[],
  needs: readonly NameNeed[],
  choices: Readonly<Record<string, NameChoice>>,
  makeId: () => string,
  now: Date = new Date()
): ImportPlan {
  const ids = new Map<string, string>();
  const accounts: Account[] = [];
  const categories: Category[] = [];
  for (const need of needs) {
    const choice = choices[need.key] ?? defaultChoice(need);
    if (choice.action === 'use') {
      ids.set(need.key, choice.id);
      continue;
    }
    const id = makeId();
    ids.set(need.key, id);
    if (need.role === 'account') {
      accounts.push({
        id,
        name: need.name,
        type: choice.accountType,
        openingBalance: choice.openingBalance,
        openingDate: need.firstDate,
        archived: false,
        sortOrder: accounts.length,
        savings: choice.accountType === 'savings' ? { installmentAmount: null, startDate: null, maturityDate: null, interestRate: null } : null,
      });
    } else {
      const known = DEFAULT_CATEGORIES.find((c) => c.kind === need.role && c.name.toLowerCase() === need.name.toLowerCase());
      categories.push({ id, name: need.name, kind: need.role, icon: null, color: known?.color ?? null, archived: false });
    }
  }

  const txIds = rows.map(() => makeId());
  const byRef = new Map<string, string>();
  rows.forEach((row, i) => {
    if (row.ref) byRef.set(row.ref.trim().toLowerCase(), txIds[i]);
  });
  const idFor = (role: NameRole, name: string) => ids.get(nameKey(role, name))!;
  const transactions = rows.map((row, i): Transaction => {
    const [[fromRole, fromName], [toRole, toName]] = namesOf(row);
    const stamp = new Date(now.getTime() + i).toISOString();
    return {
      id: txIds[i],
      date: row.date,
      type: row.type,
      fromId: idFor(fromRole, fromName),
      toId: idFor(toRole, toName),
      amount: row.amount,
      note: row.note,
      parentId: row.linkedRef ? (byRef.get(row.linkedRef.trim().toLowerCase()) ?? null) : null,
      receivedFrom: row.receivedFrom,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
  return { accounts, categories, transactions };
}

const sameEntry = (tx: Transaction) => `${tx.date}|${tx.type}|${tx.fromId}|${tx.toId}|${tx.amount}`;

/**
 * Entries that look already recorded: same date, type, from, to and amount as one in the app
 * (each existing entry matches once, so two identical rows against one recorded entry leave
 * one new). Returns, per planned index, the existing entry's id.
 */
export function findDuplicates(planned: readonly Transaction[], existing: readonly Transaction[]): Map<number, string> {
  const pool = new Map<string, string[]>();
  for (const tx of existing) {
    const key = sameEntry(tx);
    pool.set(key, [...(pool.get(key) ?? []), tx.id]);
  }
  const duplicates = new Map<number, string>();
  planned.forEach((tx, i) => {
    const ids = pool.get(sameEntry(tx));
    if (ids && ids.length > 0) duplicates.set(i, ids.shift()!);
  });
  return duplicates;
}

/** The plan without the duplicate entries; links to a left-out entry point at the recorded one. */
export function withoutDuplicates(plan: ImportPlan, duplicates: ReadonlyMap<number, string>): ImportPlan {
  if (duplicates.size === 0) return plan;
  const replaced = new Map<string, string>();
  duplicates.forEach((existingId, i) => replaced.set(plan.transactions[i].id, existingId));
  const transactions = plan.transactions
    .filter((_, i) => !duplicates.has(i))
    .map((tx) => (tx.parentId && replaced.has(tx.parentId) ? { ...tx, parentId: replaced.get(tx.parentId)! } : tx));
  // Accounts / categories only the left-out rows needed aren't created.
  const used = new Set(transactions.flatMap((tx) => [tx.fromId, tx.toId]));
  return {
    accounts: plan.accounts.filter((a) => used.has(a.id)),
    categories: plan.categories.filter((c) => used.has(c.id)),
    transactions,
  };
}
