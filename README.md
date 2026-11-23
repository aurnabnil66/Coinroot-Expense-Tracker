# Coinroot

A personal money tracker for Bangladesh (৳ / BDT) that traces every taka back to where it came from.

Money doesn't just get spent: it moves. Salary lands in one bank account, part of it moves to another, an ATM withdrawal turns it into cash, and the cash pays for a rickshaw. Coinroot keeps that chain, so you can see where each expense's money came from and what's left of it. Transfers between your own accounts are never counted as spending.

```
Salary → Office bank account → Primary bank account → ATM withdrawal (→ Cash)
                                                        ├─ Transport expense
                                                        └─ still in cash
```

## Features

- Income, expenses and transfers across bank accounts, cash, mobile wallets and savings / DPS
- Balances worked out from your entries, with "Count cash" / "Check balance" to match reality
- Money tree: link an expense to the entry its money came from and follow the whole chain
- Monthly summary: income, spending by category, spending over time, moved to savings
- Import any spreadsheet (CSV or a pasted table), export to CSV, back up and restore a file
- Light and dark theme, Simple mode with quick add
- Optional account for cloud backup and sync between phones

## Privacy

Coinroot is local-first. Everything is stored in a database on your phone and the app works fully offline. Nothing leaves the phone unless you create an account and turn on cloud sync. There are no ads and no trackers.

## Install

Android APKs will be published on the [Releases](../../releases) page. iOS isn't released yet.

## Build from source

You need [Bun](https://bun.sh) and, for the Android app, a development build (the app uses native modules, so Expo Go isn't enough).

```bash
bun install          # once, at the repo root
bun run dev:mobile   # start Metro for the app
bun run dev:landing  # the website at http://localhost:4321
bun run check        # lint, typecheck, tests and builds
```

Sign-in and sync are optional. To use them, copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and fill in your own Supabase project's values; without them the app works fully offline.

| Path | What |
|---|---|
| `apps/mobile` | The Expo / React Native app |
| `apps/landing-page` | The website (Astro, static) |
| `supabase` | Optional cloud backend: SQL migrations and config |

## License

Copyright (C) 2026 Mnemonics HQ

Coinroot is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.

The Poppins font is licensed separately under the SIL Open Font License (`Poppins-OFL.txt` next to the font files).

If you publish your own version, please give it a different name and icon so people don't confuse it with Coinroot.
