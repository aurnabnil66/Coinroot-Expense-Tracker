// Shared by `bun run release` (release.mjs) and `bun run ota` (ota-update.mjs).

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GH_REPO = 'aurnabnil66/Coinroot-Expense-Tracker';
export const RELEASE_BRANCH = 'main';

export function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

export function step(message) {
  console.log(`\n▸ ${message}`);
}

/** Runs a command and returns its output (throws on failure). */
export function output(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: APP_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

/** Runs a command with its output shown; stops the script if it fails. */
export function run(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: APP_DIR, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) {
    fail(`${command} ${args[0]} failed (exit ${result.status ?? result.signal}).`);
  }
}

export function appJson() {
  return JSON.parse(readFileSync(path.join(APP_DIR, 'app.json'), 'utf8')).expo;
}

/** Releases and updates come only from a clean, pushed `main`, so what ships is what's on GitHub. */
export function checkGit() {
  const branch = output('git', ['branch', '--show-current']);
  if (branch !== RELEASE_BRANCH) {
    fail(`Switch to ${RELEASE_BRANCH} first (you're on ${branch || 'a detached HEAD'}).`);
  }
  if (output('git', ['status', '--porcelain'])) {
    fail('Commit or stash your changes first: the build must match a commit on GitHub.');
  }
  output('git', ['fetch', '--quiet', 'origin', RELEASE_BRANCH]);
  const head = output('git', ['rev-parse', 'HEAD']);
  if (head !== output('git', ['rev-parse', `origin/${RELEASE_BRANCH}`])) {
    fail(`Your ${RELEASE_BRANCH} isn't the same as GitHub's: pull and push first.`);
  }
  return head;
}

/**
 * A GitHub token with write access to the repo: GH_RELEASE_TOKEN or GITHUB_TOKEN, else the
 * GitHub CLI's login (`gh auth login` once).
 */
export function githubToken({ required = true } = {}) {
  const fromEnv = process.env.GH_RELEASE_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    return output('gh', ['auth', 'token']);
  } catch {
    if (!required) return undefined;
    return fail(
      'No GitHub login found. Install the GitHub CLI (`brew install gh`) and run `gh auth login`, ' +
        'or set GH_RELEASE_TOKEN to a token with "Contents: Read and write" on the repo.',
    );
  }
}

/** The runtime version (fingerprint) the APK gets and `eas update` targets, for this checkout. */
export function runtimeVersion() {
  const text = output('bunx', ['expo-updates', 'runtimeversion:resolve', '--platform', 'android']);
  const json = text.split('\n').reverse().find((line) => line.startsWith('{'));
  const version = json && JSON.parse(json).runtimeVersion;
  if (!version) fail(`Couldn't work out the runtime version:\n${text}`);
  return version;
}

export const RUNTIME_LINE = /^Runtime version: `([^`]+)`$/m;

/** The latest published release and the runtime version written in its notes. */
export async function latestRelease(token) {
  const response = await fetch(`https://api.github.com/repos/${GH_REPO}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'coinroot-release',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) fail(`GitHub: ${response.status} ${await response.text()}`);
  const release = await response.json();
  return { tag: release.tag_name, runtimeVersion: release.body?.match(RUNTIME_LINE)?.[1] ?? null };
}

/** aapt2 from the newest Android SDK build-tools, if installed. */
function aapt2() {
  const sdk =
    process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(homedir(), 'Library/Android/sdk');
  const buildTools = path.join(sdk, 'build-tools');
  if (!existsSync(buildTools)) return null;
  const newest = readdirSync(buildTools)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .pop();
  const tool = newest && path.join(buildTools, newest, 'aapt2');
  return tool && existsSync(tool) ? tool : null;
}

/** versionCode and runtime version read from a built APK (null where they can't be read). */
export function readApk(apkPath) {
  const tool = aapt2();
  if (!tool) return { versionCode: null, runtimeVersion: null };
  const badging = output(tool, ['dump', 'badging', apkPath]);
  const resources = output(tool, ['dump', 'resources', apkPath], { maxBuffer: 64 * 1024 * 1024 });
  let runtime = resources.match(/string\/expo_runtime_version[\s\S]*?"([^"]+)"/)?.[1] ?? null;
  // With the fingerprint policy the resource points at a file in the APK: "file:fingerprint".
  if (runtime?.startsWith('file:')) {
    try {
      runtime = output('unzip', ['-p', apkPath, `assets/${runtime.slice('file:'.length)}`]) || null;
    } catch {
      runtime = null;
    }
  }
  return {
    versionCode: badging.match(/versionCode='(\d+)'/)?.[1] ?? null,
    runtimeVersion: runtime,
  };
}
