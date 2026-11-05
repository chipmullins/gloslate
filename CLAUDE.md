# Tabitat — notes for Claude

Tabitat keeps a running tab of shared home costs for 2–5 people, does the math, and tells each person what to send. Payment happens in Venmo / Cash App / Zelle. **Tabitat never holds or moves money.**

Owner: Chip Mullins. Brand line: "Tabitat by Glofly". Legal owner: HarborWorks.

## Source of truth

- Build brief: claude.ai Project "HomeTab" → `claude/hometab-build-brief.md`
- Feature spec & flows: https://claude.ai/artifact/9AP1sjnbmfZCLEmeb3fgsg
- Design canvas: https://claude.ai/artifact/HBmiVQN891SWmHJpUzz51a — build from the **v3 row**; v2 row for 3–5 person views; v1 is superseded.
- The spec's "v1 vs later" table is superseded by the brief: **everything ships in the first release.**
- Decisions log: `docs/decisions.md`

## Layout

```
api/      Rails 8 (API mode) + server-rendered request pages, landing page
mobile/   Expo (React Native, TypeScript, expo-router)
infra/    AWS CloudFormation (infra/aws/tabitat.yml); the server pulls images from ghcr.io (docs/deploy.md)
docs/     decisions, admin API, Glofly integration, runbooks
```

## Non-negotiable rules

1. **Money is integer cents.** No floats/decimals in app code. Odd cents go to the payer's share.
2. **Append-only ledger.** Expenses, edits, deletions, payments are events. Balances are always computed, never stored as editable numbers. Edits keep old/new values.
3. **Split / netting / simplify-debts logic is pure and heavily tested** before UI is built on it.
4. **Statements are frozen.** Later changes become adjustment lines on the next statement.
5. **No money movement.** Copy says a payment was *marked* or *confirmed by a person*, never verified by Tabitat.
6. **Auth is provider-agnostic.** `users` has many `identities (provider, provider_uid)`. Launch providers: email, phone, apple, google. `glofly` drops in later with no schema change.
7. **Request pages** are public by unguessable token; show first names, amounts, breakdown only.
8. **Admin API from day one** (see `docs/admin-api.md`). Staff are a separate auth realm from app users; every staff action is audit-logged.
9. **Never modify the Glofly repo or backend.** Track required Glofly changes in `docs/glofly-integration.md`.

Renamed from HomeTab on Nov 4, 2026. The repo (`chipmullins/hometab`), the Ruby namespace (`Hometab::`, `lib/hometab/`) and dev/test database names keep the old name on purpose; everything users, stores or AWS see says Tabitat (`tabitat.app`, bundle ID `app.tabitat`, scheme `tabitat://`, AWS names `tabitat-*`).

## Design system (layout from canvas v3; colors and logo from the Tabitat logo canvas)

- Logo: **B, the t-roof monogram** (a lowercase t rising into a roof), white on brand. Source: `HouseMark` in `mobile/src/components/icons.tsx` and `api/app/views/public/_mark.html.erb`. Logo canvas: https://claude.ai/artifact/QihYwPjZp7mtBypJJLwZBm
- Fonts: **Manrope** (UI, 400–800), **IBM Plex Mono** (all money amounts, 500–600)
- Colors (**Plum & Sage**): ground `#F6F2F4`, ink `#241A23`, muted `#685A66`, brand plum `#6B3A63`, plum tint `#EFE3EC`, owed-to-you sage `#3A7457`, you-owe `#A8441C`, hairline `#E9E0E6`, chip border `#DCCFD8`, dark card `#241A23` (owed on dark `#A9D9BD`). Owed-to-you is no longer the brand color: use `owedToYou` / `--owed` for money owed to you, never `brand`.
- Radii: cards 24, tiles 14, buttons 15–16, pill FAB 29
- Touch targets ≥ 44pt. Icons: stroke SVG, no emoji.
- **Every screen adapts** to iPhone, iPad, Android phones/tablets and foldables via `useLayout()` (`mobile/src/hooks/use-layout.ts`): ≥700dp wide = two columns / side-by-side; content capped (`HT.maxWidth`); rotation, iPad split view and fold changes re-render. Check phone (390), small Android (360), unfolded foldable (~884) and iPad portrait/landscape.
- Android: custom fonts need one family per weight (`HT.font.*`), never `fontWeight`.
- Expo installs: this workspace can't reach Expo's version API, so install with npm using versions from `node_modules/expo/bundledNativeModules.json`.
- Tokens live in `mobile/src/constants/theme.ts`; the Rails views mirror them in `api/app/assets/stylesheets/tokens.css`.

## Build sequence

See the brief. Current step is tracked in `docs/decisions.md` → "Status".
