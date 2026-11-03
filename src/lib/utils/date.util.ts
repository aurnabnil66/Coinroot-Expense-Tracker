/**
 * Dates are stored as local calendar days ("YYYY-MM-DD") and months as "YYYY-MM".
 * String comparison sorts them correctly, so no Date objects are kept in data.
 */

const pad = (value: number) => String(value).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateKey(fromDateKey(value)) === value;
}

/** "Today", "Yesterday", or e.g. "Mon, 3 Nov" (with the year when it isn't this year). */
export function formatDayLabel(key: string, today: string = todayKey()): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  const date = fromDateKey(key);
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** e.g. "3 Nov 2026" */
export function formatFullDate(key: string): string {
  return fromDateKey(key).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function toMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function addMonths(monthKey: string, months: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + months, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** e.g. "November 2026" */
export function formatMonthLabel(monthKey: string): string {
  return fromDateKey(`${monthKey}-01`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/** e.g. "Nov" */
export function formatShortMonth(monthKey: string): string {
  return fromDateKey(`${monthKey}-01`).toLocaleDateString('en-GB', { month: 'short' });
}
