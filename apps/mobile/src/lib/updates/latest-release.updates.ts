import { APK_NAME, LATEST_RELEASE_API_URL } from '@/lib/constants';
import type { StoredRelease } from '@/lib/storage';
import { versionFromTag } from '@/lib/utils';

/** A check that didn't reach an answer; `message` is shown to the user. */
export class UpdateCheckError extends Error {
  name = 'UpdateCheckError';
}

/** How long a check may take before it gives up. */
const TIMEOUT_MS = 15_000;

type GitHubAsset = { name?: unknown; browser_download_url?: unknown };
type GitHubRelease = { tag_name?: unknown; html_url?: unknown; published_at?: unknown; assets?: unknown };

/**
 * The release GitHub returns for `releases/latest` as a `StoredRelease`, or `null` when it isn't
 * one of ours (a tag that isn't `v<version>`, or no `coinroot.apk` attached).
 */
export function releaseFromGitHub(json: unknown): StoredRelease | null {
  if (!json || typeof json !== 'object') return null;
  const release = json as GitHubRelease;
  const version = typeof release.tag_name === 'string' ? versionFromTag(release.tag_name) : null;
  if (!version || typeof release.html_url !== 'string') return null;
  const assets = Array.isArray(release.assets) ? (release.assets as GitHubAsset[]) : [];
  const apk = assets.find((asset) => asset?.name === APK_NAME);
  if (!apk || typeof apk.browser_download_url !== 'string') return null;
  return {
    version,
    apkUrl: apk.browser_download_url,
    pageUrl: release.html_url,
    publishedAt: typeof release.published_at === 'string' ? release.published_at : null,
  };
}

/**
 * Asks GitHub for the newest published release. Resolves to `null` when there is none yet (404)
 * or it has no APK; throws `UpdateCheckError` when GitHub can't be reached or says no.
 * Drafts and pre-releases are never "latest" on GitHub, so they're never offered.
 */
export async function fetchLatestRelease(fetchFn: typeof fetch = fetch): Promise<StoredRelease | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchFn(LATEST_RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
  } catch {
    throw new UpdateCheckError("Couldn't reach GitHub. Check your internet connection.");
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 404) return null;
  if (response.status === 403 || response.status === 429) {
    throw new UpdateCheckError('GitHub is limiting requests right now. Try again in an hour.');
  }
  if (!response.ok) throw new UpdateCheckError(`GitHub didn't answer (error ${response.status}). Try again later.`);
  try {
    return releaseFromGitHub(await response.json());
  } catch {
    throw new UpdateCheckError("GitHub's answer couldn't be read. Try again later.");
  }
}
