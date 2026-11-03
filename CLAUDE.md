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

## Data model (planned)

```
accounts       id, name, type (bank | cash | mobile_wallet | savings), opening_balance (poisha),
               opening_date, archived, sort_order
               savings extras (nullable): installment_amount, start_date, maturity_date, interest_rate
categories     id, name, kind (expense | income_source), icon, color, archived
transactions   id, date, type (income | expense | transfer), from_id, to_id, amount (poisha),
               note, parent_id (nullable → transactions.id), created_at, updated_at
```

`from_id` / `to_id` point to an account or a category/income source depending on type:
- income: from = income source, to = account
- expense: from = account, to = expense category
- transfer: from = account, to = account (must differ)

Default seed data:
- Accounts: generic, editable placeholders, one per type: e.g. "Bank Account", "Cash", "Mobile Wallet", "Savings (DPS)". The user renames or adds their own.
- Expense categories: Food, Groceries, Transport, Rent, Bills, Mobile & Internet, Shopping, Fitness, Bank Charges, Health, Education, Family, Entertainment, Gifts, Other
- Income sources: Salary, Bonus, Office Payment, Interest/Profit, Freelance, Gift Received, Other Income

Accounts, categories and income sources are **user data in the database**, never hard-coded constants. The lists above are only first-launch seed rows. Every from/to field is a picker (dropdown) over those tables, with a "+ New category / account" option that creates the item inline and selects it. Shop or place names go in `note`, not in categories.

## Architecture: local-first

- All data lives on the device in SQLite. **No backend.** The app must work fully offline.
- Backup/restore via exported files (CSV/JSON) shared to any cloud storage or file app.
- Cloud sync is a later, optional phase (Supabase, or PowerSync/ElectricSQL to keep local SQLite). Don't design anything that requires a server.

## Tech stack

Installed: Expo SDK 58, Expo Router (routes in `src/app/`), TypeScript (strict), Reanimated, Gesture Handler, and:

| Need | Library |
|---|---|
| Styling / theme | NativeWind v4 (`nativewind`, `react-native-css-interop`, `tailwindcss` v3) + vendored gluestack-ui v5 (`@gluestack-ui/core`, `@gluestack-ui/utils`, `@expo/html-elements`, `react-native-svg`) |
| Forms / validation | `react-hook-form` + `zod` v4 + `@hookform/resolvers` (zod also validates CSV rows on import) |
| Database | `expo-sqlite` + `drizzle-orm`, `drizzle-kit` (dev) for migrations. Installed but not wired up yet: add the schema in `src/lib/db`, then the `useMigrations` gate in the root layout. |
| Lint | ESLint 9 + `eslint-config-expo` (`eslint.config.js`) |
| Tests | Jest via `jest-expo` (`bun run test`) |
| Bottom sheets | `@legendapp/motion` (needed by gluestack `actionsheet`) |
| Font | `expo-font` config plugin embedding Poppins from `assets/fonts` |
| Icons | gluestack `Icon` (lucide-style SVGs) in the UI; `expo-symbols` `SymbolView` for tab icons (SF Symbols on iOS, Material Symbols on Android/web) |

Planned (add with `bunx expo install` when the feature needs it, then move it to the table above):

| Need | Library |
|---|---|
| CSV import | `expo-document-picker` + `papaparse` |
| Export / backup | `expo-file-system` + `expo-sharing` |
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
| `src/lib/screens/<name>/` | Full-page screens, grouped by feature: `transactions/`, `accounts/`, `summary/`, `settings/`. Nothing sits directly in `src/lib/screens/`. |
| `src/lib/components/` | Reusable, feature-aware pieces that aren't screens (`TransactionRow`, `TransactionTypeIcon`, `SpendingChart`, `LedgerPending`) |
| `src/lib/ui/` | Reusable, feature-agnostic UI components, built from gluestack-ui + `className`: layout (`ScreenContainer`, `ScreenHeader`), `AppTabs`, `Card` / `GradientCard`, rows, form fields, `SelectField` bottom-sheet picker, `Dialog` + `useDialog`, `BarChart`, `Fab`, loading pieces (`Skeleton`, `LoadingState`, `ErrorState`, `ButtonLoader`) |
| `src/lib/hooks/` | Shared hooks (`useLedger`, `useColorScheme`, `useThemePreference`, `useRipple`) |
| `src/lib/constants/` | Static values (`ledger.constants.ts`: labels, account/category colours; `theme.constants.ts`: `BottomTabInset`, `MaxContentWidth`, `FontFamily`) |
| `src/lib/schemas/` | Zod schemas, their inferred types and form defaults |
| `src/lib/types/` | Domain types (`Account`, `Category`, `Transaction`), matching the data model above |
| `src/lib/utils/` | Pure logic with unit tests: `money.util.ts` (parse/format taka ↔ poisha), `date.util.ts` (`YYYY-MM-DD` day keys), `ledger.util.ts` (balances, remaining, monthly summary, daily/monthly spending, day grouping and paging) |
| `src/lib/mocks/` | **Temporary** in-memory sample data (current month plus five generated earlier months) and an async store (`ledgerStore`) used until the database exists. Generic names, invented amounts. |
| `src/lib/gluestack-ui/` | Vendored gluestack-ui components, one folder each. Owned, editable code. |
| `src/global.css` | The only global stylesheet and the NativeWind entry (`@tailwind` directives + font variables) |
| `assets/` | Images, icons and fonts (repo root) |

