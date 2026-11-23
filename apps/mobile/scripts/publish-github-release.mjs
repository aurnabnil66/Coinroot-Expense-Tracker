// Publishes a built APK as a GitHub Release. Run by the EAS workflow `.eas/workflows/release.yml`;
// Node 22, no dependencies.
//
//   node publish-github-release.mjs --check   before the build: checks the token works and that the
//                                             release can be published (reads the version from app.json)
//   node publish-github-release.mjs           after the build: publishes APK_PATH
//
// Environment:
//   GH_RELEASE_TOKEN  GitHub token with "Contents: Read and write" on the repository (secret)
//   GH_REPO           owner/name, e.g. aurnabnil66/Coinroot-Expense-Tracker
//   APK_PATH          the downloaded APK (not needed with --check)
//   APP_VERSION       app.json version, e.g. 1.0.0 (the release is tagged v1.0.0); default: app.json
//   VERSION_CODE      Android versionCode of the build (optional, shown in the notes)
//   COMMIT            full commit SHA the build came from (optional; a new tag points at it,
//                     otherwise at the default branch)
//   REPLACE           "true" to replace the APK of a release that's already published
//   GH_API_URL        API base, default https://api.github.com (for testing)
//
// The APK is published as `coinroot.apk`, so `releases/latest/download/coinroot.apk` always serves
// the newest one, and the download never disappears while a release is being made:
// - a new release is created as a draft and only published once its APK is uploaded;
// - when replacing, the new APK is uploaded under a temporary name first, then the old one is
//   deleted and the new one renamed.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ASSET_NAME = 'coinroot.apk';
const UPLOAD_PREFIX = 'coinroot-upload-';
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

async function appJsonVersion() {
  const appJson = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
  return appJson.expo.version;
}

const checkOnly = process.argv.includes('--check');
const token = env('GH_RELEASE_TOKEN');
const repo = env('GH_REPO');
const apiUrl = env('GH_API_URL', { optional: true }) ?? 'https://api.github.com';
const version = env('APP_VERSION', { optional: true }) ?? (await appJsonVersion());
const replace = env('REPLACE', { optional: true }) === 'true';
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

/** The release for this version: published, or a draft left by a run that failed. */
async function findRelease() {
  const published = await github(`/releases/tags/${tag}`, { allowMissing: true });
  if (published) return published;
  // The tag lookup doesn't return drafts.
  const releases = await github('/releases?per_page=100');
  return releases.find((r) => r.draft && r.tag_name === tag) ?? null;
}

const existing = await findRelease();

if (existing && !existing.draft && !replace) {
  throw new Error(
    `Release ${tag} is already published. For a new release, raise "version" in app.json. ` +
      'To replace its APK, run the release again with replace=true.',
  );
}

if (checkOnly) {
  console.log(
    existing?.draft
      ? `OK: will finish the draft release ${tag}.`
      : existing
        ? `OK: will replace the APK of release ${tag}.`
        : `OK: will create release ${tag}.`,
  );
  process.exit(0);
}

const apkPath = env('APK_PATH');
const versionCode = env('VERSION_CODE', { optional: true });
const commit = env('COMMIT', { optional: true });

const apk = await readFile(apkPath);
const checksum = createHash('sha256').update(apk).digest('hex');
const checksumLine = `SHA-256 of coinroot.apk: \`${checksum}\``;

let release = existing;
if (release) {
  console.log(`${release.draft ? 'Finishing draft' : 'Replacing the APK of'} release ${tag}.`);
} else {
  console.log(`Creating draft release ${tag}.`);
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
      draft: true,
    }),
  });
}

// 1. Upload under a temporary name, so the current APK stays downloadable meanwhile.
const uploadUrl = release.upload_url.replace(/\{.*\}$/, '');
const uploaded = await github(`${uploadUrl}?name=${UPLOAD_PREFIX}${Date.now()}.apk`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/vnd.android.package-archive' },
  body: apk,
});

// 2. Remove the old APK (and uploads left by failed runs), then give the new one its name.
for (const asset of release.assets ?? []) {
  if (asset.id !== uploaded.id && (asset.name === ASSET_NAME || asset.name.startsWith(UPLOAD_PREFIX))) {
    await github(`/releases/assets/${asset.id}`, { method: 'DELETE' });
  }
}
await github(`/releases/assets/${uploaded.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ name: ASSET_NAME }),
});

// 3. Publish (a draft) and mark as latest, with the new checksum in the notes.
const body = CHECKSUM_LINE.test(release.body ?? '')
  ? release.body.replace(CHECKSUM_LINE, checksumLine)
  : `${release.body ?? ''}\n\n${checksumLine}`;
release = await github(`/releases/${release.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ body, draft: false, make_latest: 'true' }),
});

console.log(`Published ${ASSET_NAME} (${(apk.length / 1024 / 1024).toFixed(1)} MB) on ${release.html_url}`);
console.log(`Latest download: https://github.com/${repo}/releases/latest/download/${ASSET_NAME}`);
