// The GitHub Release description: "What's new" (from release-notes.md, written by hand for people
// using the app) and how to install or update. Used by publish-github-release.mjs. Node, no
// dependencies.
//
// It ends with a hidden HTML comment holding "Runtime version: `…`" on its own line: GitHub doesn't
// show it, but `bun run ota` reads it to check an update matches the latest release. No build
// number or checksum: GitHub shows the APK's SHA-256 next to the file itself.

import { readFile } from 'node:fs/promises';

export const NOTES_FILE = new URL('../release-notes.md', import.meta.url);
export const RUNTIME_LINE = /^Runtime version: .*$/m;
/** Lines older releases had, removed whenever a release is published again. */
export const OLD_DETAIL_LINES = /^(?:Android build \d+|SHA-256 of coinroot\.apk: .*)\n?/gm;

/** The runtime version line inside a comment GitHub doesn't display. */
export function hiddenRuntime(runtimeLine) {
  return `<!--\n${runtimeLine}\n-->`;
}

/** `body` with its runtime version set to `runtimeLine` (hidden), and the old visible details removed. */
export function withRuntime(body, runtimeLine) {
  const cleaned = body.replace(OLD_DETAIL_LINES, '').replace(/\n{3,}/g, '\n\n').trimEnd();
  if (!runtimeLine) return cleaned;
  // Already in a comment: replace the line. Shown as a plain line (an older release): hide it.
  if (/<!--\s*\nRuntime version: /.test(cleaned)) return cleaned.replace(RUNTIME_LINE, runtimeLine);
  return `${cleaned.replace(RUNTIME_LINE, '').trimEnd()}\n\n${hiddenRuntime(runtimeLine)}`;
}

/**
 * The "What's new" text for `version` from release-notes.md: everything under its `## <version>`
 * heading. Throws with what to fix when the file, the heading or the text is missing, so a release
 * never goes out with the previous version's notes.
 */
export async function readReleaseNotes(version) {
  let text;
  try {
    text = await readFile(NOTES_FILE, 'utf8');
  } catch {
    throw new Error('apps/mobile/release-notes.md is missing. Write what\'s new under "## ' + version + '".');
  }
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, '');
  const sections = withoutComments.split(/^## +/m).slice(1);
  const section = sections.find((s) => s.split('\n', 1)[0].trim() === version);
  if (!section) {
    const found = sections.map((s) => s.split('\n', 1)[0].trim()).join(', ') || 'none';
    throw new Error(
      `apps/mobile/release-notes.md has no "## ${version}" heading (found: ${found}). ` +
        `Change the heading to ${version} and write what's new, then commit it.`,
    );
  }
  const notes = section.slice(section.indexOf('\n') + 1).trim();
  if (!notes) throw new Error(`apps/mobile/release-notes.md has nothing under "## ${version}". Write what's new.`);
  return notes;
}

/** The whole description of a new release. */
export function releaseBody({ notes, runtimeLine }) {
  return [
    "## What's new",
    '',
    notes,
    '',
    '## Install or update',
    '',
    '1. On your Android phone, download **coinroot.apk** below.',
    '2. Open it. The first time, Android asks you to allow installs from your browser: allow it, then go back.',
    '3. Tap **Install**. Installing over an earlier version keeps all your data.',
    '',
    'Small fixes arrive inside the app by themselves. When a new version like this one is out, the app shows a Download button.',
    ...(runtimeLine ? ['', hiddenRuntime(runtimeLine)] : []),
  ].join('\n');
}
