/**
 * All money in Coinroot is integer poisha (1 taka = 100 poisha).
 * These helpers are the only place taka strings and poisha numbers meet.
 */

export const POISHA_PER_TAKA = 100;
export const TAKA_SIGN = '৳';

/**
 * Parses user-typed taka ("1,250.5", "৳ 350", "1250") into poisha.
 * Returns null for anything that isn't a plain non-negative amount with at most 2 decimals.
 * Parsing works on the digits as text, so no floating-point rounding is involved.
 */
export function parseTaka(input: string): number | null {
  const cleaned = input.replace(/[৳,\s]/g, '').replace(/^tk\.?/i, '');
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match || (match[1] === '' && !match[2])) {
    return null;
  }
  const whole = Number(match[1] || '0');
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const poisha = whole * POISHA_PER_TAKA + fraction;
  return Number.isSafeInteger(poisha) ? poisha : null;
}

/** Groups digits the Bangladeshi way: last three, then pairs (1,23,45,678). */
export function groupDigits(digits: string): string {
  if (digits.length <= 3) {
    return digits;
  }
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${lastThree}`;
}

type FormatOptions = {
  /** Prefix with the taka sign (default true). */
  symbol?: boolean;
  /** Prefix positive amounts with "+" (negative amounts always get "-"). */
  signed?: boolean;
  /** Always show two decimals instead of only when there are poisha. */
  fixedDecimals?: boolean;
};

/** Formats poisha for display: 12345650 → "৳1,23,456.50", 500000 → "৳5,000". */
export function formatTaka(poisha: number, options: FormatOptions = {}): string {
  const { symbol = true, signed = false, fixedDecimals = false } = options;
  const abs = Math.abs(Math.trunc(poisha));
  const whole = groupDigits(String(Math.floor(abs / POISHA_PER_TAKA)));
  const fraction = abs % POISHA_PER_TAKA;
  const decimals = fraction > 0 || fixedDecimals ? `.${String(fraction).padStart(2, '0')}` : '';
  const sign = poisha < 0 ? '-' : signed && poisha > 0 ? '+' : '';
  return `${sign}${symbol ? TAKA_SIGN : ''}${whole}${decimals}`;
}

/** Formats poisha as plain editable text for an amount input: 125050 → "1250.50". */
export function formatTakaInput(poisha: number): string {
  const whole = Math.floor(poisha / POISHA_PER_TAKA);
  const fraction = poisha % POISHA_PER_TAKA;
  return fraction > 0 ? `${whole}.${String(fraction).padStart(2, '0')}` : String(whole);
}

export function sumPoisha(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
