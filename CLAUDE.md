# Coinroot monorepo

Coinroot is a personal money tracker for one user in Bangladesh (BDT / taka), local-first, that may be open-sourced later. This repo holds the app and, later, its website and shared packages.

| Path | What |
|---|---|
| `apps/mobile/` | The Expo / React Native app. **Read `apps/mobile/CLAUDE.md` (and its `AGENTS.md`) before working there**: domain rules, data model, conventions. |
| `apps/landing-page/` | The landing page (Astro, fully static, plain CSS). Read `apps/landing-page/CLAUDE.md` before working there. |
| `packages/` | Everything shared between apps (current or future: mobile, web, desktop), one folder each, as a workspace package `@coinroot/<name>`. See **Shared packages**. |
| `packages/supabase/` | `@coinroot/supabase`: the optional cloud backend (Supabase CLI config + SQL migrations), shared by every app. The CLI runs with `--workdir packages` (it looks for `<workdir>/supabase/`); use the package's scripts. |
| `.github/workflows/` | CI (`ci.yml`: `turbo run lint typecheck test db:check build`), the Claude PR review, and `trigger-eas-workflow.yml` (optional cloud release: on a `v*` tag or by hand, runs the EAS release workflow). Releases and OTA updates normally run locally: `bun run release`, `bun run ota "…"`; see **Releases** and **OTA updates** in `apps/mobile/CLAUDE.md`. |

## Tooling

- **bun workspaces** (`apps/*`, `packages/*`) + **Turborepo** (`turbo.json`). One `bun.lock` at the root; run `bun install` at the root only. No `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`.
- `bunfig.toml` sets `linker = "hoisted"`: React Native, Metro and NativeWind expect one hoisted `node_modules`. Don't switch to isolated installs without testing a native build.
- Expo configures Metro for monorepos itself (SDK 52+): don't add `watchFolders` / `nodeModulesPaths` to `apps/mobile/metro.config.js`.
- **One React and one React Native version in the whole repo.** Any web app must use the same `react` version as the mobile app (check with `bun pm why react` / `bun pm why react-native`); pin with root `resolutions` if needed.
- Add an app dependency from its folder: `cd apps/mobile && bunx expo install <pkg>`. Repo tools (e.g. `turbo`) go in the root `package.json` as dev dependencies.
- Workspace package names are scoped `@coinroot/<name>` (`@coinroot/mobile`). Internal dependencies use `"workspace:*"`.

## Shared packages

- Anything not owned by a single app (backends, configs, shared code, types, assets, tooling meant for several apps) lives in `packages/<name>/`, never at the repo root or inside an app. New shared folders and dependencies go there too, so every shared thing has the same location.
- Each folder is a workspace package: a `package.json` named `@coinroot/<name>`, `"private": true`, `"license": "GPL-3.0-or-later"`, with its scripts. Apps depend on it with `"@coinroot/<name>": "workspace:*"`; reference its files by package name, not by relative paths into `packages/`.
- If the package has `lint` / `typecheck` / `test` / `build`, Turborepo runs them in `bun run check`; add any new task name to `turbo.json`.
- `packages/supabase`: from that folder, `bun run db:new <name>` (new migration), `bun run db:push --dry-run` then `bun run db:push` (apply to the linked project), `bun run supabase <args>` for anything else. After pushing, run `bun run db:types` in `apps/mobile`. The link state (`.temp/`) is gitignored and lives in `packages/supabase/.temp`.

## Commands (repo root)

```bash
bun install          # install everything
bun run dev:mobile   # Metro for the mobile app (or `bun start` in apps/mobile)
bun run dev:landing  # the landing page at http://localhost:4321
bun run check        # lint + typecheck + test + db:check + build in every workspace (Turborepo)
bun run release      # build the production APK locally and publish it as a GitHub Release (main only)
bun run ota "…"      # publish an OTA update to installed APKs (main only)
bun run lint | typecheck | test | db:check | build
```

Turborepo runs `lint`, `typecheck`, `test`, `db:check` and `build` in each workspace that defines them; a workspace without one says why in its own `CLAUDE.md` (the landing page has no `lint` / `test`). Run `bun run check` before calling a task done. EAS commands run from `apps/mobile`.
