/**
 * App versions (`app.json` "version", e.g. `1.2.0`) and the GitHub Release tags made from them
 * (`v1.2.0`). Used by the update check (`src/lib/updates`).
 */

/** `[major, minor, patch]` from `1.2.0` or `v1.2.0`; `null` if it isn't a plain version. */
export function parseVersion(text: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

/** The version a release tag names (`v1.2.0` → `1.2.0`), or `null` for any other tag. */
export function versionFromTag(tag: string): string | null {
  const parts = parseVersion(tag);
  return parts ? parts.join('.') : null;
}

/** True when `candidate` is a later version than `current`. Unreadable versions are never newer. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const now = parseVersion(current);
  if (!next || !now) return false;
  for (let i = 0; i < 3; i += 1) {
    if (next[i] !== now[i]) return next[i] > now[i];
  }
  return false;
}

/**
 * True when the last check (ISO time) was at least `intervalMs` ago, or never happened.
 * A check "in the future" (the phone's clock moved back) counts as due.
 */
export function isCheckDue(lastCheckedAt: string | null, intervalMs: number, now: Date = new Date()): boolean {
  if (!lastCheckedAt) return true;
  const last = Date.parse(lastCheckedAt);
  if (Number.isNaN(last)) return true;
  const elapsed = now.getTime() - last;
  return elapsed < 0 || elapsed >= intervalMs;
}
