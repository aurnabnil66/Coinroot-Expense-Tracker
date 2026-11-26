import { describe, expect, it } from '@jest/globals';

import { fetchLatestRelease, releaseFromGitHub, UpdateCheckError } from './latest-release.updates';

const RELEASE = {
  tag_name: 'v1.2.0',
  html_url: 'https://github.com/owner/repo/releases/tag/v1.2.0',
  published_at: '2026-11-20T08:00:00Z',
  assets: [
    { name: 'notes.txt', browser_download_url: 'https://example.com/notes.txt' },
    { name: 'coinroot.apk', browser_download_url: 'https://example.com/coinroot.apk' },
  ],
};

const respond = (status: number, body?: unknown) =>
  (async () => new Response(body === undefined ? null : JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('releaseFromGitHub', () => {
  it('reads the version, APK and page', () => {
    expect(releaseFromGitHub(RELEASE)).toEqual({
      version: '1.2.0',
      apkUrl: 'https://example.com/coinroot.apk',
      pageUrl: 'https://github.com/owner/repo/releases/tag/v1.2.0',
      publishedAt: '2026-11-20T08:00:00Z',
    });
  });

  it('ignores a release without the APK or with another kind of tag', () => {
    expect(releaseFromGitHub({ ...RELEASE, assets: [] })).toBeNull();
    expect(releaseFromGitHub({ ...RELEASE, tag_name: 'nightly' })).toBeNull();
    expect(releaseFromGitHub(null)).toBeNull();
    expect(releaseFromGitHub('v1.2.0')).toBeNull();
  });
});

describe('fetchLatestRelease', () => {
  it('returns the latest release', async () => {
    await expect(fetchLatestRelease(respond(200, RELEASE))).resolves.toMatchObject({ version: '1.2.0' });
  });

  it('returns null when nothing is published yet', async () => {
    await expect(fetchLatestRelease(respond(404, { message: 'Not Found' }))).resolves.toBeNull();
  });

  it('explains failures', async () => {
    await expect(fetchLatestRelease(respond(403, {}))).rejects.toThrow('limiting requests');
    await expect(fetchLatestRelease(respond(500, {}))).rejects.toThrow('error 500');
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(fetchLatestRelease(offline)).rejects.toBeInstanceOf(UpdateCheckError);
    await expect(fetchLatestRelease(offline)).rejects.toThrow('internet connection');
  });
});
