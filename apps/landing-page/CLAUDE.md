# Coinroot website (`apps/landing-page`)

The landing page for the Coinroot app: what it does, why, privacy, and where to download the Android APK (from the GitHub Releases that `bun run release` publishes). Part of the Coinroot monorepo (see the root `CLAUDE.md`). Product facts come from `apps/mobile/CLAUDE.md`; don't promise features the app doesn't have.

## Stack

- **Astro** (static output, `dist/`), TypeScript strict, `astro check` for typecheck. No UI framework, so no React (keeps the repo on one React version).
- **Scripts:** `dev`, `build`, `preview`, `typecheck`. No `lint` or `test` on purpose: the page has almost no JavaScript (one reveal-on-scroll script) and `astro check` already catches type and template errors. Add ESLint (`eslint-plugin-astro`) and tests if the site gains real logic.
- **Plain CSS**: global tokens and base styles in `src/styles/global.css`, everything else in each file's scoped `<style>`. No Tailwind (the app pins Tailwind v3 for NativeWind; don't add a second version).
- **Fonts**: Poppins (400 / 500 / 600) served from `public/fonts` (copied from `apps/mobile/assets/fonts`, OFL licence alongside). No Google Fonts or other third-party requests: the page promises no trackers.
- Icons are inline SVGs in `src/components/icon.component.astro` (lucide style). Images in `public/` (logo, favicon, touch icon from the app's icon, and `og-image.png`, the 1200 × 630 social preview card).

## Layout

| Path | What |
|---|---|
| `src/pages/index.astro` | The page: hero, the idea (transfers vs spending), how it works, features, made for Bangladesh, privacy, download, FAQ, footer |
| `src/utils/latest-release.util.ts` | The download: `APK_URL` (`…/releases/latest/download/coinroot.apk`), `getLatestRelease()` (version, date and size of the latest GitHub Release, read at build time) and `apkQrSvg()` (the QR code, drawn at build time with `qrcode`) |
| `src/layouts/base.layout.astro` | `<head>` (meta, social preview, fonts) and the reveal-on-scroll script |
| `src/components/money-tree.component.astro` | The hero's animated SVG money tree (salary → accounts → spending) |
| `src/components/phone-mock.component.astro` | The app's Accounts tab drawn in HTML; `theme="light" / "dark"` uses the app's light or dark colours. The Made for Bangladesh section shows both: light in front, dark tilted behind it (`.phone-pair`), kept inside the column so narrow screens don't scroll sideways |
| `src/components/icon.component.astro` | Inline icon set |

File names are kebab-case with a suffix (`*.component.astro`, `*.layout.astro`), like the app.

## Rules

- Same brand as the app: navy `#1E2A5E` → purple `#6C4CF1` gradient, sky `#38BDF8` accent, money colours only for meaning (green income, rose expense, blue transfer). Colours are CSS variables in `global.css`, redefined for dark mode under `prefers-color-scheme: dark`.
- No real bank, wallet or institution names and no real amounts; use the app's generic account names ("Bank Account", "Cash", "Mobile Wallet", "Savings"). Say "savings", never "DPS", in any text people read.
- Amounts use the taka sign and lakh grouping (`৳2,45,300`).
- Motion respects `prefers-reduced-motion`; content stays visible without JavaScript (`[data-reveal]` only hides when the `js` class is set).
- Works from 320 px wide with no horizontal scroll.
- **Download section:** the button always links to `APK_URL`, which GitHub redirects to the newest release's `coinroot.apk`, so a new release needs no site change. The version / date / size line comes from `getLatestRelease()` at build time (the page makes no request to GitHub), so rebuild the site after a release to update it. Without a release (404: none yet, or the repo isn't public; it is public since 26 Nov 2026, and must stay so for the download and the app's update check) the section shows "Coming soon"; if GitHub can't be reached it still shows the button, without the details. The QR code (to the APK) is hidden below 520 px, where the button is the way in. With a release it also lists the three install steps (download, allow installs from the browser once, Install) and says how updates arrive (OTA fixes by themselves, the app's "new version" banner for APKs; see **App updates** in `apps/mobile/CLAUDE.md`). Releases repo: `RELEASES_REPO` (the app has its own copy in `release.constants.ts`; change both). Later, once the site is hosted: point the QR code at an `/install` page that starts the download and shows the steps with screenshots.
- Hosting is not set up yet. When the domain is known, set `site` in `astro.config.mjs`: `base.layout.astro` then adds the canonical link, `og:url` and `og:image` (absolute URLs, which crawlers need). Until then those tags are left out.
