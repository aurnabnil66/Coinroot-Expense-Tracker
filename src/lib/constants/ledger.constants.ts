import type { AccountType, CategoryKind, TransactionType } from '@/lib/types';

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
};

/** Field labels for the From / To pickers, which mean different things per type. */
export const TRANSACTION_FIELD_LABELS: Record<TransactionType, { from: string; to: string }> = {
  expense: { from: 'Paid from', to: 'Category' },
  income: { from: 'Source', to: 'Received in' },
  transfer: { from: 'From account', to: 'To account' },
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  mobile_wallet: 'Mobile wallet',
  savings: 'Savings / DPS',
};

/** Badge colour per account type (keys of `CATEGORY_COLORS`). */
export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  bank: 'indigo',
  cash: 'emerald',
  mobile_wallet: 'pink',
  savings: 'amber',
};

/** First-time setup: what each account type is for, and the name it starts with. */
export const SETUP_ACCOUNT_OPTIONS: { type: AccountType; title: string; description: string; defaultName: string }[] = [
  { type: 'cash', title: 'Cash', description: 'Money in hand', defaultName: 'Cash' },
  { type: 'mobile_wallet', title: 'Mobile wallet', description: 'Mobile banking apps', defaultName: 'Mobile Wallet' },
  { type: 'bank', title: 'Bank account', description: 'An account you pay from or get paid into', defaultName: 'Bank Account' },
  {
    type: 'savings',
    title: 'Savings / DPS',
    description: "Money you put aside and don't spend: DPS, FDR, a savings account",
    defaultName: 'Savings (DPS)',
  },
];

/** Category names the app looks for (and creates if missing); users can rename their own. */
export const BALANCE_ADJUSTMENT_CATEGORY = 'Balance adjustment';
export const TRANSFER_FEE_CATEGORY = 'Bank Charges';

/** Section titles on the Accounts tab, in display order. */
export const ACCOUNT_TYPE_SECTIONS: { type: AccountType; title: string }[] = [
  { type: 'bank', title: 'Bank accounts' },
  { type: 'cash', title: 'Cash' },
  { type: 'mobile_wallet', title: 'Mobile wallets' },
  { type: 'savings', title: 'Savings' },
];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, { singular: string; plural: string }> = {
  expense: { singular: 'Category', plural: 'Expense categories' },
  income_source: { singular: 'Income source', plural: 'Income sources' },
};

/**
 * Swatches for category and account badges. Stored on the category as the key, so the palette
 * can change without touching data. Deep (600) tones for light mode; read them through
 * `useCategoryColors()`, which switches to `CATEGORY_COLORS_DARK` in dark mode.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  emerald: '#059669',
  teal: '#0d9488',
  cyan: '#0891b2',
  sky: '#0284c7',
  indigo: '#4f46e5',
  violet: '#7c3aed',
  fuchsia: '#c026d3',
  pink: '#db2777',
  rose: '#e11d48',
  red: '#dc2626',
  orange: '#ea580c',
  amber: '#d97706',
  lime: '#65a30d',
  slate: '#475569',
  zinc: '#52525b',
};

/** The same swatches as bright (400) tones that stay clear on the dark navy background. */
export const CATEGORY_COLORS_DARK: Record<string, string> = {
  emerald: '#34d399',
  teal: '#2dd4bf',
  cyan: '#22d3ee',
  sky: '#38bdf8',
  indigo: '#818cf8',
  violet: '#a78bfa',
  fuchsia: '#e879f9',
  pink: '#f472b6',
  rose: '#fb7185',
  red: '#f87171',
  orange: '#fb923c',
  amber: '#fbbf24',
  lime: '#a3e635',
  slate: '#94a3b8',
  zinc: '#a1a1aa',
};

export const DEFAULT_CATEGORY_COLOR = 'zinc';
