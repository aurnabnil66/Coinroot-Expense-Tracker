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

/**
 * A month as calendar rows of 7 day keys, starting on `weekStartsOn` (0 = Sunday).
 * Cells before the 1st and after the last day are null.
 */
export function calendarWeeks(monthKey: string, weekStartsOn = 0): (string | null)[][] {
  const lead = (fromDateKey(`${monthKey}-01`).getDay() - weekStartsOn + 7) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth(monthKey); day += 1) cells.push(`${monthKey}-${pad(day)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** Short weekday names in calendar order, e.g. ["Sun", "Mon", …]. */
export function weekdayLabels(weekStartsOn = 0): string[] {
  // 2026-11-01 is a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    fromDateKey(`2026-11-0${1 + ((weekStartsOn + i) % 7)}`).toLocaleDateString('en-GB', { weekday: 'short' })
  );
}

/**
 * When something happened, for status lines: "today at 10:42 am", "yesterday at 9:05 pm",
 * else "3 Nov 2026 at 8:00 am" (local time).
 */
export function formatSyncedAt(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  const day = toDateKey(date);
  const today = toDateKey(now);
  if (day === today) return `today at ${time}`;
  if (day === addDays(today, -1)) return `yesterday at ${time}`;
  return `${formatFullDate(day)} at ${time}`;
}
