# Coinroot

Personal money tracker for one user in Bangladesh (currency: BDT / taka). It tracks where every taka comes from and where it goes across bank accounts, cash, mobile wallets and savings (DPS). Built for personal use first; may be open-sourced later, so keep the code clean and avoid hard-coding personal data.

Expo / React Native rules (versioned docs, `bunx expo install`, routing, EAS) are in AGENTS.md:

@AGENTS.md

## Core idea: money moves, it doesn't just get spent

The name comes from the "tree" of money: every expense can be traced back to its root.

```
Salary → Office bank account → Primary bank account → ATM withdrawal (→ Cash)
                                                        ├─ Transport expense
                                                        └─ remainder still in cash
```

## Domain rules (do not break these)

1. **Three transaction types only:**
   - `income`: money enters from outside (from an income source → to an account)
   - `expense`: money leaves (from an account → to a category)
   - `transfer`: money moves between the user's own accounts (from account → to account). **A transfer is never spending**, and is never counted in income/expense totals. ATM withdrawals, salary moved between banks, top-ups to a mobile wallet and DPS installments are all transfers.
2. **Money is stored as integer poisha** (1 taka = 100 poisha). Never use floats for amounts. Convert only at the UI edge (input parsing, display formatting).
3. **Balances are derived, never stored as editable numbers.** Account balance = opening balance + money in − money out, counting only transactions on/after the account's opening date.
4. **Opening balances live on the account** (`opening_balance` + `opening_date`), not as income transactions. Entering them as income would inflate that month's income.
5. **Parent links (the tree):** a transaction may have `parent_id` pointing to the transaction its money came from (e.g. CNG fare → ATM withdrawal). "Remaining" of a parent = parent amount − sum of its children. Links are optional.
6. **Savings / DPS are accounts** of type `savings`. Installments are transfers into them, profit/interest is income into them, and maturity is a transfer out. Reports should show "moved to savings this month" separately from expenses.
7. Bank charges / fees / excise duty are expenses (category: Bank Charges).

## Typical money flow (use it for defaults, seed data and test cases)

- **Office bank account**: salary, bonus and other office payments arrive here. Part of it is often left here as an emergency fund.
- **Primary bank account**: where most money is kept. DPS accounts are opened from here.
- **Cash** and **mobile wallets**: everyday spending.
- Typical month: salary → office account, most of it transferred → primary account, ATM withdrawals → Cash, transfers → mobile wallets, DPS installment primary account → DPS.

Never hard-code real bank, wallet or institution names or real amounts. Account names are whatever the user enters.

## Data model (SQLite via Drizzle, `src/lib/db/schema.database.ts`)

```
accounts       id, name, type (bank | cash | mobile_wallet | savings), opening_balance (poisha),
               opening_date, archived, sort_order
               savings extras (nullable): installment_amount, start_date, maturity_date, interest_rate
categories     id, name, kind (expense | income_source), icon, color, archived
transactions   id, date, type (income | expense | transfer), from_id, to_id, amount (poisha),
               note, parent_id (nullable → transactions.id), received_from (nullable, income only: who paid),
               created_at, updated_at
```

`from_id` / `to_id` point to an account or a category/income source depending on type:
- income: from = income source, to = account
- expense: from = account, to = expense category
- transfer: from = account, to = account (must differ)

Default seed data:
- Accounts: generic, editable placeholders, one per type: e.g. "Bank Account", "Cash", "Mobile Wallet", "Savings (DPS)". The user renames or adds their own.
- Expense categories (`DEFAULT_CATEGORIES` in `ledger.constants.ts`, with colours): Food, Groceries, Transport, Rent, Bills, Mobile & Internet, Shopping, Fitness, Bank Charges, Health, Education, Family, Entertainment, Gifts, Other
- Income sources: Salary, Bonus, Office Payment, Client Payment, Interest/Profit, Freelance, Gift Received, Other Income
- "Balance adjustment" (expense and income source) and "Bank Charges" are looked up by name (`findCategoryByName`) and created if missing; users may rename their own.

Accounts, categories and income sources are **user data in the database**, never hard-coded constants. The lists above are only first-launch seed rows. Every from/to field is a picker (dropdown) over those tables, with a "+ New category / account" option that creates the item inline and selects it. Shop or place names go in `note`, and clients / payers in `received_from` ("Received from", `receivedFrom` in code), not in categories.

## Architecture: local-first

- All data lives on the device in SQLite, the source of truth. The app must work fully offline; no feature may require a server.
- Backup / restore: a JSON file of every live row, shared to any cloud storage or file app and restored from a picked file (done). Spreadsheet import (CSV or a pasted table, any layout) and CSV export are done too.
- Cloud backup / sync (done) is optional, with Supabase (Auth + Postgres with RLS), mirroring the local tables: see **Cloud sync** and **Cloud tables** under Conventions. Signing in stays optional; signed out, nothing leaves the phone.

## Tech stack

Installed: Expo SDK 58, Expo Router (routes in `src/app/`), TypeScript (strict), Reanimated, Gesture Handler, and:

| Need | Library |
|---|---|
| Styling / theme | NativeWind v4 (`nativewind`, `react-native-css-interop`, `tailwindcss` v3) + vendored gluestack-ui v5 (`@gluestack-ui/core`, `@gluestack-ui/utils`, `@expo/html-elements`, `react-native-svg`) |
| Forms / validation | `react-hook-form` + `zod` v4 + `@hookform/resolvers` (zod also validates CSV rows on import) |
| Database | `expo-sqlite` + `drizzle-orm`; `drizzle-kit` (dev) generates migrations; `babel-plugin-inline-import` bundles their `.sql` files (`babel.config.js`, `sql` in Metro `sourceExts`); `expo-crypto` `randomUUID` for row ids |
| Lint | ESLint 9 + `eslint-config-expo` (`eslint.config.js`) |
| Tests | Jest via `jest-expo` (`bun run test`) |
| Bottom sheets | `@legendapp/motion` (needed by gluestack `actionsheet`) |
| Font | `expo-font` config plugin embedding Poppins from `assets/fonts` |
| Small local settings | `react-native-mmkv` v4 (+ `react-native-nitro-modules`), wrapped by `src/lib/storage`. Device-only, never synced. Native code: needs a dev-client build, not Expo Go. |
| Profile photo | `expo-image-picker` (library only; camera and microphone permissions disabled in `app.json`) + `expo-file-system` + `expo-image` |
| Spreadsheet import / export | `papaparse` (CSV and pasted tab-separated tables, separator detected; `toCsv` for the export) + `expo-document-picker` / `expo-sharing` |
| Backup / restore | `expo-sharing` (share sheet for the backup file; its config plugin is in `app.json` with receiving shares off) + `expo-document-picker` (pick a file to restore) + `expo-file-system` |
| Icons | gluestack `Icon` (lucide-style SVGs) in the UI; `expo-symbols` `SymbolView` for tab icons (SF Symbols on iOS, Material Symbols on Android/web) |
| Sign-in (optional) | `@supabase/supabase-js` (Supabase Auth, email + password) + `expo-secure-store` (holds the key of the encrypted MMKV instance the session lives in; config plugin in `app.json`) |