New layers follow the same `src/lib/<layer>/*.<suffix>.ts(x)` shape with their own barrel. Next one: `src/lib/db/` (`*.db.ts`: Drizzle schema, client, queries).

**Data access today:** screens read everything through `useLedger()` (`status`, `error`, accounts, categories, transactions) and write through `ledgerStore.*` (`src/lib/mocks`). The mock loads and writes asynchronously with a short simulated delay, like the DB will, so loading states are always exercised. Balances and totals are computed with `src/lib/utils/ledger.util.ts`, never stored. When the DB lands, replace `useLedger` with Drizzle live queries and `ledgerStore` with DB writes; screens and utils should not need to change.

## File naming

- All filenames are kebab-case, with a suffix naming their layer: `*.screen.tsx`, `*.component.tsx`, `*.ui.tsx`, `*.hook.ts`, `*.constants.ts`, `*.schema.ts`, `*.types.ts`, `*.util.ts`, `*.mock.ts` (and `*.db.ts` next).
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
  - Modals (own `ModalHeader`): `transaction-form?id=|parentId=`, `account-form?id=|name=`, `category-form?id=|kind=`.
- The root `src/app/_layout.tsx` imports `@/global.css` and owns `GluestackUIProvider` (outermost, `mode={themePreference}`), the react-navigation `ThemeProvider` (gluestack colours + Poppins fonts), the `StatusBar`, `DialogProvider` and the root `Stack`. When the DB lands, the Drizzle `useMigrations` gate (spinner → error → app) goes here too.

## Styling

