export const ACCOUNT_TYPES = ['bank', 'cash', 'mobile_wallet', 'savings'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type SavingsDetails = {
  installmentAmount: number | null;
  startDate: string | null;
  maturityDate: string | null;
  interestRate: number | null;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  /** Poisha at the start of `openingDate`. */
  openingBalance: number;
  /** "YYYY-MM-DD"; only transactions on/after this day count towards the balance. */
  openingDate: string;
  archived: boolean;
  sortOrder: number;
  savings: SavingsDetails | null;
};
