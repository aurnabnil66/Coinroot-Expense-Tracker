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
               note, parent_id (nullable → transactions.id), party (nullable, income only: who paid),
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

Accounts, categories and income sources are **user data in the database**, never hard-coded constants. The lists above are only first-launch seed rows. Every from/to field is a picker (dropdown) over those tables, with a "+ New category / account" option that creates the item inline and selects it. Shop or place names go in `note`, and clients / payers in `party` ("Received from"), not in categories.

## Architecture: local-first

- All data lives on the device in SQLite, the source of truth. The app must work fully offline; no feature may require a server.
- Backup / restore: a JSON file of every live row, shared to any cloud storage or file app and restored from a picked file (done). CSV export comes with the spreadsheet import.
- Cloud backup / sync is a later, optional phase with Supabase (Auth + Postgres with RLS), mirroring the local tables. Signing in stays optional.

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
| Backup / restore | `expo-sharing` (share sheet for the backup file; its config plugin is in `app.json` with receiving shares off) + `expo-document-picker` (pick a file to restore) + `expo-file-system` |
| Icons | gluestack `Icon` (lucide-style SVGs) in the UI; `expo-symbols` `SymbolView` for tab icons (SF Symbols on iOS, Material Symbols on Android/web) |

Planned (add with `bunx expo install` when the feature needs it, then move it to the table above):

| Need | Library |
|---|---|
| CSV import | `expo-document-picker` + `papaparse` |
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
| `src/lib/hooks/` | Shared hooks (`useLedger`, `useLedgerQuery`, `useColorScheme`, `useThemePreference`, `useSimpleMode`, `useProfile` / `useGreeting`, `useAuth`, `useAutoFocus` / `focusInput`, `useRipple`) |
| `src/lib/constants/` | Static values (`ledger.constants.ts`: labels, account/category colours; `theme.constants.ts`: `BottomTabInset`, `MaxContentWidth`, `FontFamily`) |
| `src/lib/schemas/` | Zod schemas, their inferred types and form defaults |
| `src/lib/types/` | Domain types (`Account`, `Category`, `Transaction`), matching the data model above |
| `src/lib/storage/` | Device-only settings in MMKV (`settings.storage.ts`: `createSetting`, `createEnumSetting`, `createBooleanSetting` with in-memory cache + listeners, safe when storage is unavailable). `setup.storage.ts` holds `setupStateSetting` (whether first-time setup is done). `profile.storage.ts` holds the profile (`nickname`, `photo` URI, `email`, `phone`; an old `name` is read as the nickname) and `saveProfile`, which copies a picked photo into `Paths.document/profile/` (expo-file-system) and deletes the old one. Hooks such as `useThemePreference` / `useSimpleMode` define their setting here and read it with `useSyncExternalStore`. Tests mock `react-native-mmkv`. |
| `src/lib/utils/` | Pure logic with unit tests: `money.util.ts` (parse/format taka ↔ poisha), `date.util.ts` (`YYYY-MM-DD` day keys), `greeting.util.ts` (`greetingFor`, `initialsOf`), `phone.util.ts` (`normalizeBdPhone` → `+8801XXXXXXXXX`, `formatBdPhone`), `ledger.util.ts` (balances, remaining, monthly summary, daily/monthly spending, day grouping and paging) |
| `src/lib/mocks/` | **Temporary** stand-ins: `authStore` (sign-up / log-in / log-out shaped like Supabase Auth: async, throws `AuthError` with a user-facing message; the session `{ userId, email }` persists in MMKV; accounts created this session are checked in memory, any other email and password work; passwords are never stored). `sample-data.mock.ts`: invented sample accounts and history (current month plus five earlier months; generic names, invented amounts) that "Explore with sample data" writes into the database once. |
| `src/lib/gluestack-ui/` | Vendored gluestack-ui components, one folder each. Owned, editable code. |
| `src/global.css` | The only global stylesheet and the NativeWind entry (`@tailwind` directives + font variables) |
| `assets/` | Images, icons and fonts (repo root) |

New layers follow the same `src/lib/<layer>/*.<suffix>.ts(x)` shape with their own barrel.

