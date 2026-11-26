/**
 * Where new versions of the app are published: `bun run release` (scripts/release.mjs) makes a
 * GitHub Release `v<version>` with the APK as `coinroot.apk`. The update check reads the latest one.
 */
export const RELEASES_REPO = 'aurnabnil66/Coinroot-Expense-Tracker';
export const RELEASES_URL = `https://github.com/${RELEASES_REPO}/releases`;
export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
export const APK_NAME = 'coinroot.apk';
/** Always the newest release's APK (GitHub redirects it). */
export const LATEST_APK_URL = `${RELEASES_URL}/latest/download/${APK_NAME}`;

/** Automatic update checks run at most this often (on start and back in the foreground). */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