- Use gluestack-ui components (`Box`, `VStack`, `HStack`, `Text`, `Heading`, `Button`, `Input`, `Pressable`, `Icon`, `Divider`) with Tailwind `className`, not `StyleSheet.create`. Dynamic numeric values with no Tailwind token (e.g. `MaxContentWidth`, `BottomTabInset`) go in `style` next to `className`.
- Theme colours are CSS variables in `src/lib/gluestack-ui/gluestack-ui-provider/config.ts` (`--primary`, `--background`, `--muted`, `--destructive`, …), mapped to Tailwind colours in `tailwind.config.js`. Use `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, never raw hex.
- **Theme setting:** Settings → Theme offers Light / Dark / Device default (the default). `useThemePreference()` / `setThemePreference()` (`src/lib/hooks`) save it with `expo-sqlite/kv-store`, and the root layout passes it to `GluestackUIProvider mode`. NativeWind then sets the native appearance too, so alerts and the keyboard follow.
- **Design (Android-first, modern):** navy + purple brand with a light-blue accent (`sky`). Light mode: lavender-white page (`bg-background`), white cards, purple `primary`. Dark mode: deep-navy page, navy cards, lighter purple `primary`.
  - Headline numbers sit on a `GradientCard` (navy → purple, `--hero-start` → `--hero-end`) with white text (`AmountText tone="onHero"`) and `GradientStat` tiles.
  - Cards (`Card`, `GradientCard`, grouped lists, skeletons) are `rounded-xl` (stat tiles inside gradient cards `rounded-lg`) with a soft navy shadow in light mode. Inputs and pickers are `h-14 rounded-2xl`. Icon badges are rounded squares.
  - **Tab bar:** a floating pill (`bg-tab-bar`: white with a border in light mode, navy in dark) centred above the bottom safe area. Inactive tabs are round icon buttons (`bg-tab-item`), and the active tab expands into a soft purple pill (`bg-primary/15`) with a purple icon + label (animated with Reanimated `LinearTransition`). Icons are `SymbolView` from `expo-symbols` (SF Symbols on iOS, Material Symbols on Android/web). Screens scroll under it; reserve `BottomTabInset` + safe-area bottom.
  - **Shadows on Android:** `style.borderRadius` on gluestack `Box` is ignored, so round shapes use `rounded-*` classes. A pressable with `android_ripple` gets its shadow from an outer view: the FAB uses native `elevation` + `shadowColor` on a `rounded-full bg-primary` wrapper.
  - Pressables get a Material ripple via `android_ripple={useRipple()}`. The add button is a round "+" FAB (icon only, with an accessibility label). On list tabs the title and hero card stay pinned and only the list scrolls (`ScreenContainer header`, or a fixed block above a `SectionList`). Segmented controls use filled pills (`selectedClass`, e.g. `bg-expense` / `bg-income` / `bg-transfer` for the type switch).
  - Money colours are only for meaning: `text-income` (green), `text-expense` (rose), `text-transfer` (light blue). Expense amounts show as `-৳…` in the normal text colour; income as `+৳…` in green.
  - Gradients and shadows use React Native's built-in `experimental_backgroundImage: linear-gradient(...)` and `boxShadow` styles (no gradient library).
- **Font: Poppins** (400 / 500 / 600 / 700, OFL licence in `assets/fonts`), embedded at build time by the `expo-font` plugin in `app.json` as one family, so `font-normal` … `font-bold` pick the matching face. Tailwind's `font-sans` / `font-body` / `font-heading` map to it. Props that can't take `className` (navigation header, tab labels) use `FontFamily` from `@/lib/constants`. Raw `TextInput`s need `font-sans`. Don't use weights other than these four: never `font-extrabold` / `font-black` (Tailwind maps them to 700 anyway), use `font-bold`. Screen titles and large headline amounts (`text-4xl`+) are `font-semibold` (`AmountText weight="semibold"`), since Poppins Bold looks too heavy at that size. Changing fonts needs a new native build.
  - Poppins has no ৳ glyph (it falls back to the system font) and only proportional digits, so `tabular-nums` has no effect.
- Props that can't take `className` (tab icons, navigation header, `placeholderTextColor`, `Switch`) get hex values from `useGluestackColors()`. Per-item colours (category swatches) are keys into `CATEGORY_COLORS`, applied via `style`.
- Add components with `bunx gluestack-ui@latest add <component> --use-bun`. The output lands in `src/lib/gluestack-ui/<component>/`. The CLI is alpha. After adding:
  - install any dependency it skipped (it skipped `@legendapp/motion` for `actionsheet`).
  - check `bunx tsc --noEmit`. `button`, `input` and `actionsheet` needed `as any` casts on the `cssInterop` `nativeStyleToProp` object.
  - delete any stray root `globals.css` it creates.
  - make sure it didn't change `tailwind.config.js`, `babel.config.js` or `metro.config.js`.
- Config files: `tailwind.config.js`, `postcss.config.js`, `babel.config.js` (`jsxImportSource: 'nativewind'` + `nativewind/babel`), `metro.config.js` (`withNativeWind`, input `./src/global.css`; `wasm` added to `assetExts` for expo-sqlite on web), `nativewind-env.d.ts`, `gluestack-ui.config.json`.

## Forms

React Hook Form + Zod via `zodResolver` from `@hookform/resolvers/zod`.

- **Schema first:** each `src/lib/schemas/*.schema.ts` exports the schema, its `z.infer` type and a `defaults` object. Validation messages and types come only from the schema, never from the `rules` prop. Put `.trim()` and other normalisation (e.g. taka → poisha) in the schema, since `onSubmit` receives the schema's output.
- **Always `<Controller>`, never `register()`.** React Native's `TextInput` has no DOM ref.
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

Done: design and all screens below running on sample data (`src/lib/mocks`), plus the spending-over-time chart, paging, loading states and dialogs. Next: the database, then replace the mocks.

1. Add / edit / delete transactions; list grouped by day
2. Accounts with derived balances; total money; monthly summary (income, expenses, saved, moved to savings, by category)
3. CSV import from the spreadsheet
4. Parent links + tree view ("remaining" from a withdrawal)
5. More charts (spending chart done), per-category budgets, DPS details and reminders, app lock
6. Backup/export, then open source

## Conventions

- Keep money math in one module (parse, format, add) with unit tests. Format with the taka sign and Bangladeshi digit grouping (lakh/crore: first group of three, then groups of two), consistent across the app.
- Package manager is **bun**. `bun.lock` is committed (never gitignore it), and there must be no `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`. Use `bun install`, `bunx expo install <pkg>` for dependencies and `bunx` instead of `npx`.
- Run `bunx expo lint`, `bunx tsc --noEmit` and `bun run test` before calling a task done. Lint warnings inside `src/lib/gluestack-ui` (`import/no-duplicates`) come from the generated code and can be ignored.
- ATM withdrawals use the tree (design B, may change): a transfer bank → Cash, with the cash spending added as linked expenses ("Add linked expense" on the withdrawal). The withdrawal shows what's left.
- Charts are drawn with plain themed views (`BarChart` in `src/lib/ui`), not a chart library: `react-native-gifted-charts` needs `expo-linear-gradient` (a native rebuild) and `victory-native` needs Skia. Revisit only for chart types views can't do.
- The Transactions list shows whole days in pages of 30 (`takeDays`) with a "Load more" button. With the DB, the page size becomes the query `LIMIT`.
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
- Dates in forms use `DateField` (day stepper + Today/Yesterday), so no native date-picker module is needed yet.
- App icon and splash images (`assets/images`) are still Expo's; their background colours are navy `#1E2A5E` (takes effect after a native rebuild).
- **Dev server:** run Metro in watch mode (`bun start`), not with `CI=1`, which disables reloads. If the app shows "Cannot read property 'ErrorBoundary' of undefined" after several quick edits, it's a Fast Refresh glitch: do a full reload (`r` in Metro or dev menu → Reload). If it survives a reload, check the Metro output for the real error.
- Before open-sourcing: replace the template LICENSE (currently copyright Expo) and README.