**Database layer (`src/lib/db/`, `*.database.ts`):** (not `*.db.ts`: Expo's Metro config treats `.db` as an asset extension, so `./client.db` wouldn't resolve)
- `schema.database.ts`: Drizzle tables `accounts`, `categories`, `transactions` (snake_case columns, camelCase fields) matching the data model. Sync-ready: UUID text `id` (the app always sets it with `newId()`), ISO `created_at` / `updated_at`, and `deleted_at` (set instead of deleting). Money is integer poisha, dates `YYYY-MM-DD` text, booleans `integer` (`mode: 'boolean'`). Check constraints: allowed `type` / `kind` values, `amount > 0`, `from_id <> to_id`. No foreign keys (from/to point at accounts or categories, and synced rows may arrive in any order). It must not import native modules: drizzle-kit loads it in Node.
- `id.database.ts`: `newId()` (expo-crypto UUID v4). `client.database.ts`: the one connection (`coinroot.db`, `enableChangeListener: true` for `useLiveQuery`, WAL) and `db`.
- `setup.database.ts`: `whenDatabaseReady()` runs the migrations, then `seedDefaultCategories()`, once per app start (a shared promise; retried after a failure). Anything touching the database awaits it; `useDatabaseSetup()` (→ `preparing` / `ready` / `error`) drives `DatabaseGate`.
- `ledger-store.database.ts`: `ledgerStore` (`subscribe` / `getSnapshot` for `useLedger`, `load`, and every write: `addTransaction`, `updateTransaction`, `deleteTransaction`, `addAccount`, `updateAccount`, `addCategory`, `updateCategory`, `completeSetup`, `loadSampleData`, `resetSetup`), plus `LedgerSnapshot` / `LedgerStatus` and the `*Input` types. The snapshot holds only accounts, categories, `setupDone` and a `version` that goes up after every load and write.
- `queries.database.ts`: the read queries screens use, each returning only what one screen shows and each matching a tested function in `ledger.util.ts` run on the full list: `getRecentDays` (list pages = `takeDays(groupByDay(all))`), `getTransactionsBetween` (month / range, optionally one account), `getAccountBalances` (SQL sums), `getMonthlySpending`, `getAccountTransactions` (history pages), `getRecentTransactions` (Quick add's last 100), `getPartyNames`, `getLinkableParents` (newest 30, always keeping the current link), `getTransaction`, `getChildren`, `getChildTotals` + `remainingFrom`, `countChildren`, `countTransactions`. They take the database as a parameter (`LedgerDatabase`, any sync Drizzle SQLite db). Order is always `compareNewestFirst` (date, created_at, id).
- `backup.database.ts`: `readBackup(db)` (every live row, oldest first, as a `Backup`) and `restoreBackup(db, backup)`: in one transaction, marks every current row deleted, then upserts each backup row by id (so restoring your own backup brings the same rows back) with a fresh `updated_at`. `ledgerStore.exportBackup()` / `ledgerStore.restoreBackup()` wrap them (restore finishes setup when the backup has accounts).
- `seed.database.ts`: `seedDefaultCategories()` (only while the table has never had a row, so removed categories never come back), `seedSampleData(sample)` (once: skipped while live accounts exist), `clearLedgerData()` (soft-deletes accounts and transactions for "Set up accounts again"; categories stay), `ledgerCounts()`. Sync drizzle API (`.all()`, `.run()`, `db.transaction((tx) => …)`).
- `seed-rows.database.ts` (pure, tested): `defaultCategoryRows` from `DEFAULT_CATEGORIES` (`src/lib/constants`), and `sampleRows`, which gives sample rows new UUIDs, rewrites from / to / parent links and reuses existing categories by kind + name. `mappers.database.ts` (tested): `rowToAccount` / `accountToRow` (savings details ↔ flat columns), `rowToCategory`, `rowToTransaction` and back.
- `migrations/`: generated by `bun run db:generate` after a schema change (never edit by hand; commit them). `bun run db:check` checks they're consistent. `drizzle.config.ts` (root) points drizzle-kit here.
- Tests run in Jest without a device: `schema.database.test.ts`, `seed-rows.database.test.ts`, `backup.database.test.ts` (round trips, restoring onto other data, large restores, file checks) and `queries.database.test.ts`, which uses `createTestDatabase()` (`testing.database.ts`, test-only, not in the barrel: the real migrations on an in-memory `better-sqlite3` database, a dev dependency), fills it with the sample data plus ~2,000 generated entries (links, deleted rows, odd "Received from" spellings) and checks every query against the JS function on the full list. Importing `client.database.ts` in a test would open expo-sqlite, so tested code takes the database or plain data as a parameter.

**Data access:** never load every transaction (with ~50k rows, about 10 years, that took ~5 s on a debug build; now startup is ~20 ms and a save ~30 ms plus the open screens' queries). `useLedger()` gives `status`, `error`, `setupDone`, accounts, categories and `version`. Transactions come from `useLedgerQuery((database) => getRecentDays(database, limit), [limit])` (`src/lib/hooks`), which runs a query from `queries.database.ts` during render and re-runs it when `version` or its plain-value `deps` change. Writes go through `ledgerStore.*` from `@/lib/db`: async, throw on failure, new UUIDs and `updated_at`, soft deletes (deleting a parent unlinks its children), then the lists are re-read and `version` goes up. `setupDone` comes from `setupStateSetting` (`none` → setup; `own` / `sample` → app). Balances and totals are never stored: computed in SQL (`getAccountBalances`, `getMonthlySpending`) or with `ledger.util.ts` on the few rows a query returns (e.g. `monthlySummary` on one month).

## File naming

- All filenames are kebab-case, with a suffix naming their layer: `*.screen.tsx`, `*.component.tsx`, `*.ui.tsx`, `*.hook.ts`, `*.constants.ts`, `*.schema.ts`, `*.types.ts`, `*.util.ts`, `*.mock.ts`, `*.database.ts`.
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
  - Pushed with the native header: `transaction/[id]`, `account/[id]`, `categories?kind=`. Screens set their title / Edit button with `<Stack.Screen options>`.
  - Modals (own `ModalHeader`): `transaction-form?id=|parentId=|type=&fromId=&toId=` (the last is a quick-add preset), `account-form?id=|name=`, `category-form?id=|kind=`, `balance-check?accountId=`, `profile-form` (create / edit profile), `log-in`, `sign-up`.
  - `setup`: first-time setup. The root `Stack` wraps the app in `<Stack.Protected guard={setupDone}>` and `setup` in `guard={!setupDone}`, so finishing (or resetting) setup switches screens automatically.
- The root `src/app/_layout.tsx` imports `@/global.css` and owns `GluestackUIProvider` (outermost, `mode={themePreference}`), the react-navigation `ThemeProvider` (gluestack colours + Poppins fonts), the `StatusBar`, `DialogProvider` and the root `Stack`, wrapped in `DatabaseGate` (`src/lib/components`), which prepares the database first (migrations + default categories): spinner → error with Try again → app.

## Styling

- Use gluestack-ui components (`Box`, `VStack`, `HStack`, `Text`, `Heading`, `Input`, `Pressable`, `Icon`, `Divider`) with Tailwind `className`, not `StyleSheet.create`.
- **Buttons:** always `Button` from `@/lib/ui` (`button.ui.tsx`), never gluestack's `Button` / `ButtonText` directly, and no hand-made `Pressable` + `Text` links. Props: `label`, `onPress`, `variant` (`solid` default · `soft` · `outline` · `ghost` · `link`), `color` (`primary` default · `danger` · `muted`), `size` (`sm` pill h-11 · `md` default h-12 · `lg` h-14 for full-screen flows; for links only the text size), `icon`, `loading` (spinner + disabled), `loadingLabel`, `disabled`, `className` for layout (margins, `flex-1`, `self-start`; conflicting classes override). Examples: submit `<Button label="Save" loading={isSubmitting} onPress={…} />`, delete `variant="ghost" color="danger"`, inline link `variant="link"`. Dialog actions map onto it (`ACTION_STYLES`). Chips, tiles and list rows stay `Pressable`. Dynamic numeric values with no Tailwind token (e.g. `MaxContentWidth`, `BottomTabInset`) go in `style` next to `className`.
- Theme colours are CSS variables in `src/lib/gluestack-ui/gluestack-ui-provider/config.ts` (`--primary`, `--background`, `--muted`, `--destructive`, …), mapped to Tailwind colours in `tailwind.config.js`. Use `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, never raw hex.
- **Theme setting:** Settings → Theme offers Light / Dark / Device default (the default). `useThemePreference()` / `setThemePreference()` (`src/lib/hooks`) save it in MMKV (`src/lib/storage`), and the root layout passes it to `GluestackUIProvider mode`. NativeWind then sets the native appearance too, so alerts and the keyboard follow.
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

The user tracked money in a spreadsheet before this app. Importing it must be supported. CSV columns (exported from the Transactions sheet):

```
ID, Date, Type, From, To/Category, Amount, Note, Linked to, Left from this (auto)
```

- `Date` is `YYYY-MM-DD`; `Type` is `Income` / `Expense` / `Transfer`; `Amount` is taka (may have decimals) → convert to poisha.
- `ID` is like `T1`, `T2`; `Linked to` references another row's ID → map to `parent_id`.
- `From` / `To/Category` are names → match to accounts / categories, offer to create unknown ones.
- Ignore `Left from this (auto)` (computed).
- Opening balances come from the sheet's separate Accounts sheet (Account, Opening balance, As of date). Allow entering them manually during import.
- Validate every row before importing anything, and show row-level errors ("Row 14: unknown category").

## Roadmap

**Phase 1: design and prototype is done.** Every screen and feature below was built on an in-memory mock store (now replaced by SQLite) and has been checked on Android in light and dark mode. Design changes come later, as needed.

Done in phase 1:
- Transactions: add / edit / delete, list grouped by day with Load more, quick add (Simple mode), transfer charges, "Received from" with suggestions, calendar date picker, money-tree links ("Linked to", "Left from this")
- Accounts: derived balances, total / available / in savings, Count cash / Check balance
- Summary: monthly totals, spending over time (daily / 6 months), spending by category, income by client, moved to savings
- First-time setup (no bank account required), sample-data mode, Settings (theme, Simple mode, categories, set up again)
- Design system: navy + purple theme in light / dark, Poppins, floating tab bar, dialogs, loading / error / saving states everywhere

**Phase 2 (next): the backend.** Local-first with Drizzle + SQLite (`expo-sqlite`, `drizzle-orm`) for data and MMKV for small settings (MMKV done: theme and Simple mode). Supabase (Auth + Postgres with RLS) comes later as optional backup / sync; SQLite stays the source of truth. The sign-in screens already exist on the stand-in `authStore`; swapping it for `supabase.auth` (session kept in secure storage) is the first Supabase step. Schema should be sync-ready: UUID text ids, `created_at` / `updated_at` / `deleted_at` on every table.
1. ~~Drizzle schema in `src/lib/db` matching the data model (including `party`), migrations, and the migrations gate in the root layout~~ (done)
2. ~~Seed categories on first launch; sample data written once~~ (done)
3. ~~Replace the in-memory store with SQLite reads and writes, same shapes~~ (done: `ledgerStore` in `src/lib/db`; data survives restarts)
4. ~~Paged queries~~ (done: screens read only what they show via `queries.database.ts`; measured with 51k transactions)

Later:
1. CSV import from the spreadsheet
2. ~~Backup / restore (JSON)~~ (done: Settings → Data and Welcome → "Restore a backup")
3. Money-tree view
4. More charts, per-category budgets, recurring transactions, DPS details and reminders
5. App lock (fingerprint / PIN), hide amounts
6. Bengali language and digits
7. App icon and splash in the brand design, then open source

Known small design items (deferred): content scrolls under the status bar on long screens.

## Conventions

- Keep money math in one module (parse, format, add) with unit tests. Format with the taka sign and Bangladeshi digit grouping (lakh/crore: first group of three, then groups of two), consistent across the app.
- Package manager is **bun**. `bun.lock` is committed (never gitignore it), and there must be no `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`. Use `bun install`, `bunx expo install <pkg>` for dependencies and `bunx` instead of `npx`.
- Run `bunx expo lint`, `bunx tsc --noEmit` and `bun run test` before calling a task done. Lint warnings inside `src/lib/gluestack-ui` (`import/no-duplicates`) come from the generated code and can be ignored.
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
- **Settings layout:** a simple profile card (avatar, nickname, email / phone, an outline "Edit profile" button; plus a "Log in or create account" row when signed out), then Preferences (Theme pills, Simple mode), Categories, Backup & data, then a red card with "Set up accounts again" and Log out, and the version as a small footer. Every row has an `IconBadge`; rows that remove data or sign out are `tone="danger"` (no chevron) and confirm first. Info-only rows (no `onPress`) aren't dimmed. Switches are purple on both platforms (`SwitchRow` sets track and thumb colours; Android's default thumb is green).
- **Profile and greeting:** the Transactions tab header (`GreetingHeader`) says "Good Morning / Afternoon / Evening, Nickname" (5–12 / 12–17 / otherwise, rechecked every minute; just the greeting without a name) in `text-2xl`, with the month in small purple text below, and the avatar opens `profile-form`. The avatar shows the photo, else initials, else a person icon. Settings starts with a profile row. The profile is device-only (MMKV) for now; with Supabase it becomes a `profiles` row and the photo goes to Storage. "Set up accounts again" keeps it.
- **Accounts are optional.** `useAuth()` returns the session or `null`. The app works fully without one; an account is for backup and sync later. Settings → Account shows "Log in or create account" (opens `log-in`, which links to `sign-up`) or "Signed in as" + Log out (confirm dialog; local data stays). When Supabase lands, `authStore` becomes `supabase.auth` (`signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail` for "Forgot password?", which is an info dialog for now).
- **Profile validation** (`profile.schema.ts`, `auth.schema.ts`): nickname is required, one word, 2–15 characters, starting with a letter (any script); email is optional in the profile and required for an account; phone is optional, an 11-digit Bangladeshi mobile number (013–019), stored as `+8801XXXXXXXXX`; a new password needs 8+ characters with a letter and a number (log in only checks it's filled in). With an account the profile email is the sign-in email and read-only.
- **First-time setup** (`setup` route): Welcome (Create account / Log in / Continue without an account / Explore with sample data) → step 1: `SignUpForm`, `LogInForm` (then the profile if it has no nickname) or `ProfileForm` → "What do you use for money?" (Cash / Mobile wallet / Bank account / Savings / DPS, no bank required) → "Name your accounts" with today's balance → app. "Explore with sample data" skips it; Settings → "Set up accounts again" resets.
- **Backup file** (`backup.schema.ts`): `{ app: 'coinroot', format: 1, exportedAt, accounts, categories, transactions }` with the database rows (camelCase fields, no `deletedAt`). `checkBackup(text)` checks everything before a restore: valid JSON, a Coinroot file, a format this app knows (a newer `format` asks to update the app), every row's fields, unique ids, and from / to / "Linked to" pointing at a row of the right kind; errors name the row ("Transaction 14: amount is invalid"), at most 8 plus a count. Bump `BACKUP_FORMAT` when the shape changes and keep reading older formats. Profile and settings aren't in the file (device-only).
- **Backup / restore UI** (`useBackupActions` in `src/lib/components`): Settings → Data "Back up to a file" writes `coinroot-backup-YYYY-MM-DD.json` in the cache and opens the share sheet (`src/lib/storage/backup-file.storage.ts`; the row shows the last backup date from `lastBackupSetting`), "Restore from a backup" picks a file, checks it, confirms with the file's counts and what will be replaced, then restores. Welcome has "Restore a backup" for a new phone.
- **Count cash / Check balance** (`balance-check` modal, from account detail): the user enters what they actually have. The difference is saved as a `Balance adjustment` expense (missing) or income (extra), so the derived balance matches reality.
- **Transfer charge:** new transfers have an optional Charge (e.g. cash-out fee). It's saved as its own expense from the same account (default category Bank Charges). It's not a parent link, so it doesn't change "remaining".
- **Received from** (`party`): optional on income, with suggestions from earlier names (`TextField suggestions`, `partySuggestions`). Summary shows "Income by client" (`incomeByParty`).
- **Simple mode** (Settings → Display, `useSimpleMode`, MMKV): the Transactions list starts with Quick add (the 4 most used type + from + to combinations from `quickPresets`, excluding balance adjustments, plus Expense / Income / Transfer buttons), and the form hides "Linked to".
- Dates in forms use `DateField`: tapping it opens a themed `Calendar` (`src/lib/ui/calendar.ui.tsx`) in a bottom sheet, with Today / Yesterday shortcut chips. Weeks start on Sunday, and days after `maxDate` (default today) are disabled. No native date-picker module.
- `AmountField` sizes its input to the text (measured from a hidden copy), so it grows instead of scrolling, and drops a size for long amounts. Large Poppins text needs an explicit `leading-[…]`, since Tailwind's `text-4xl`+ set line-height 1, which clips it.
- App icon and splash images (`assets/images`) are still Expo's; their background colours are navy `#1E2A5E` (takes effect after a native rebuild).
- **Dev server:** run Metro in watch mode (`bun start`), not with `CI=1`, which disables reloads. If the app shows "Cannot read property 'ErrorBoundary' of undefined" after several quick edits, it's a Fast Refresh glitch: do a full reload (`r` in Metro or dev menu → Reload). If it survives a reload, check the Metro output for the real error.
- Before open-sourcing: replace the template LICENSE (currently copyright Expo) and README.
