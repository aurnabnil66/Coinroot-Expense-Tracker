import type { Account, Category, Transaction } from '@/lib/types';

import { addMonths, daysInMonth, toMonthKey } from './date.util';

/**
 * Account balance = opening balance + money in − money out,
 * counting only transactions on/after the account's opening date.
 */
export function accountBalance(account: Account, transactions: readonly Transaction[]): number {
  let balance = account.openingBalance;
  for (const tx of transactions) {
    if (tx.date < account.openingDate) continue;
    const moneyIn = tx.type !== 'expense' && tx.toId === account.id;
    const moneyOut = tx.type !== 'income' && tx.fromId === account.id;
    if (moneyIn) balance += tx.amount;
    if (moneyOut) balance -= tx.amount;
  }
  return balance;
}

export function accountBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[]
): Map<string, number> {
  return new Map(accounts.map((account) => [account.id, accountBalance(account, transactions)]));
}

export function childrenOf(parentId: string, transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter((tx) => tx.parentId === parentId);
}

/** Body of the "Delete transaction?" confirmation: linked entries are kept but unlinked. */
export function deleteTransactionMessage(linkedCount: number): string {
  if (linkedCount === 0) return "This can't be undone.";
  const linked =
    linkedCount === 1 ? 'The 1 linked entry stays but loses its link' : `The ${linkedCount} linked entries stay but lose their link`;
  return `${linked}. This can't be undone.`;
}

/** What's left of a transaction's money after the transactions linked to it: amount − children. */
export function remainingOf(parent: Transaction, transactions: readonly Transaction[]): number {
  return childrenOf(parent.id, transactions).reduce((left, child) => left - child.amount, parent.amount);
}

/**
 * Transactions that put money into `accountId` and can be picked as "Linked to" for
 * money leaving it — e.g. the ATM withdrawal into Cash for a rickshaw fare paid in cash.
 */
export function linkableParents(
  accountId: string,
  transactions: readonly Transaction[],
  excludeId?: string
): Transaction[] {
  return transactions
    .filter((tx) => tx.id !== excludeId && tx.type !== 'expense' && tx.toId === accountId)
    .sort(compareNewestFirst);
}

export type CategoryTotal = {
  categoryId: string;
  amount: number;
  /** Share of the month's expenses, 0–1. */
  share: number;
};

export type MonthlySummary = {
  income: number;
  expenses: number;
  /** income − expenses (transfers are never counted). */
  saved: number;
  /** Transfers into savings accounts (e.g. monthly savings installments). */
  movedToSavings: number;
  byCategory: CategoryTotal[];
};

