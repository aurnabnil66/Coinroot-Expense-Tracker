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

Planned (add with `bunx expo install` when the feature needs it, then move it to the table above):

| Need | Library |
|---|---|
| Charts | `victory-native` or `react-native-gifted-charts` |
| CSV import | `expo-document-picker` + `papaparse` |
| Export / backup | `expo-file-system` + `expo-sharing` |
| Dates | `date-fns` |
| App lock | `expo-local-authentication` |
| Small app state (only if needed) | Zustand. Prefer DB live queries as the source of truth. |
| Tests (for the money module) | Jest via `jest-expo` |

Do not upgrade to Tailwind v4 / NativeWind v5 until they are stable.

## Folder structure

`src/app/` is routing only. All other code lives in `src/lib/<layer>/`. Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.

Expo Router treats **every** `.ts`/`.tsx` file under `src/app/` as a route (no naming convention or `(group)` folder excludes one), so never put non-route files there.

| Dir | Purpose |
|---|---|
| `src/app/` | Expo Router routes and layouts only |
| `src/lib/screens/<name>/` | Full-page screens, one per route. `<name>` is the route group (e.g. `transactions/`) or the route itself (`home/`). Nothing sits directly in `src/lib/screens/`. |
| `src/lib/ui/` | Reusable, feature-agnostic UI components, built from gluestack-ui + `className` |
| `src/lib/hooks/` | Shared hooks |
| `src/lib/constants/` | Static values (`theme.constants.ts`: `Colors`, `Fonts`, `Spacing`, `BottomTabInset`, `MaxContentWidth`) |
| `src/lib/schemas/` | Zod schemas, their inferred types and form defaults |
| `src/lib/gluestack-ui/` | Vendored gluestack-ui components, one folder each. Owned, editable code. |
| `src/global.css` | The only global stylesheet and the NativeWind entry (`@tailwind` directives + font variables) |
| `assets/` | Images and icons (repo root) |

New layers follow the same `src/lib/<layer>/*.<suffix>.ts(x)` shape with their own barrel. Expected ones for Coinroot: `src/lib/db/` (`*.db.ts`: Drizzle schema, client, queries), `src/lib/utils/` (`*.util.ts`: money math, date helpers). Add a `src/lib/components/` layer only when something feature-aware and reusable (but not a screen) appears.

## File naming

- All filenames are kebab-case, with a suffix naming their layer: `*.screen.tsx`, `*.ui.tsx`, `*.hook.ts`, `*.constants.ts`, `*.schema.ts` (and `*.db.ts`, `*.util.ts` for new layers).
- Platform variants keep the suffix before the platform extension: `use-color-scheme.hook.web.ts`, `app-tabs.ui.web.tsx`.
- Exceptions: `index.ts` barrels, `_layout.tsx` and route files in `src/app/`, and everything in `src/lib/gluestack-ui/` (the CLI's own `index.tsx` per component; don't rename).
- Export names: screens are `PascalCase` with a `Screen` suffix (`home.screen.tsx` → `HomeScreen`), hooks are `useX` (`use-theme.hook.ts` → `useTheme`), UI components are `PascalCase` named exports, constants are `PascalCase` or `UPPER_SNAKE_CASE`.

## Barrels (`index.ts`)

- Every `src/lib/` layer has an `index.ts` with `export * from './x.<suffix>'` lines in alphabetical order. Consumers import from the layer: `import { Spacing } from '@/lib/constants'`. When adding a file, add its line to the barrel.
- Inside a layer, import siblings by relative path (`./themed-text.ui`), not through the layer's own barrel.
- `AppTabs` is the only default export: `export { default as AppTabs } from './app-tabs.ui'`.
- Never re-export `.web` files; Metro picks them automatically.
- No barrels in `src/lib/screens/<name>/` or `src/lib/gluestack-ui/`. Import those by full path:
  `import { HomeScreen } from '@/lib/screens/home/home.screen'`, `import { Button, ButtonText } from '@/lib/gluestack-ui/button'`.

## Routes (`src/app/`)

