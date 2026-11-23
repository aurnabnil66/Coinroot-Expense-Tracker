# Coinroot monorepo

Coinroot is a personal money tracker for one user in Bangladesh (BDT / taka), local-first, that may be open-sourced later. This repo holds the app and, later, its website and shared packages.

| Path | What |
|---|---|
| `apps/mobile/` | The Expo / React Native app. **Read `apps/mobile/CLAUDE.md` (and its `AGENTS.md`) before working there**: domain rules, data model, conventions. |
| `packages/` | Shared packages (none yet). Add one only when a second app actually needs the code. |
| `supabase/` | The optional cloud backend (Supabase CLI config + SQL migrations), shared by every app. Run the Supabase CLI from the repo root. |
| `.github/workflows/` | CI (`ci.yml`: `turbo run lint typecheck test db:check`) and the Claude PR review. |

## Tooling

- **bun workspaces** (`apps/*`, `packages/*`) + **Turborepo** (`turbo.json`). One `bun.lock` at the root; run `bun install` at the root only. No `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`.
- `bunfig.toml` sets `linker = "hoisted"`: React Native, Metro and NativeWind expect one hoisted `node_modules`. Don't switch to isolated installs without testing a native build.
- Expo configures Metro for monorepos itself (SDK 52+): don't add `watchFolders` / `nodeModulesPaths` to `apps/mobile/metro.config.js`.
- **One React and one React Native version in the whole repo.** A web app must use the same `react` version as the mobile app (check with `bun pm why react` / `bun pm why react-native`); pin with root `resolutions` if needed.
- Add an app dependency from its folder: `cd apps/mobile && bunx expo install <pkg>`. Repo tools (e.g. `turbo`) go in the root `package.json` as dev dependencies.
- Workspace package names are scoped `@coinroot/<name>` (`@coinroot/mobile`). Internal dependencies use `"workspace:*"`.

## Commands (repo root)

```bash
bun install          # install everything
bun run dev:mobile   # Metro for the mobile app (or `bun start` in apps/mobile)
bun run check        # lint + typecheck + test + db:check in every workspace (Turborepo)
bun run lint | typecheck | test | db:check
```

Every workspace that has them exposes `lint`, `typecheck`, `test` and `db:check` scripts so Turborepo can run them. Run `bun run check` before calling a task done. EAS commands run from `apps/mobile`.
