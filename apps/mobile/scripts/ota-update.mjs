// bun run ota "What changed"
//
// Publishes a JavaScript-only update (EAS Update) to the `production` channel: installed APKs
// download it when they start and run it from the next start.
//
// An update only reaches APKs with the same runtime version (the fingerprint of the native code).
// So first it compares this checkout's runtime version with the latest GitHub Release's (written
// in its notes by `bun run release`), and stops when they differ: the native code changed (a new
// native library, an app.json plugin, icon or SDK change, …) and a release is needed instead.
//
// Run from a clean, pushed `main`.

import { checkGit, fail, githubToken, latestRelease, run, runtimeVersion, step } from './release-common.mjs';

const message = process.argv.slice(2).join(' ').trim();
if (!message) {
  fail('Say what changed: bun run ota "Fix the summary totals"');
}

step('OTA update');
checkGit();

const runtime = runtimeVersion();
const release = await latestRelease(githubToken({ required: false }));
if (!release) {
  fail('There is no release yet, so no APK could receive an update. Run `bun run release` first.');
}
if (!release.runtimeVersion) {
  fail(`The notes of ${release.tag} don't say its runtime version, so this update can't be checked.`);
}
if (release.runtimeVersion !== runtime) {
  fail(
    `The native code changed since ${release.tag} (runtime ${release.runtimeVersion}, now ${runtime}), ` +
      'so installed apps couldn\'t run this update. Raise "version" in app.json and run `bun run release` instead.',
  );
}
console.log(`Runtime version ${runtime} matches ${release.tag}.`);

step('Publishing the update');
run('bunx', [
  'eas-cli',
  'update',
  '--channel',
  'production',
  '--environment',
  'production',
  '--platform',
  'android',
  '--message',
  message,
  '--non-interactive',
]);

console.log(`\n✔ Update published. Apps on ${release.tag} get it the next time they start.`);
