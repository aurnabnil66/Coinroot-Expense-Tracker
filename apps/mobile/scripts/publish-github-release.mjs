// Publishes a built APK as a GitHub Release. Run by the EAS workflow `.eas/workflows/release.yml`
// after the build; Node 22, no dependencies.
//
// Environment:
//   GH_RELEASE_TOKEN  GitHub token with "Contents: Read and write" on the repository (secret)
//   GH_REPO           owner/name, e.g. aurnabnil66/Coinroot-Expense-Tracker
//   APK_PATH          the downloaded APK
//   APP_VERSION       app.json version, e.g. 1.0.0 (the release is tagged v1.0.0)
//   VERSION_CODE      Android versionCode of the build (optional, shown in the notes)
//   COMMIT            full commit SHA the build came from (optional; new tags point at it,
//                     otherwise at the default branch)
//   GH_API_URL        API base, default https://api.github.com (for testing)
//
// The APK is uploaded as `coinroot.apk`, so `releases/latest/download/coinroot.apk` always serves
// the newest one. Running it again for the same version replaces that release's APK.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ASSET_NAME = 'coinroot.apk';
const CHECKSUM_LINE = /^SHA-256 of coinroot\.apk: .*$/m;

function env(name, { optional = false } = {}) {
  let value = process.env[name]?.trim();
  // Workflow expressions can render a missing output as "null".
  if (value === 'null' || value === 'undefined') value = undefined;
  if (!value && !optional) {
    throw new Error(`${name} is not set.`);
  }
  return value || undefined;
}

const token = env('GH_RELEASE_TOKEN');
const repo = env('GH_REPO');
const apkPath = env('APK_PATH');
const version = env('APP_VERSION');
const versionCode = env('VERSION_CODE', { optional: true });
const commit = env('COMMIT', { optional: true });
const apiUrl = env('GH_API_URL', { optional: true }) ?? 'https://api.github.com';
const tag = `v${version}`;

async function github(url, { allowMissing = false, ...init } = {}) {
  const response = await fetch(/^https?:\/\//.test(url) ? url : `${apiUrl}/repos/${repo}${url}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'coinroot-release',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (response.status === 404 && allowMissing) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GitHub ${init.method ?? 'GET'} ${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

const apk = await readFile(apkPath);
const checksum = createHash('sha256').update(apk).digest('hex');
const checksumLine = `SHA-256 of coinroot.apk: \`${checksum}\``;

let release = await github(`/releases/tags/${tag}`, { allowMissing: true });

if (release) {
  console.log(`Release ${tag} exists; replacing its APK.`);
  for (const asset of release.assets.filter((a) => a.name === ASSET_NAME)) {
    await github(`/releases/assets/${asset.id}`, { method: 'DELETE' });
  }
  const body = CHECKSUM_LINE.test(release.body ?? '')
    ? release.body.replace(CHECKSUM_LINE, checksumLine)
    : `${release.body ?? ''}\n\n${checksumLine}`;
  release = await github(`/releases/${release.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ body, make_latest: 'true' }),
  });
} else {
  console.log(`Creating release ${tag}.`);
  const build = versionCode ? ` (build ${versionCode})` : '';
  release = await github('/releases', {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tag,
      ...(commit ? { target_commitish: commit } : {}),
      name: `Coinroot ${version}`,
      body: [
        `Android app${build}. Download **${ASSET_NAME}** below and open it on your phone to install or update.`,
        'Installing over an earlier version keeps your data.',
        '',
        checksumLine,
      ].join('\n'),
      generate_release_notes: true,
      make_latest: 'true',
    }),
  });
}

const uploadUrl = release.upload_url.replace(/\{.*\}$/, '');
const asset = await github(`${uploadUrl}?name=${ASSET_NAME}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/vnd.android.package-archive' },
  body: apk,
});

console.log(`Published ${asset.name} (${(apk.length / 1024 / 1024).toFixed(1)} MB) on ${release.html_url}`);
console.log(`Latest download: https://github.com/${repo}/releases/latest/download/${ASSET_NAME}`);
