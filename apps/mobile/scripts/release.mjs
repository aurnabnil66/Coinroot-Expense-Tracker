// bun run release [--replace]
//
// Builds the production APK on this computer (`eas build --local`: free, uses the EAS signing key
// and the `production` environment variables) and publishes it as the GitHub Release
// v<app.json version> (coinroot.apk), which the website's Download button serves.
//
// Run from a clean, pushed `main` after raising "version" in app.json. --replace replaces the APK
// of a version that's already released. Needs the Android SDK and a GitHub login (`gh auth login`).

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  GH_REPO,
  appJson,
  checkGit,
  fail,
  githubToken,
  readApk,
  run,
  runtimeVersion,
  step,
} from './release-common.mjs';

const replace = process.argv.includes('--replace');
const version = appJson().version;

step(`Release v${version}${replace ? ' (replacing its APK)' : ''}`);
const commit = checkGit();
const token = githubToken();
const publishEnv = {
  GH_RELEASE_TOKEN: token,
  GH_REPO,
  APP_VERSION: version,
  REPLACE: String(replace),
};

step('Checking the release can be published');
run('node', ['scripts/publish-github-release.mjs', '--check'], publishEnv);

const runtime = runtimeVersion();
console.log(`Runtime version: ${runtime}`);

const workDir = mkdtempSync(path.join(tmpdir(), 'coinroot-release-'));
const apkPath = path.join(workDir, 'coinroot.apk');
try {
  step('Building the production APK on this computer (takes a while)');
  run('bunx', [
    'eas-cli',
    'build',
    '--platform',
    'android',
    '--profile',
    'production',
    '--local',
    '--non-interactive',
    '--output',
    apkPath,
  ]);

  step('Checking the APK');
  const apk = readApk(apkPath);
  if (apk.runtimeVersion && apk.runtimeVersion !== runtime) {
    fail(
      `The APK's runtime version (${apk.runtimeVersion}) isn't this checkout's (${runtime}), so OTA ` +
        'updates from here wouldn\'t reach it. Nothing was published.',
    );
  }
  console.log(
    apk.runtimeVersion
      ? `Runtime version matches; versionCode ${apk.versionCode}.`
      : "Couldn't read the APK's runtime version (no Android build-tools found); publishing anyway.",
  );

  step('Publishing on GitHub');
  run('node', ['scripts/publish-github-release.mjs'], {
    ...publishEnv,
    APK_PATH: apkPath,
    VERSION_CODE: apk.versionCode ?? '',
    COMMIT: commit,
    RUNTIME_VERSION: runtime,
  });
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log(`\n✔ Released v${version}. The website's Download button serves it now.`);
console.log('  Rebuild and deploy the website to update the version shown next to the button.');
