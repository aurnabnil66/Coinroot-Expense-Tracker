// The Android APK is published as a GitHub Release by the EAS release workflow
// (apps/mobile/.eas/workflows/release.yml), always as `coinroot.apk`, so the "latest" link below
// always serves the newest version without the site changing.
//
// The version, date and size are read once at build time, so the page itself makes no request to
// GitHub. Rebuild the site after a release to show the new version.

import QRCode from 'qrcode';

export const RELEASES_REPO = 'aurnabnil66/Coinroot-Expense-Tracker';
export const RELEASES_URL = `https://github.com/${RELEASES_REPO}/releases`;
export const APK_NAME = 'coinroot.apk';
export const APK_URL = `${RELEASES_URL}/latest/download/${APK_NAME}`;

export type LatestRelease =
  /** A release with the APK: show the download with its details. */
  | { status: 'available'; version: string; publishedAt: Date; sizeMb: number }
  /** GitHub couldn't be reached at build time: show the download without details. */
  | { status: 'unknown' }
  /** No release with the APK yet: show "coming soon". */
  | { status: 'none' };

interface GitHubRelease {
  tag_name: string;
  published_at: string | null;
  assets: { name: string; size: number }[];
}

export async function getLatestRelease(): Promise<LatestRelease> {
  try {
    const response = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'coinroot-landing-page',
        // Optional, for a higher rate limit in CI.
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    // 404: no release yet (or the repository isn't public).
    if (response.status === 404) return { status: 'none' };
    if (!response.ok) return { status: 'unknown' };

    const release = (await response.json()) as GitHubRelease;
    const apk = release.assets.find((asset) => asset.name === APK_NAME);
    if (!apk) return { status: 'none' };
    return {
      status: 'available',
      version: release.tag_name.replace(/^v/, ''),
      publishedAt: new Date(release.published_at ?? Date.now()),
      sizeMb: Math.round((apk.size / 1024 / 1024) * 10) / 10,
    };
  } catch {
    return { status: 'unknown' };
  }
}

/** An inline SVG QR code for the APK link, drawn at build time. */
export function apkQrSvg(): Promise<string> {
  return QRCode.toString(APK_URL, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    color: { dark: '#1e2a5eff', light: '#ffffffff' },
  });
}