- Tabs live in the `(tabs)` group (`(tabs)/_layout.tsx` re-exports `AppTabs`) under a root `Stack`. Screens that aren't tabs (modals, add/edit forms, detail pages) sit next to `(tabs)` at the `src/app/` root and get a `<Stack.Screen>` entry in the root layout. `NativeTabs` lists its tabs explicitly, so a non-tab route must not sit inside `(tabs)`.
- Route files only re-export the screen. No logic, hooks or styling:
  ```tsx
  // src/app/(tabs)/index.tsx
  export { HomeScreen as default } from '@/lib/screens/home/home.screen';
  ```
- The root `src/app/_layout.tsx` imports `@/global.css` and owns `GluestackUIProvider` (outermost, `mode="system"`), the react-navigation `ThemeProvider`, `AnimatedSplashOverlay` and the root `Stack`. When the DB lands, the Drizzle `useMigrations` gate (spinner → error → app) goes here too.

## Styling

- Use gluestack-ui components (`Box`, `VStack`, `HStack`, `Text`, `Heading`, `Button`, `Input`, `Pressable`, `Icon`, `Divider`) with Tailwind `className`, not `StyleSheet.create`. Dynamic numeric values with no Tailwind token (e.g. `MaxContentWidth`, `BottomTabInset`) go in `style` next to `className`.
- Theme colours are CSS variables in `src/lib/gluestack-ui/gluestack-ui-provider/config.ts` (`--primary`, `--background`, `--muted`, `--destructive`, …), mapped to Tailwind colours in `tailwind.config.js`. Use `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, never raw hex. Dark mode follows the system through the provider. Coinroot's brand colours go into `config.ts`.
- Add components with `bunx gluestack-ui@latest add <component> --use-bun`. The output lands in `src/lib/gluestack-ui/<component>/`. The CLI is alpha. After adding:
  - check `bunx tsc --noEmit`. `button` and `input` needed `as any` casts on the `cssInterop` `nativeStyleToProp` object.
  - delete any stray root `globals.css` it creates.
  - make sure it didn't change `tailwind.config.js`, `babel.config.js` or `metro.config.js`.
- Config files: `tailwind.config.js`, `postcss.config.js`, `babel.config.js` (`jsxImportSource: 'nativewind'` + `nativewind/babel`), `metro.config.js` (`withNativeWind`, input `./src/global.css`), `nativewind-env.d.ts`, `gluestack-ui.config.json`.
- **Legacy (from the Expo template):** `ThemedText`, `ThemedView`, `useTheme()` and `Colors`/`Spacing`/`Fonts` still back `AppTabs` (the native tab bar can't take `className`), `AnimatedIcon` and the placeholder home/explore screens. Don't use them in new code.

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

1. Add / edit / delete transactions; list grouped by day
2. Accounts with derived balances; total money; monthly summary (income, expenses, saved, moved to savings, by category)
3. CSV import from the spreadsheet
4. Parent links + tree view ("remaining" from a withdrawal)
5. Charts, per-category budgets, DPS details and reminders, app lock
6. Backup/export, then open source

## Conventions

- Keep money math in one module (parse, format, add) with unit tests. Format with the taka sign and Bangladeshi digit grouping (lakh/crore: first group of three, then groups of two), consistent across the app.
- Package manager is **bun**. `bun.lock` is committed (never gitignore it), and there must be no `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`. Use `bun install`, `bunx expo install <pkg>` for dependencies and `bunx` instead of `npx`.
- Run `bunx expo lint` and `bunx tsc --noEmit` before calling a task done. Lint warnings inside `src/lib/gluestack-ui` (`import/no-duplicates`) come from the generated code and can be ignored.
- The home/explore screens (`src/lib/screens/home`, `src/lib/screens/explore`) and their template-only UI pieces (`AnimatedIcon`, `HintRow`, `WebBadge`, `Collapsible`) are Expo placeholders. Replace them with Coinroot screens.
- Before open-sourcing: replace the template LICENSE (currently copyright Expo) and README.
