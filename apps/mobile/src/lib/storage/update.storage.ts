import { createBooleanSetting, createSetting } from './settings.storage';

/** A published version of the app, as the update check last saw it. */
export type StoredRelease = {
  /** `1.2.0` (from the tag `v1.2.0`). */
  version: string;
  /** The release's `coinroot.apk`. */
  apkUrl: string;
  /** The release's page on GitHub (notes, older files). */
  pageUrl: string;
  /** ISO time it was published, if GitHub said. */
  publishedAt: string | null;
};

export type UpdateState = {
  /** ISO time of the last check that reached GitHub. */
  lastCheckedAt: string | null;
  /** The newest release found (may be this app's own version). `null`: none published yet. */
  latest: StoredRelease | null;
  /** The version whose banner the user closed with "Later"; a newer one shows again. */
  dismissedVersion: string | null;
};

export const EMPTY_UPDATE_STATE: UpdateState = { lastCheckedAt: null, latest: null, dismissedVersion: null };

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);

function readRelease(value: unknown): StoredRelease | null {
  if (!value || typeof value !== 'object') return null;
  const release = value as Record<string, unknown>;
  const version = text(release.version);
  const apkUrl = text(release.apkUrl);
  const pageUrl = text(release.pageUrl);
  if (!version || !apkUrl || !pageUrl) return null;
  return { version, apkUrl, pageUrl, publishedAt: text(release.publishedAt) };
}

/** What the update check found, on this device only. */
export const updateStateSetting = createSetting<UpdateState>({
  key: 'update-state',
  fallback: EMPTY_UPDATE_STATE,
  read: (storage, key) => {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    try {
      const value = JSON.parse(raw) as Record<string, unknown>;
      return {
        lastCheckedAt: text(value.lastCheckedAt),
        latest: readRelease(value.latest),
        dismissedVersion: text(value.dismissedVersion),
      };
    } catch {
      return undefined;
    }
  },
  write: (storage, key, value) => storage.set(key, JSON.stringify(value)),
});

/** Settings → App updates → Check automatically (once a day). On by default. */
export const updateCheckSetting = createBooleanSetting('update-check', true);