Planned (add with `bunx expo install` when the feature needs it, then move it to the table above):

| Need | Library |
|---|---|
| Dates | `date-fns` |
| App lock | `expo-local-authentication` |
| Small app state (only if needed) | Zustand. Prefer DB live queries as the source of truth. |

Do not upgrade to Tailwind v4 / NativeWind v5 until they are stable.

## Folder structure

`src/app/` is routing only. All other code lives in `src/lib/<layer>/`. Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.

Expo Router treats **every** `.ts`/`.tsx` file under `src/app/` as a route (no naming convention or `(group)` folder excludes one), so never put non-route files there.

| Dir | Purpose |
|---|---|
| `src/app/` | Expo Router routes and layouts only |
| `src/lib/screens/<name>/` | Full-page screens, grouped by feature: `setup/`, `transactions/`, `accounts/`, `summary/`, `settings/`, `profile/`, `auth/`. Nothing sits directly in `src/lib/screens/`. |
| `src/lib/components/` | Reusable, feature-aware pieces that aren't screens (`TransactionRow`, `TransactionTypeIcon`, `SpendingChart`, `QuickAdd`, `LedgerPending`, `GreetingHeader`, `DatabaseGate`) |
| `src/lib/ui/` | Reusable, feature-agnostic UI components, built from gluestack-ui + `className`: `Button` (the only button), `TextField` (the only text input), layout (`ScreenContainer`, `ScreenHeader`), `AppTabs`, `Card` / `GradientCard`, rows (`ListRow` with `tone="danger"`, `SwitchRow inCard`), `IconBadge` (tinted icon square for settings rows) + extra lucide icons in `app-icons.ui.tsx`, form fields, `SelectField` bottom-sheet picker, `Dialog` + `useDialog`, `Calendar`, `Avatar` / `AvatarPickerField`, `LinkPrompt`, `BarChart`, `Fab`, loading pieces (`Skeleton`, `LoadingState`, `ErrorState`, `ButtonLoader`) |
| `src/lib/hooks/` | Shared hooks (`useLedger`, `useLedgerQuery`, `useColorScheme`, `useThemePreference`, `useSimpleMode`, `useProfile` / `useGreeting`, `useAuth`, `useSyncStatus`, `useAutoFocus` / `focusInput`, `useRipple`) |
| `src/lib/constants/` | Static values (`ledger.constants.ts`: labels, account/category colours; `theme.constants.ts`: `BottomTabInset`, `MaxContentWidth`, `FontFamily`) |
| `src/lib/schemas/` | Zod schemas, their inferred types and form defaults |
| `src/lib/types/` | Domain types (`Account`, `Category`, `Transaction`), matching the data model above |
| `src/lib/spreadsheet/` | Spreadsheet import / export, pure and tested (`*.spreadsheet.ts`, see **Spreadsheet import** below): `table` (`parseTable`, `unreadableFileReason`, `toCsv`), `values` (amount / date / type cells), `columns` (`guessHeaderRow`, `guessColumns`, `IMPORT_FIELDS`), `rows` (`readRows` → draft rows + row problems), `plan` (`neededNames`, `buildImport`, `findDuplicates`, `withoutDuplicates`), `assess` (`notATableReason`, `importQuestions`, `isConfident`, `sheetColumns`, `assignColumn`), `export` (`transactionsToCsv`). No database or native imports. |
| `src/lib/storage/` | Device-only settings in MMKV (`settings.storage.ts`: `createSetting`, `createEnumSetting`, `createBooleanSetting` with in-memory cache + listeners, safe when storage is unavailable). `setup.storage.ts` holds `setupStateSetting` (whether first-time setup is done). `sync.storage.ts` holds `syncStateSetting` (the account whose records the phone syncs with, pull cursors, last sync time). `profile.storage.ts` holds the profile (`nickname`, `photo` URI, `email`, `phone`; an old `name` is read as the nickname) and `saveProfile`, which copies a picked photo into `Paths.document/profile/` (expo-file-system) and deletes the old one. Hooks such as `useThemePreference` / `useSimpleMode` define their setting here and read it with `useSyncExternalStore`. Tests mock `react-native-mmkv`. |
| `src/lib/utils/` | Pure logic with unit tests: `money.util.ts` (parse/format taka ↔ poisha), `date.util.ts` (`YYYY-MM-DD` day keys), `greeting.util.ts` (`greetingFor`, `initialsOf`), `phone.util.ts` (`normalizeBdPhone` → `+8801XXXXXXXXX`, `formatBdPhone`), `ledger.util.ts` (balances, remaining, monthly summary, daily/monthly spending, day grouping and paging, `moneyTree` / `flattenMoneyTree` / `compareOldestFirst`); `date.util.ts` also has `formatSyncedAt` ("today at 10:42 am") |
| `src/lib/supabase/` | Supabase, optional (`*.supabase.ts`): `config` (`supabaseConfig` / `isCloudConfigured` from `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; without them sign-in is off and everything else works), `client` (`getSupabase()`, created on first use, PKCE flow, auto-refresh only while the app is active), `web-crypto` (`installWebCrypto()`: `crypto.getRandomValues` / `crypto.subtle.digest('SHA-256')` from expo-crypto where Hermes lacks them, so PKCE uses a secure verifier and an S256 challenge), `session-storage` (the session in an AES-256 encrypted MMKV instance `coinroot.auth`, its random key in SecureStore; memory only if that fails), `auth-store` (`authStore`: `signUp` → `{ session }` (`null` while the email is unconfirmed), `signIn`, `signOut` (this phone only), `sendPasswordReset`, `openLink` (redeems an email link's code; `purpose` confirm / recovery), `updatePassword`; failures throw `AuthError` with a user-facing message; `{ userId, email }` is mirrored into a plain MMKV setting so `useAuth()` reads it synchronously, kept current by `onAuthStateChange`), `account-profile` (`readAccountProfile` / `profileFromAccount`, tested: the nickname and phone live on the account's `user_metadata`; at log-in the profile on the phone becomes the account's nickname, sign-in email and phone, blank where the account has none; the photo is kept only when the phone's profile already had this account's email), `auth-messages` (`authErrorMessage`: error code → message, tested), `auth-link` (`authLinkParams` / `readAuthLink`: reads an email link's query + fragment; only `?code=` (+ `sb_flow_id`) counts, tokens in a link are ignored; tested), `sync-remote` (`supabaseSyncRemote`: the cloud tables as a `SyncRemote`), `sync-store` (`syncStore`: runs `syncLedger` for the signed-in account on start, log-in, 3 s after a ledger change, back in the foreground and Settings → Cloud sync; one at a time; status `off` / `idle` / `syncing` / `error` / `blocked` for `useSyncStatus()`; `syncWithin(ms)` for log-out and log-in during setup), `database` (generated types of the cloud tables, `Database`; never edit by hand: run `bun run db:types` after pushing a migration; the client is `CoinrootSupabase` = `SupabaseClient<Database>`). |
| `src/lib/mocks/` | **Temporary** stand-ins: `sample-data.mock.ts`: invented sample accounts and history (current month plus five earlier months; generic names, invented amounts) that "Explore with sample data" writes into the database once. |
| `src/lib/gluestack-ui/` | Vendored gluestack-ui components, one folder each. Owned, editable code. |
| `src/global.css` | The only global stylesheet and the NativeWind entry (`@tailwind` directives + font variables) |
| `assets/` | Images, icons and fonts (repo root) |

New layers follow the same `src/lib/<layer>/*.<suffix>.ts(x)` shape with their own barrel.

**Database layer (`src/lib/db/`, `*.database.ts`):** (not `*.db.ts`: Expo's Metro config treats `.db` as an asset extension, so `./client.db` wouldn't resolve)
- `schema.database.ts`: Drizzle tables `accounts`, `categories`, `transactions` (snake_case columns, camelCase fields) matching the data model. Sync-ready: UUID text `id` (the app always sets it with `newId()`), ISO `created_at` / `updated_at`, and `deleted_at` (set instead of deleting). Money is integer poisha, dates `YYYY-MM-DD` text, booleans `integer` (`mode: 'boolean'`). Check constraints: allowed `type` / `kind` values, `amount > 0`, `from_id <> to_id`. No foreign keys (from/to point at accounts or categories, and synced rows may arrive in any order). It must not import native modules: drizzle-kit loads it in Node.
- `id.database.ts`: `newId()` (expo-crypto UUID v4). `client.database.ts`: the one connection (`coinroot.db`, `enableChangeListener: true` for `useLiveQuery`, WAL) and `db`.
- `setup.database.ts`: `whenDatabaseReady()` runs the migrations, then `seedDefaultCategories()`, once per app start (a shared promise; retried after a failure). Anything touching the database awaits it; `useDatabaseSetup()` (→ `preparing` / `ready` / `error`) drives `DatabaseGate`.
- `ledger-store.database.ts`: `ledgerStore` (`subscribe` / `getSnapshot` for `useLedger`, `load`, and every write: `addTransaction`, `updateTransaction`, `deleteTransaction`, `addAccount`, `updateAccount`, `addCategory`, `updateCategory`, `completeSetup`, `loadSampleData`, `resetSetup`), plus `LedgerSnapshot` / `LedgerStatus` and the `*Input` types. The snapshot holds only accounts, categories, `setupDone` and a `version` that goes up after every load and write.
- `queries.database.ts`: the read queries screens use, each returning only what one screen shows and each matching a tested function in `ledger.util.ts` run on the full list: `getRecentDays` (list pages = `takeDays(groupByDay(all))`), `getTransactionsBetween` (month / range, optionally one account), `getAccountBalances` (SQL sums), `getMonthlySpending`, `getAccountTransactions` (history pages), `getRecentTransactions` (Quick add's last 100), `getReceivedFromNames`, `getLinkableParents` (newest 30, always keeping the current link), `getTransaction`, `getChildren`, `getChildTotals` + `remainingFrom`, `countChildren`, `countTransactions`, `getMoneyTree` (walks "Linked to" up one lookup per step, then reads every live entry below the root with one recursive CTE, and builds the tree with `moneyTree` on just those rows). They take the database as a parameter (`LedgerDatabase`, any sync Drizzle SQLite db). Order is always `compareNewestFirst` (date, created_at, id).
- `import.database.ts`: `saveImport(db, plan)` adds a spreadsheet import's new accounts (after the existing ones), categories and transactions in one transaction; nothing existing changes. `ledgerStore.importSpreadsheet(plan)` wraps it; `ledgerStore.exportSpreadsheet()` returns every live transaction as CSV text.
- `backup.database.ts`: `readBackup(db)` (every live row, oldest first, as a `Backup`; a `parentId` pointing at an entry not in the file, e.g. one sync couldn't store yet, is written as `null` so the file always passes `checkBackup`) and `restoreBackup(db, backup)`: in one transaction, marks every current row deleted, then upserts each backup row by id (so restoring your own backup brings the same rows back) with a fresh `updated_at`. `ledgerStore.exportBackup()` / `ledgerStore.restoreBackup()` wrap them (restore finishes setup when the backup has accounts).
- `sync.database.ts`: cloud sync engine (tested in `sync.database.test.ts` with two in-memory phones and a fake server that behaves like the cloud tables). `syncLedger(db, remote, { userId, cursors })` pulls each table (categories, accounts, transactions) by `server_updated_at` (keyset `(server_updated_at, id)`, starting 2 min before the last cursor), then pushes pending rows, each once per sync, paged by id (upsert on `(user_id, id)` returning `id, updated_at` of the rows the server stored: the phone adopts that `updated_at`, in case the server clamped it; a row not returned lost to a newer edit elsewhere, stays pending, is counted in `overwritten`, and the next pull brings the winner). A row is pending while `synced_updated_at` (what the cloud last confirmed; device-only column, not in backups) differs from `updated_at`, so every write that bumps `updated_at` is picked up; a row deleted before it ever synced isn't uploaded. Pulled rows replace local ones only when newer (`updated_at`); timestamps are normalised to the phone's ISO form. A pulled category with the same kind + name as never-synced local ones replaces all of them (entries are moved over), so a second phone's default categories don't double; accounts are never merged by name. Each pulled row is applied in its own savepoint: a row the phone can't store (a CHECK, a missing id, a bad timestamp) is rolled back alone and reported in `skipped` (table, id, a readable reason from `skipReason`, and date / amount / name / note), and the pull moves on. The list is kept in `syncStateSetting.skipped` (max 200) and passed back as `retry`: every sync fetches those rows by id (`SyncRemote.fetch`) and tries again, so a row behind the cursor isn't lost; rows gone from the cloud drop off. Entries linked to a skipped one keep their `parent_id`. Settings → Cloud sync shows "N from the cloud left out" and, when tapped, lists them. `SyncRemote` is the cloud side (`supabaseSyncRemote` in `src/lib/supabase`). Also `hasLedgerData`, `pendingCount`, `prepareForNewAccount`.
- `seed.database.ts`: `seedDefaultCategories()` (only while the table has never had a row, so removed categories never come back), `seedSampleData(sample)` (once: skipped while live accounts exist), `clearLedgerData()` (soft-deletes accounts and transactions for "Set up accounts again"; categories stay), `ledgerCounts()`. Sync drizzle API (`.all()`, `.run()`, `db.transaction((tx) => …)`).
- `seed-rows.database.ts` (pure, tested): `defaultCategoryRows` from `DEFAULT_CATEGORIES` (`src/lib/constants`), and `sampleRows`, which gives sample rows new UUIDs, rewrites from / to / parent links and reuses existing categories by kind + name. `mappers.database.ts` (tested): `rowToAccount` / `accountToRow` (savings details ↔ flat columns), `rowToCategory`, `rowToTransaction` and back.
- `migrations/`: generated by `bun run db:generate` after a schema change (never edit by hand; commit them). `bun run db:check` checks they're consistent. `drizzle.config.ts` (root) points drizzle-kit here.
- Tests run in Jest without a device: `schema.database.test.ts`, `seed-rows.database.test.ts`, `backup.database.test.ts` (round trips, restoring onto other data, large restores, file checks) and `queries.database.test.ts`, which uses `createTestDatabase()` (`testing.database.ts`, test-only, not in the barrel: the real migrations on an in-memory `better-sqlite3` database, a dev dependency), fills it with the sample data plus ~2,000 generated entries (links, deleted rows, odd "Received from" spellings) and checks every query against the JS function on the full list. Importing `client.database.ts` in a test would open expo-sqlite, so tested code takes the database or plain data as a parameter.

**Data access:** never load every transaction (with ~50k rows, about 10 years, that took ~5 s on a debug build; now startup is ~20 ms and a save ~30 ms plus the open screens' queries). `useLedger()` gives `status`, `error`, `setupDone`, accounts, categories and `version`. Transactions come from `useLedgerQuery((database) => getRecentDays(database, limit), [limit])` (`src/lib/hooks`), which runs a query from `queries.database.ts` during render and re-runs it when `version` or its plain-value `deps` change. Writes go through `ledgerStore.*` from `@/lib/db`: async, throw on failure, new UUIDs and `updated_at`, soft deletes (deleting a parent unlinks its children), then the lists are re-read and `version` goes up. `setupDone` comes from `setupStateSetting` (`none` → setup; `own` / `sample` → app). Balances and totals are never stored: computed in SQL (`getAccountBalances`, `getMonthlySpending`) or with `ledger.util.ts` on the few rows a query returns (e.g. `monthlySummary` on one month).

## File naming

- All filenames are kebab-case, with a suffix naming their layer: `*.screen.tsx`, `*.component.tsx`, `*.ui.tsx`, `*.hook.ts`, `*.constants.ts`, `*.schema.ts`, `*.types.ts`, `*.util.ts`, `*.mock.ts`, `*.database.ts`, `*.spreadsheet.ts`.
- Unit tests sit next to the file as `*.test.ts` (not in barrels) and import `describe`/`it`/`expect` from `@jest/globals` (TypeScript 6 doesn't load `@types/jest` globals).
- Platform variants keep the suffix before the platform extension: `use-color-scheme.hook.web.ts`.
- Exceptions: `index.ts` barrels, `_layout.tsx` and route files in `src/app/`, and everything in `src/lib/gluestack-ui/` (the CLI's own `index.tsx` per component; don't rename).
- Export names: screens are `PascalCase` with a `Screen` suffix (`transactions.screen.tsx` → `TransactionsScreen`), hooks are `useX` (`use-ledger.hook.ts` → `useLedger`), UI components are `PascalCase` named exports, constants are `PascalCase` or `UPPER_SNAKE_CASE`.

## Barrels (`index.ts`)

- Every `src/lib/` layer has an `index.ts` with `export * from './x.<suffix>'` lines in alphabetical order. Consumers import from the layer: `import { Spacing } from '@/lib/constants'`. When adding a file, add its line to the barrel.
- Inside a layer, import siblings by relative path (`./field-shell.ui`), not through the layer's own barrel.
- `AppTabs` is the only default export: `export { default as AppTabs } from './app-tabs.ui'`.
- Never re-export `.web` files; Metro picks them automatically.
- No barrels in `src/lib/screens/<name>/` or `src/lib/gluestack-ui/`. Import those by full path:
  `import { TransactionsScreen } from '@/lib/screens/transactions/transactions.screen'`, `import { Button, ButtonText } from '@/lib/gluestack-ui/button'`.

## Routes (`src/app/`)

- Tabs live in the `(tabs)` group (`(tabs)/_layout.tsx` re-exports `AppTabs`) under a root `Stack`. Screens that aren't tabs (modals, add/edit forms, detail pages) sit next to `(tabs)` at the `src/app/` root and get a `<Stack.Screen>` entry in the root layout. `AppTabs` (headless `expo-router/ui` tabs, one implementation for all platforms) lists its tabs in `TABS`, so a non-tab route must not sit inside `(tabs)`.
- Route files only re-export the screen. No logic, hooks or styling:
  ```tsx
  // src/app/(tabs)/index.tsx
  export { TransactionsScreen as default } from '@/lib/screens/transactions/transactions.screen';
  ```
- Current routes:
  - Tabs: `(tabs)/index` (Transactions), `(tabs)/accounts`, `(tabs)/summary`, `(tabs)/settings`.
  - Pushed with the native header: `transaction/[id]`, `money-tree/[id]`, `account/[id]`, `categories?kind=`. Screens set their title / Edit button with `<Stack.Screen options>`.
  - Modals (own `ModalHeader`): `transaction-form?id=|parentId=|type=&fromId=&toId=` (the last is a quick-add preset), `account-form?id=|name=`, `category-form?id=|kind=`, `balance-check?accountId=`, `import` (spreadsheet import), `profile-form` (create / edit profile), `log-in`, `sign-up`.
  - `auth-callback`: opened by email links (`coinroot://auth-callback?code=…&sb_flow_id=…`, or `?error=…`). Outside both `Stack.Protected` groups, so it works during setup too. Auth uses **PKCE**: the code only redeems together with the secret this phone stored when it asked for the email (sign-up / reset), so a link this phone didn't ask for can't sign it in (never accept tokens from a link: a crafted `#access_token=…` link would sign into someone else's account and sync would upload the ledger to it). A link opened on another phone says so (the email is still confirmed: log in). It also reads the fragment through `Linking.useLinkingURL()` (errors can arrive there), then shows "Email confirmed" or the New password form.
  - `setup`: first-time setup. The root `Stack` wraps the app in `<Stack.Protected guard={setupDone}>` and `setup` in `guard={!setupDone}`, so finishing (or resetting) setup switches screens automatically.
- The root `src/app/_layout.tsx` imports `@/global.css` and owns `GluestackUIProvider` (outermost, `mode={themePreference}`), the react-navigation `ThemeProvider` (gluestack colours + Poppins fonts), the `StatusBar`, `DialogProvider` and the root `Stack`, wrapped in `DatabaseGate` (`src/lib/components`), which prepares the database first (migrations + default categories): spinner → error with Try again → app.

## Styling

- Use gluestack-ui components (`Box`, `VStack`, `HStack`, `Text`, `Heading`, `Input`, `Pressable`, `Icon`, `Divider`) with Tailwind `className`, not `StyleSheet.create`.
- **Buttons:** always `Button` from `@/lib/ui` (`button.ui.tsx`), never gluestack's `Button` / `ButtonText` directly, and no hand-made `Pressable` + `Text` links. Props: `label`, `onPress`, `variant` (`solid` default · `soft` · `outline` · `ghost` · `link`), `color` (`primary` default · `danger` · `muted`), `size` (`sm` pill h-11 · `md` default h-12 · `lg` h-14 for full-screen flows; for links only the text size), `icon`, `loading` (spinner + disabled), `loadingLabel`, `disabled`, `className` for layout (margins, `flex-1`, `self-start`; conflicting classes override). Examples: submit `<Button label="Save" loading={isSubmitting} onPress={…} />`, delete `variant="ghost" color="danger"`, inline link `variant="link"`. Dialog actions map onto it (`ACTION_STYLES`). Chips, tiles and list rows stay `Pressable`. Dynamic numeric values with no Tailwind token (e.g. `MaxContentWidth`, `BottomTabInset`) go in `style` next to `className`.
- Theme colours are CSS variables in `src/lib/gluestack-ui/gluestack-ui-provider/config.ts` (`--primary`, `--background`, `--muted`, `--destructive`, …), mapped to Tailwind colours in `tailwind.config.js`. Use `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, never raw hex.
- **Theme setting:** Settings → Preferences → Theme offers Light / Dark / Device default (the default). `useThemePreference()` / `setThemePreference()` (`src/lib/hooks`) save it in MMKV (`src/lib/storage`), and the root layout passes it to `GluestackUIProvider mode`. NativeWind then sets the native appearance too, so alerts and the keyboard follow.
- **Design (Android-first, modern):** navy + purple brand with a light-blue accent (`sky`). Light mode: lavender-white page (`bg-background`), white cards, purple `primary`. Dark mode: deep-navy page, navy cards, lighter purple `primary`.
  - Headline numbers sit on a `GradientCard` (navy → purple, `--hero-start` → `--hero-end`) with white text (`AmountText tone="onHero"`) and `GradientStat` tiles.
  - Cards (`Card`, `GradientCard`, grouped lists, skeletons) are `rounded-xl` (stat tiles inside gradient cards `rounded-lg`) with a soft navy shadow in light mode. Inputs and pickers are `h-14 rounded-2xl`. Icon badges are rounded squares.
  - **Tab bar:** a floating pill (`bg-tab-bar`: white with a border in light mode, navy in dark) centred above the bottom safe area. Inactive tabs are round icon buttons (`bg-tab-item`), and the active tab expands into a soft purple pill (`bg-primary/15`) with a purple icon + label (animated with Reanimated `LinearTransition`). Icons are `SymbolView` from `expo-symbols` (SF Symbols on iOS, Material Symbols on Android/web). Screens scroll under it; reserve `BottomTabInset` + safe-area bottom.
  - **Shadows on Android:** `style.borderRadius` on gluestack `Box` is ignored, so round shapes use `rounded-*` classes. A pressable with `android_ripple` gets its shadow from an outer view: the FAB uses native `elevation` + `shadowColor` on a `rounded-full bg-primary` wrapper.
  - Pressables get a Material ripple via `android_ripple={useRipple()}`. The add button is a round "+" FAB (icon only, with an accessibility label). On list tabs the title and hero card stay pinned and only the list scrolls (`ScreenContainer header`, or a fixed block above a `SectionList`). Segmented controls use filled pills (`selectedClass`, e.g. `bg-expense` / `bg-income` / `bg-transfer` for the type switch).
  - Money colours are only for meaning: `text-income` (green), `text-expense` (rose), `text-transfer` (blue). They're deep (600) in light mode and bright (400) in dark mode. Tinted backgrounds are `bg-x/20 dark:bg-x/25` so they stay visible on navy. Expense amounts show as `-৳…` in the normal text colour; income as `+৳…` in green.
  - Filled pills (`SegmentedControl`) use white text in light mode and dark text (`dark:text-primary-foreground`) on the brighter dark-mode colours.
  - Gradients and shadows use React Native's built-in `experimental_backgroundImage: linear-gradient(...)` and `boxShadow` styles (no gradient library).
- **Font: Poppins** (400 / 500 / 600 / 700, OFL licence in `assets/fonts`), embedded at build time by the `expo-font` plugin in `app.json` as one family, so `font-normal` … `font-bold` pick the matching face. Tailwind's `font-sans` / `font-body` / `font-heading` map to it. Props that can't take `className` (navigation header, tab labels) use `FontFamily` from `@/lib/constants`. Raw `TextInput`s need `font-sans`. Don't use weights other than these four: never `font-extrabold` / `font-black` (Tailwind maps them to 700 anyway), use `font-bold`. Screen titles and large headline amounts (`text-4xl`+) are `font-semibold` (`AmountText weight="semibold"`), since Poppins Bold looks too heavy at that size. Changing fonts needs a new native build.
  - Poppins has no ৳ glyph (it falls back to the system font) and only proportional digits, so `tabular-nums` has no effect.
- Props that can't take `className` (tab icons, navigation header, `placeholderTextColor`, `Switch`) get hex values from `useGluestackColors()`. Per-item colours (category / account swatches) are keys into the palette from `useCategoryColors()` (`CATEGORY_COLORS` deep tones in light mode, `CATEGORY_COLORS_DARK` bright tones in dark), applied via `style`. Never read `CATEGORY_COLORS` directly for display.
- Add components with `bunx gluestack-ui@latest add <component> --use-bun`. The output lands in `src/lib/gluestack-ui/<component>/`. The CLI is alpha. After adding:
  - install any dependency it skipped (it skipped `@legendapp/motion` for `actionsheet`).
  - check `bunx tsc --noEmit`. `button`, `input` and `actionsheet` needed `as any` casts on the `cssInterop` `nativeStyleToProp` object.
  - delete any stray root `globals.css` it creates.
  - make sure it didn't change `tailwind.config.js`, `babel.config.js` or `metro.config.js`.
- Config files: `tailwind.config.js`, `postcss.config.js`, `babel.config.js` (`jsxImportSource: 'nativewind'` + `nativewind/babel`, `inline-import` for `.sql`), `metro.config.js` (`withNativeWind`, input `./src/global.css`; `wasm` added to `assetExts` for expo-sqlite on web, `sql` to `sourceExts` for migrations), `drizzle.config.ts`, `nativewind-env.d.ts`, `gluestack-ui.config.json`.

## Forms

React Hook Form + Zod via `zodResolver` from `@hookform/resolvers/zod`.

- **Schema first:** each `src/lib/schemas/*.schema.ts` exports the schema, its `z.infer` type and a `defaults` object. Validation messages and types come only from the schema, never from the `rules` prop. Put `.trim()` and other normalisation (e.g. taka → poisha) in the schema, since `onSubmit` receives the schema's output.
- **Always `<Controller>`, never `register()`.** React Native's `TextInput` has no DOM ref.
- **Text inputs:** always `TextField` from `@/lib/ui` (`text-field.ui.tsx`), never gluestack `Input` / `InputField` directly. `type` sets the behaviour: `text` (default) · `nickname` · `email` · `password` / `new-password` (hidden, show / hide button, autofill) · `phone` · `money` (decimal keypad) · `search` (search icon). Other props: `label` (optional), `error`, `hint`, `placeholder`, `multiline`, `maxLength`, `autoFocus`, `readOnly`, `icon`, `suggestions` (chips of earlier values), `size` (`md` h-14 · `sm` h-12), `className`. Single-line text is vertically centred (Android font padding off) and the cursor / selection are purple. The big centred amount input stays `AmountField`; pickers are `SelectField` / `DateField`.
- **Keyboard must always open:** tapping anywhere on a field (padding, edges, the ৳ sign, the space around the amount) focuses it through `focusInput()` (`src/lib/hooks/use-auto-focus.hook.ts`), which re-focuses an input that's still focused after Back closed the keyboard (a plain `focus()` would leave it closed on Android). `autoFocus` goes through `useAutoFocus(ref)`, which waits for the screen / modal to finish sliding in (`AUTO_FOCUS_DELAY_MS`); never pass the native `autoFocus` prop to a `TextInput`. Any new raw `TextInput` needs both.
- **Field UI and form wiring stay separate.** Field components in `src/lib/ui` (e.g. a text field, amount field or account picker) take plain `label` / `value` / `onChangeText` / `onBlur` / `error` props and import nothing from `react-hook-form`. The `<Controller>` lives in the screen. Don't pass `control`/`name` into field components.
- `mode: 'onTouched'`, disable submit while `isSubmitting`, and show DB failures with `setError('root', …)`.

## Spreadsheet import (CSV)

The user tracked money in a spreadsheet before this app, and other users keep theirs in other layouts, so the import (`import` route, `src/lib/screens/settings/import.screen.tsx`, logic in `src/lib/spreadsheet/`) reads **any layout**:

```
Coinroot's own sheet:  ID, Date, Type, From, To/Category, Amount, Note, Linked to, Left from this (auto)
A diary:               Date, Category, Account, Amount (minus = money out), Details
A bank statement:      (title rows) Txn Date, Description, Debit, Credit, Balance
```

- **Sources:** a picked CSV file, or **Paste a table**: rows copied from Excel, Google Sheets, Word, a PDF or notes arrive as tab-separated text. `.xlsx` / `.docx` / `.pdf` and other binary files aren't parsed; `unreadableFileReason` explains what to do (save as CSV, or copy the table and paste it). Separators (comma, semicolon, tab, `|`), quotes, a BOM and Bengali digits are handled.
- **Steps:** source → **your sheet** → **new names** → **review** → one database transaction. Logic for what to ask is in `assess.spreadsheet.ts` (tested).
  - **Not a table:** a file with no row holding a date and an amount (e.g. a "How to use" sheet) stops at the source step with a dialog saying to download the tab with the entries (`notATableReason`, lenient on purpose).
  - **Your sheet:** when the guess is confident (`isConfident`: column names found, a date and an amount, no extra question needed, at most 1 in 10 rows with a problem) it shows a **summary** (entry count, date range, types, the first rows, which columns are read / not used) with "Something wrong? Change columns". Otherwise, or after that link, **which column is what**, column-first: one card per sheet column with its example values and a "This is" picker (`sheetColumns`, `assignColumn`: one field per column; computed columns like "Left from this (auto)" or "Balance" skipped). Extra questions appear only when needed (`importQuestions`): which row has the names (title rows or none), date order (ambiguous dates only), an account (no account / From / To column), the type (no type column, in / out columns or minus signs). Live preview with row problems.
  - **New names** is skipped when every name is already in the app. New accounts come first (guessed type + an opening balance before their first row), then new categories; matched names collapse into one "N already in the app" line.
  - **Review:** counts, date range, rows already in the app skipped, rows with problems listed and left out.
- **Values:** amounts like `1,20,000`, `৳500`, `Tk 50.5`, `-75`, `75-`, `(200)` → poisha (more than 2 decimals is a problem); dates `YYYY-MM-DD`, `DD/MM/YYYY` or `MM/DD/YYYY` (guessed from the column: a first number over 12 means day first; day first when unclear, with a hint), month names (`5 Nov 2026`, `05-Nov-26`), times dropped, Excel day numbers; types as words (`Expense`, `dr`, `Paid`, `Credit`, `Transfer`, `খরচ`, `আয়`).
- **Type when the sheet doesn't say:** money out / minus → expense, money in / plus (when the column has minus signs) → income, otherwise the chosen default; a category (or From / To) that is one of the accounts makes a transfer (e.g. an ATM withdrawal filed under "Cash"). Rows without a category go to "Other" / "Other Income". "Received from" on a non-income row is kept in the note.
- **Row problems** name the sheet row ("Row 14: date "31/02/2024" isn't a date"): bad or future dates, bad / zero / two-sided amounts, unknown types, missing accounts, transfers to the same account, repeated IDs, links to a missing row or to an expense. "Total" rows are left out. Every row is checked before anything is saved; rows with problems are left out only after the user sees them on the button ("Import 120 rows, leave out 3").
- **Linked to:** a `Row ID` column + `Linked to` column map to `parent_id`.
- **Duplicates:** an entry with the same date, type, from, to and amount as one already recorded is skipped by default (each recorded entry matches once), so importing the same or an overlapping sheet again is safe; links to a skipped row point at the recorded one.
- **Export:** Settings → Export to spreadsheet writes `coinroot-transactions-YYYY-MM-DD.csv` (UTF-8 with BOM for Excel) in Coinroot's columns (`ID, Date, Type, From, To/Category, Amount, Note, Received from, Linked to`; plain taka numbers; text starting with `=`, `+`, `-` or `@` gets a leading `'` so Excel doesn't run it as a formula, and the import removes it) and opens the share sheet. An exported file imports back to the same entries (tested).
- Opening balances of existing accounts aren't changed by an import; new accounts get theirs in the names step.

## Roadmap

**Phase 1: design and prototype is done.** Every screen and feature below was built on an in-memory mock store (now replaced by SQLite) and has been checked on Android in light and dark mode. Design changes come later, as needed.

Done in phase 1:
- Transactions: add / edit / delete, list grouped by day with Load more, quick add (Simple mode), transfer charges, "Received from" with suggestions, calendar date picker, money-tree links ("Linked to", "Left from this")
- Accounts: derived balances, total / available / in savings, Count cash / Check balance
- Summary: monthly totals, spending over time (daily / 6 months), spending by category, income by client, moved to savings
- First-time setup (no bank account required), sample-data mode, Settings (profile, theme, Simple mode, categories, backup / restore, set up again, log out)
- Design system: navy + purple theme in light / dark, Poppins, floating tab bar, dialogs, loading / error / saving states everywhere

**Phase 2: the backend.** Local-first with Drizzle + SQLite (`expo-sqlite`, `drizzle-orm`) for data and MMKV for small settings (MMKV done: theme and Simple mode). Supabase (Auth + Postgres with RLS) is optional backup / sync; SQLite stays the source of truth. Sign-in (Supabase Auth, PKCE email links), the cloud tables and two-way sync are done. Schema should be sync-ready: UUID text ids, `created_at` / `updated_at` / `deleted_at` on every table.
1. ~~Drizzle schema in `src/lib/db` matching the data model (including the payer, now `received_from`), migrations, and the migrations gate in the root layout~~ (done)
2. ~~Seed categories on first launch; sample data written once~~ (done)
3. ~~Replace the in-memory store with SQLite reads and writes, same shapes~~ (done: `ledgerStore` in `src/lib/db`; data survives restarts)
4. ~~Paged queries~~ (done: screens read only what they show via `queries.database.ts`; measured with 51k transactions)
5. ~~Supabase project + real sign-in~~ (done: `src/lib/supabase`, email confirmation and password reset by email link)
6. ~~Cloud tables in Postgres~~ (done: `supabase/migrations`, RLS per user, server-set `server_updated_at`, last write wins in a trigger)
7. ~~Two-way sync~~ (done: `sync.database.ts` + `syncStore`; merge on first sync, another account blocked, Settings → Cloud sync)
8. Next: profile photo in Supabase Storage, own SMTP for auth emails

Later:
1. ~~CSV import from the spreadsheet~~ (done: Settings → Backup & data → Import from spreadsheet; any layout, CSV or pasted table, plus CSV export)
2. ~~Backup / restore (JSON)~~ (done: Settings → Backup & data and Welcome → "Restore a backup")
3. ~~Money-tree view~~ (done: `money-tree/[id]`, see **Money tree** under Conventions)
4. More charts, per-category budgets, recurring transactions, DPS details and reminders
5. App lock (fingerprint / PIN), hide amounts
6. Bengali language and digits
7. App icon and splash in the brand design, then open source

Known small design items (deferred): content scrolls under the status bar on long screens.

## Conventions

- Keep money math in one module (parse, format, add) with unit tests. Format with the taka sign and Bangladeshi digit grouping (lakh/crore: first group of three, then groups of two), consistent across the app.
- Package manager is **bun**. `bun.lock` is committed (never gitignore it), and there must be no `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`. Use `bun install`, `bunx expo install <pkg>` for dependencies and `bunx` instead of `npx`.
- Run `bunx expo lint`, `bunx tsc --noEmit` and `bun run test` before calling a task done. CI (`.github/workflows/ci.yml`) runs the same plus `bun run db:check` on every PR into `main` and every push to `main` (it writes `expo-env.d.ts` first, since that gitignored file only exists after `expo start`); `claude-review.yml` adds a Claude review (secret `CLAUDE_CODE_OAUTH_TOKEN`) when a PR is opened or marked ready, and again when someone with access comments `@claude review` on the PR (not on every push). Lint warnings inside `src/lib/gluestack-ui` (`import/no-duplicates`) come from the generated code and can be ignored.
- **Money tree** (`money-tree/[id]`, `src/lib/screens/transactions/money-tree.screen.tsx`, opened from the "Money tree" row on a transaction's detail screen when it has a "Linked to" or linked entries): `moneyTree(id, transactions)` (`ledger.util.ts`, tested) walks "Linked to" up to the entry that started the chain (the root, e.g. the salary), then down through everything linked below it, breadth first, children oldest first. Each non-expense node has `left` (amount − linked entries); the header shows the root and totals over the whole tree: Spent (every expense) and Still in accounts (every `left`), which add up to the root's amount. Only live entries count, so a link to a deleted entry ends the chain; loops are safe; at most `MONEY_TREE_MAX_DEPTH` (30) levels and `MONEY_TREE_MAX_NODES` (500) shown (`truncated`; totals still count everything). The screen highlights the entry it was opened from; trees over 40 nodes open only along the way to it, and every node with children has an open / close arrow.
- ATM withdrawals use the tree (design B, may change): a transfer bank → Cash, with the cash spending added as linked expenses ("Add linked expense" on the withdrawal). The withdrawal shows what's left.
- Charts are drawn with plain themed views (`BarChart` in `src/lib/ui`), not a chart library: `react-native-gifted-charts` needs `expo-linear-gradient` (a native rebuild) and `victory-native` needs Skia. Revisit only for chart types views can't do.
- The Transactions list shows whole days in pages of 30 (`getRecentDays`, the SQL form of `takeDays`) with a "Load more" button; account history shows 50 entries at a time with "Load more". The "Linked to" picker offers the newest 30 linkable entries.
- **Loading states everywhere.** Nothing renders ledger data until `status === 'ready'`:
  - Tab screens show a skeleton of their layout (`Skeleton`, `SkeletonCard`). Detail screens and forms show a spinner (`LoadingState`). Both go through `LedgerPending`, which shows `ErrorState` with "Try again" if loading failed.
  - Forms take their defaults from the ledger, so the exported screen waits for `ready` and then mounts the inner form.
  - Every write is awaited. The button shows `ButtonLoader` and is disabled meanwhile (submit, inline create). Deletes run inside the confirm dialog (`onConfirm`). Failures go to `setError('root', …)` or show in the dialog.
  - "Load more" renders the next page in a `useTransition` and shows a spinner while pending.
- **Dialogs:** never use React Native's `Alert`. Use `useDialog()` (`src/lib/ui/dialog.ui.tsx`, `DialogProvider` is mounted in the root layout):
  - `await dialog.confirm({ title, message, tone: 'danger', confirmLabel: 'Delete', onConfirm })` resolves to `true` when confirmed. `onConfirm` runs inside the dialog with a spinner; if it throws, the dialog stays open and shows an error.
  - `await dialog.alert({ title, message, tone: 'info' })` shows information with an OK button.
  - `dialog.show({ title, message, tone, icon, actions: [{ label, value, variant, onPress }] })` takes any buttons and resolves to the pressed `value` (or `null` if dismissed).
  - Tones: `default` (question), `info`, `success`, `warning`, `danger`. `message` can be any React node. `dismissible: false` blocks the back button and tapping outside. Dialogs queue, so only one shows at a time. The declarative `<Dialog open onClose>` is there for rare cases.
- **Settings layout:** a simple profile card (avatar, nickname, email / phone, an outline "Edit profile" button; plus a "Log in or create account" row when signed out), then Preferences (Theme pills, Simple mode), Categories, Backup & data (back up, restore, import from / export to spreadsheet), then a red card with "Set up accounts again" and Log out, and the version as a small footer. Every row has an `IconBadge`; rows that remove data or sign out are `tone="danger"` (no chevron) and confirm first. Info-only rows (no `onPress`) aren't dimmed. Switches are purple on both platforms (`SwitchRow` sets track and thumb colours; Android's default thumb is green).
- **Profile and greeting:** the Transactions tab header (`GreetingHeader`) says "Good Morning / Afternoon / Evening, Nickname" (5–12 / 12–17 / otherwise, rechecked every minute; just the greeting without a name) in `text-2xl`, with the month in small purple text below, and the avatar opens `profile-form`. The avatar shows the photo, else initials, else a person icon. Settings starts with the profile card and its "Edit profile" button. The profile is stored in MMKV; signed in, the nickname and phone are also kept on the account (`user_metadata`: sent at sign-up and on every profile save, brought back at log-in), while the photo stays on the phone until it moves to Supabase Storage. "Set up accounts again" keeps it.
- **Accounts are optional.** `useAuth()` returns the session or `null`. The app works fully without one; an account adds cloud backup and sync between phones. Signed out, the Settings profile card has a "Log in or create account" row (opens `log-in`, which links to `sign-up`); signed in, the card shows the account email and Log out is the red row at the bottom (confirm dialog; signs out on this phone only and clears the profile: nickname, email, phone, photo; accounts and transactions stay until sync can restore them). Auth is Supabase (`authStore` in `src/lib/supabase`). With email confirmation on, sign-up saves the profile and shows "Check your email"; the link opens `auth-callback`, which signs in. "Forgot password?" emails a reset link to the email typed in the form; the link opens `auth-callback` with the New password form. Supabase dashboard → Authentication → URL Configuration must allow `coinroot://**` (and `exp://**` for Expo Go) as redirect URLs.
- **Supabase project:** settings come from `.env.local` (copy `.env.example`; gitignored). `supabase/` holds the CLI config (`config.toml`: auth settings mirrored from the dashboard: confirmations on, passwords 8+ with letters and digits, redirect URLs) and `supabase/migrations/` (SQL, created with `bunx supabase migration new <name>`, applied with `bunx supabase db push --remote` (the CLI is linked to the project; `--dry-run` first), then `bun run db:types`; never edit one that's been pushed, add a new one). Free projects pause after about a week without activity.
- **Cloud tables** (`supabase/migrations/*_cloud_tables.sql`): `accounts`, `categories`, `transactions` with the SQLite columns plus `user_id` (default `auth.uid()`, cascade on account deletion) and `server_updated_at`. Primary key `(user_id, id)`; ids stay the phone's text UUIDs. Money `bigint` poisha, dates `date`, timestamps `timestamptz`, same checks as SQLite (types / kinds, `amount > 0`, `from_id <> to_id`), no foreign keys between ledger rows. The `sync_row_write` trigger sets `server_updated_at` on every write, pulls an `updated_at` more than 1 minute in the server's future back to the server's clock (a phone with its clock ahead can't win every conflict), and skips an update whose `updated_at` is older than the stored row (last write wins). Trade-off of device clocks: a phone whose clock runs slow still loses ties. RLS: signed-in users select / insert / update only their own rows; no delete (soft deletes); `anon` has no access. Grants are explicit because the project doesn't expose new tables automatically, so any new table needs its own `grant` and policies. Pulls should start a little before the last `server_updated_at` seen, since writes can commit out of order.
- **Profile validation** (`profile.schema.ts`, `auth.schema.ts`): nickname is required, one word, 2–15 characters, starting with a letter (any script); email is optional in the profile and required for an account; phone is optional, an 11-digit Bangladeshi mobile number (013–019), stored as `+8801XXXXXXXXX`; a new password needs 8+ characters with a letter and a number (log in only checks it's filled in). With an account the profile email is the sign-in email and read-only.
- **First-time setup** (`setup` route): Welcome (Create account / Log in / Continue without an account / Explore with sample data) → step 1: `SignUpForm`, `LogInForm` (then the profile if it has no nickname) or `ProfileForm` → "What do you use for money?" (Cash / Mobile wallet / Bank account / Savings / DPS, no bank required) → "Name your accounts" with today's balance → app. "Explore with sample data" skips it; Settings → "Set up accounts again" resets.
- **Backup file** (`backup.schema.ts`): `{ app: 'coinroot', format: 2, exportedAt, accounts, categories, transactions }` with the database rows (camelCase fields, no `deletedAt`). `checkBackup(text)` checks everything before a restore: valid JSON, a Coinroot file, a format this app knows (a newer `format` asks to update the app), every row's fields, unique ids, and from / to / "Linked to" pointing at a row of the right kind; errors name the row ("Transaction 14: amount is invalid"), at most 8 plus a count. Bump `BACKUP_FORMAT` when the shape changes and keep reading older formats: `upgradeBackup` brings an older file to the current shape before the checks (format 1 → 2 renames `party` to `receivedFrom`). Profile and settings aren't in the file (device-only).
- **Backup / restore UI** (`useBackupActions` in `src/lib/components`): Settings → Backup & data "Back up to a file" writes `coinroot-backup-YYYY-MM-DD.json` in the cache and opens the share sheet (`src/lib/storage/backup-file.storage.ts`; the row shows the last backup date from `lastBackupSetting`), "Restore from a backup" picks a file, checks it, confirms with the file's counts and what will be replaced, then restores. Welcome has "Restore a backup" for a new phone.
- **Count cash / Check balance** (`balance-check` modal, from account detail): the user enters what they actually have. The difference is saved as a `Balance adjustment` expense (missing) or income (extra), so the derived balance matches reality.
- **Transfer charge:** new transfers have an optional Charge (e.g. cash-out fee). It's saved as its own expense from the same account (default category Bank Charges). It's not a parent link, so it doesn't change "remaining".
- **Received from** (`received_from` column, `receivedFrom` field; called `party` before backup format 2): optional on income, with suggestions from earlier names (`TextField suggestions`, `receivedFromSuggestions` / `getReceivedFromNames`). Summary shows "Income by client" (`incomeByPayer`). The spreadsheet import still recognises a "party" column.
- **Simple mode** (Settings → Preferences, `useSimpleMode`, MMKV): the Transactions list starts with Quick add (the 4 most used type + from + to combinations from `quickPresets`, excluding balance adjustments, plus Expense / Income / Transfer buttons), and the form hides "Linked to".
- Dates in forms use `DateField`: tapping it opens a themed `Calendar` (`src/lib/ui/calendar.ui.tsx`) in a bottom sheet, with Today / Yesterday shortcut chips. Weeks start on Sunday, and days after `maxDate` (default today) are disabled. No native date-picker module.
- `AmountField` sizes its input to the text (measured from a hidden copy), so it grows instead of scrolling, and drops a size for long amounts. Large Poppins text needs an explicit `leading-[…]`, since Tailwind's `text-4xl`+ set line-height 1, which clips it.
- App icon and splash images (`assets/images`) are still Expo's; their background colours are navy `#1E2A5E` (takes effect after a native rebuild).
- **Dev-only warning hidden:** `src/dev-warnings.ts` filters "ImageBackground is deprecated" out of `console.warn` in development (so neither the LogBox toast nor the console / Metro shows it); the entry `index.js` (`package.json` `main`) imports it before `expo-router/entry`, since the warning fires as soon as the first screen file loads NativeWind's JSX runtime. It comes from `react-native-css-interop` (NativeWind) touching React Native's `ImageBackground` at startup, not from our code, and never shows in release builds. Remove the line once NativeWind stops doing that. Don't hide other warnings this way.
- **Dev server:** run Metro in watch mode (`bun start`), not with `CI=1`, which disables reloads. If the app shows "Cannot read property 'ErrorBoundary' of undefined" after several quick edits, it's a Fast Refresh glitch: do a full reload (`r` in Metro or dev menu → Reload). If it survives a reload, check the Metro output for the real error.
- **Cloud sync** (signed in only; `syncStore`): the first account to sync on a phone merges the phone's records with its cloud records. Records stay after log-out, so another account is **blocked** from syncing until Set up accounts again removed them (then `prepareForNewAccount` drops the old deleted rows and re-uploads the categories). Sample-data mode never syncs. Logging in during first-time setup waits up to 15 s for the first sync; records arriving finish setup (`setupStateSetting` → `own`). Log out tries a last sync (up to 10 s). Set up accounts again deletes the records in the cloud too (the soft deletes sync). Settings → Backup & data starts with a "Cloud sync" row (last sync, changes waiting, errors; tap to sync now). Profiles aren't synced this way (nickname / phone are on the account's `user_metadata`).
- Before open-sourcing: replace the template LICENSE (currently copyright Expo) and README.