export function monthlySummary(
  monthKey: string,
  transactions: readonly Transaction[],
  accounts: readonly Account[]
): MonthlySummary {
  const savingsIds = new Set(accounts.filter((a) => a.type === 'savings').map((a) => a.id));
  const byCategory = new Map<string, number>();
  let income = 0;
  let expenses = 0;
  let movedToSavings = 0;

  for (const tx of transactions) {
    if (toMonthKey(tx.date) !== monthKey) continue;
    if (tx.type === 'income') {
      income += tx.amount;
    } else if (tx.type === 'expense') {
      expenses += tx.amount;
      byCategory.set(tx.toId, (byCategory.get(tx.toId) ?? 0) + tx.amount);
    } else if (savingsIds.has(tx.toId) && !savingsIds.has(tx.fromId)) {
      movedToSavings += tx.amount;
    }
  }

  return {
    income,
    expenses,
    saved: income - expenses,
    movedToSavings,
    byCategory: [...byCategory]
      .map(([categoryId, amount]) => ({
        categoryId,
        amount,
        share: expenses > 0 ? amount / expenses : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/** Money spent in one period: a day ("YYYY-MM-DD") or a month ("YYYY-MM"). */
export type PeriodSpending = {
  key: string;
  amount: number;
};

/** Expenses per day of a month, including days with nothing spent. */
export function dailySpending(monthKey: string, transactions: readonly Transaction[]): PeriodSpending[] {
  const days = Array.from({ length: daysInMonth(monthKey) }, (_, i) => ({
    key: `${monthKey}-${String(i + 1).padStart(2, '0')}`,
    amount: 0,
  }));
  for (const tx of transactions) {
    if (tx.type !== 'expense' || toMonthKey(tx.date) !== monthKey) continue;
    days[Number(tx.date.slice(8)) - 1].amount += tx.amount;
  }
  return days;
}

/** Expenses per month for `count` months ending with `endMonthKey`, oldest first. */
export function monthlySpending(
  endMonthKey: string,
  count: number,
  transactions: readonly Transaction[]
): PeriodSpending[] {
  const months = Array.from({ length: count }, (_, i) => ({
    key: addMonths(endMonthKey, i - count + 1),
    amount: 0,
  }));
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const month = byKey.get(toMonthKey(tx.date));
    if (month) month.amount += tx.amount;
  }
  return months;
}

/** Newest first: by date, then by when it was entered, then by id so the order is always the same. */
export function compareNewestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export type DayGroup = {
  date: string;
  /** Money spent that day (expenses only). */
  spent: number;
  data: Transaction[];
};

/** Groups transactions by day, newest day first, newest entry first within a day. */
export function groupByDay(transactions: readonly Transaction[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const tx of [...transactions].sort(compareNewestFirst)) {
    let group = groups.get(tx.date);
    if (!group) {
      group = { date: tx.date, spent: 0, data: [] };
      groups.set(tx.date, group);
    }
    group.data.push(tx);
    if (tx.type === 'expense') group.spent += tx.amount;
  }
  return [...groups.values()];
}

/**
 * The newest days that together hold at least `limit` transactions (or all days).
 * Whole days only, so a day's list and "spent" total are never cut in half.
 */
export function takeDays(groups: readonly DayGroup[], limit: number): DayGroup[] {
  let count = 0;
  let end = 0;
  while (end < groups.length && count < limit) {
    count += groups[end].data.length;
    end += 1;
  }
  return groups.slice(0, end);
}

/** Finds a category of `kind` by name, ignoring case (e.g. the user's "Bank Charges"). */
export function findCategoryByName(
  categories: readonly Category[],
  kind: Category['kind'],
  name: string
): Category | undefined {
  const wanted = name.trim().toLowerCase();
  return categories.find((c) => c.kind === kind && !c.archived && c.name.trim().toLowerCase() === wanted);
}

export type PayerTotal = {
  receivedFrom: string;
  amount: number;
};

/** Income per "Received from" name in a month, largest first. Entries without a name are left out. */
export function incomeByPayer(monthKey: string, transactions: readonly Transaction[]): PayerTotal[] {
  const totals = new Map<string, PayerTotal>();
  for (const tx of transactions) {
    if (tx.type !== 'income' || !tx.receivedFrom || toMonthKey(tx.date) !== monthKey) continue;
    const key = tx.receivedFrom.trim().toLowerCase();
    const total = totals.get(key) ?? { receivedFrom: tx.receivedFrom.trim(), amount: 0 };
    total.amount += tx.amount;
    totals.set(key, total);
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount);
}

/** "Received from" names used before, most recent first, without duplicates. */
export function receivedFromSuggestions(transactions: readonly Transaction[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const tx of [...transactions].sort(compareNewestFirst)) {
    const name = tx.receivedFrom?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

export type QuickPreset = {
  type: Transaction['type'];
  fromId: string;
  toId: string;
  /** How often this combination was used. */
  count: number;
};

/**
 * The most used type + from + to combinations among recent entries ("Food from Cash",
 * "Client Payment into bKash"), for one-tap quick add. Ties go to the most recent.
 */
export function quickPresets(transactions: readonly Transaction[], limit = 4, recent = 100): QuickPreset[] {
  const presets = new Map<string, QuickPreset>();
  transactions
    .slice()
    .sort(compareNewestFirst)
    .slice(0, recent)
    .forEach((tx) => {
      const key = `${tx.type}|${tx.fromId}|${tx.toId}`;
      const preset = presets.get(key);
      if (preset) preset.count += 1;
      else presets.set(key, { type: tx.type, fromId: tx.fromId, toId: tx.toId, count: 1 });
    });
  // Map keeps insertion order (newest first), and sort is stable, so ties stay newest first.
  return [...presets.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * What to record when the counted balance differs from the app's: less money is spending
 * that wasn't recorded (an expense), more is unrecorded income. Null when they match.
 */
export function balanceAdjustment(
  recorded: number,
  actual: number
): { type: 'expense' | 'income'; amount: number } | null {
  if (actual === recorded) return null;
  return actual < recorded ? { type: 'expense', amount: recorded - actual } : { type: 'income', amount: actual - recorded };
}

/** Looks up account / category / income-source names for a transaction's from and to. */
export function nameLookup(
  accounts: readonly Account[],
  categories: readonly Category[]
): (id: string) => string {
  const names = new Map<string, string>();
  for (const item of [...accounts, ...categories]) names.set(item.id, item.name);
  return (id) => names.get(id) ?? 'Unknown';
}

/** One entry in a money tree, with everything paid from its money below it (oldest first). */
export type MoneyTreeNode = {
  tx: Transaction;
  /** 0 for the root. */
  depth: number;
  children: MoneyTreeNode[];
  /**
   * What's still left of this money where it landed: amount − what's linked to it. Expenses
   * have nothing left (the money is gone), so it's 0 for them.
   */
  left: number;
};

export type MoneyTree = {
  root: MoneyTreeNode;
  /** The chain from the root down to the entry asked about (root first, the entry last). */
  path: Transaction[];
  /** Every expense in the tree (also past a cut-off): money that actually left. */
  spent: number;
  /** Every non-expense entry's `left` (also past a cut-off): money still sitting in accounts. */
  left: number;
  /** Nodes in the tree. */
  size: number;
  /** More nodes exist than `MONEY_TREE_MAX_NODES`; the tree shows the first ones (by level, oldest first). */
  truncated: boolean;
};

/** Links followed up or down at most (a guard against very long or looping chains). */
export const MONEY_TREE_MAX_DEPTH = 30;
/** Nodes shown at most. */
export const MONEY_TREE_MAX_NODES = 500;

/** Oldest first: date, then when it was entered, then id (the reverse of `compareNewestFirst`). */
export function compareOldestFirst(a: Transaction, b: Transaction): number {
  return -compareNewestFirst(a, b);
}

/**
 * The money tree of an entry: walks "Linked to" up to the entry whose money started the chain
 * (e.g. the salary), then down through everything paid from it. Only live entries count; a
 * link to a missing (deleted) entry ends the chain there. Safe against link loops.
 * `null` if the entry isn't in `transactions`.
 */
export function moneyTree(id: string, transactions: readonly Transaction[]): MoneyTree | null {
  const byId = new Map(transactions.map((tx) => [tx.id, tx]));
  const entry = byId.get(id);
  if (!entry) return null;

  const path = [entry];
  const seen = new Set([entry.id]);
  for (let parent = entry.parentId ? byId.get(entry.parentId) : undefined; parent && !seen.has(parent.id) && path.length <= MONEY_TREE_MAX_DEPTH; parent = parent.parentId ? byId.get(parent.parentId) : undefined) {
    path.unshift(parent);
    seen.add(parent.id);
  }

  const childrenOfId = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!tx.parentId) continue;
    const list = childrenOfId.get(tx.parentId);
    if (list) list.push(tx);
    else childrenOfId.set(tx.parentId, [tx]);
  }

  // Breadth first, so a cut-off tree keeps the levels nearest the root.
  const root: MoneyTreeNode = { tx: path[0], depth: 0, children: [], left: 0 };
  const placed = new Set([root.tx.id]);
  const queue = [root];
  let size = 1;
  let truncated = false;
  for (let i = 0; i < queue.length; i += 1) {
    const node = queue[i];
    if (node.depth >= MONEY_TREE_MAX_DEPTH) continue;
    const children = [...(childrenOfId.get(node.tx.id) ?? [])].sort(compareOldestFirst);
    for (const child of children) {
      if (placed.has(child.id)) continue;
      if (size >= MONEY_TREE_MAX_NODES) {
        truncated = true;
        break;
      }
      placed.add(child.id);
      const childNode: MoneyTreeNode = { tx: child, depth: node.depth + 1, children: [], left: 0 };
      node.children.push(childNode);
      queue.push(childNode);
      size += 1;
    }
  }

  const linkedTo = (txId: string) => (childrenOfId.get(txId) ?? []).reduce((sum, child) => sum + child.amount, 0);
  // "Left" counts every linked entry, also ones a cut-off hides, so the numbers stay true.
  for (const node of queue) if (node.tx.type !== 'expense') node.left = node.tx.amount - linkedTo(node.tx.id);

  // Totals over the whole tree, not only the shown part.
  let spent = 0;
  let left = 0;
  const counted = new Set<string>();
  const stack: [Transaction, number][] = [[root.tx, 0]];
  while (stack.length > 0) {
    const [tx, depth] = stack.pop()!;
    if (counted.has(tx.id)) continue;
    counted.add(tx.id);
    if (tx.type === 'expense') spent += tx.amount;
    else left += tx.amount - linkedTo(tx.id);
    if (depth < MONEY_TREE_MAX_DEPTH) for (const child of childrenOfId.get(tx.id) ?? []) stack.push([child, depth + 1]);
  }

  return { root, path, spent, left, size, truncated };
}

/** The tree's nodes top to bottom as a list (each node before its children), skipping the children of `collapsed` ids. */
export function flattenMoneyTree(root: MoneyTreeNode, collapsed: ReadonlySet<string> = new Set()): MoneyTreeNode[] {
  const rows: MoneyTreeNode[] = [];
  const visit = (node: MoneyTreeNode) => {
    rows.push(node);
    if (!collapsed.has(node.tx.id)) node.children.forEach(visit);
  };
  visit(root);
  return rows;
}
