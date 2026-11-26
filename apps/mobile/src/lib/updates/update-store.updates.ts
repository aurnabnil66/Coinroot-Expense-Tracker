import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Linking, Platform } from 'react-native';

import { UPDATE_CHECK_INTERVAL_MS } from '@/lib/constants';
import { type StoredRelease, updateCheckSetting, updateStateSetting } from '@/lib/storage';
import { isCheckDue, isNewerVersion } from '@/lib/utils';

import { fetchLatestRelease, UpdateCheckError } from './latest-release.updates';

/**
 * This app's version (`app.json` "version"). It's part of the runtime fingerprint, so an OTA update
 * never changes it: it's always the installed APK's version.
 */
export const appVersion: string = Constants.expoConfig?.version ?? '';

/** New versions are APKs on GitHub Releases, so the check only runs on Android. */
export const isUpdateCheckSupported = Platform.OS === 'android';

/** The OTA update this app is running, if any (`null`: the code built into the APK). */
export type RunningUpdate = { id: string; createdAt: Date };

export function runningUpdate(): RunningUpdate | null {
  if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.updateId || !Updates.createdAt) return null;
  return { id: Updates.updateId, createdAt: Updates.createdAt };
}

export type UpdateSnapshot = {
  /** `checking` while a check runs; `error` after a check that failed (see `error`). */
  status: 'idle' | 'checking' | 'error';
  error: string | null;
  /** The newest release, when it's newer than this app. */
  available: StoredRelease | null;
  /** `available`, unless the user closed its banner with "Later". */
  banner: StoredRelease | null;
  lastCheckedAt: string | null;
  /** Check once a day by itself (Settings → App updates). */
  autoCheck: boolean;
};

let status: UpdateSnapshot['status'] = 'idle';
let error: string | null = null;
let running: Promise<StoredRelease | null> | null = null;
let snapshot: UpdateSnapshot | null = null;
const listeners = new Set<() => void>();

function buildSnapshot(): UpdateSnapshot {
  const state = updateStateSetting.get();
  const available = state.latest && isNewerVersion(state.latest.version, appVersion) ? state.latest : null;
  return {
    status,
    error,
    available,
    banner: available && available.version !== state.dismissedVersion ? available : null,
    lastCheckedAt: state.lastCheckedAt,
    autoCheck: updateCheckSetting.get(),
  };
}

function changed() {
  snapshot = null;
  listeners.forEach((listener) => listener());
}

updateStateSetting.subscribe(changed);
updateCheckSetting.subscribe(changed);

function check(): Promise<StoredRelease | null> {
  if (running) return running;
  status = 'checking';
  error = null;
  changed();
  running = fetchLatestRelease()
    .then((latest) => {
      status = 'idle';
      updateStateSetting.set({ ...updateStateSetting.get(), latest, lastCheckedAt: new Date().toISOString() });
      return latest && isNewerVersion(latest.version, appVersion) ? latest : null;
    })
    .catch((cause: unknown) => {
      status = 'error';
      error = cause instanceof UpdateCheckError ? cause.message : "Couldn't check for updates. Try again later.";
      changed();
      throw new UpdateCheckError(error);
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/**
 * New versions of the app (APKs on GitHub Releases). Small fixes arrive as OTA updates by
 * themselves; this only tells the user when a new APK has to be installed.
 */
export const updateStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): UpdateSnapshot {
    snapshot ??= buildSnapshot();
    return snapshot;
  },

  /** On start and back in the foreground: checks when it's on and the last check is a day old. Never throws. */
  checkIfDue() {
    if (!isUpdateCheckSupported || __DEV__ || !updateCheckSetting.get()) return;
    if (running || !isCheckDue(updateStateSetting.get().lastCheckedAt, UPDATE_CHECK_INTERVAL_MS)) return;
    check().catch(() => undefined);
  },

  /** Settings → Check for updates. Resolves to the newer release, or `null` when this is the newest; throws `UpdateCheckError`. */
  checkNow(): Promise<StoredRelease | null> {
    return check();
  },

  /** "Later": hides the banner until a newer version than this one is out. */
  dismiss(version: string) {
    updateStateSetting.set({ ...updateStateSetting.get(), dismissedVersion: version });
  },

  setAutoCheck(next: boolean) {
    updateCheckSetting.set(next);
  },

  /** Opens the APK in the browser, which downloads it; Android then offers to install it over this version. */
  download(release: StoredRelease): Promise<void> {
    return Linking.openURL(release.apkUrl);
  },

  /** The release's page on GitHub (what changed). */
  openNotes(release: StoredRelease): Promise<void> {
    return Linking.openURL(release.pageUrl);
  },
};
