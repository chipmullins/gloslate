# Gloslate — notes for Claude

Gloslate keeps a running tab of shared home costs for 2–5 people, does the math, and tells each person what to send. Payment happens in Venmo / Cash App / Zelle. **Gloslate never holds or moves money.**

Owner: Chip Mullins. Brand line: "Gloslate by Glofly". Legal owner: HarborWorks.

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
5. **No money movement.** Copy says a payment was *marked* or *confirmed by a person*, never verified by Gloslate.
6. **Auth is provider-agnostic.** `users` has many `identities (provider, provider_uid)`. Launch providers: email, phone, apple, google. `glofly` drops in later with no schema change.
7. **Request pages** are public by unguessable token; show first names, amounts, breakdown only.
8. **Admin API from day one** (see `docs/admin-api.md`). Staff are a separate auth realm from app users; every staff action is audit-logged.
9. **Never modify the Glofly repo or backend.** Track required Glofly changes in `docs/glofly-integration.md`.

Renamed from HomeTab on Nov 4, 2026. The repo (`chipmullins/hometab`), the Ruby namespace (`Hometab::`, `lib/hometab/`) and dev/test database names keep the old name on purpose; at that point everything users, stores or AWS saw said Tabitat.

Renamed Tabitat → **Gloslate** on Nov 6, 2026, and moved to **gloslate.app** the same day (`api.gloslate.app`, `app.gloslate.app`, `staging.gloslate.app`, `support@gloslate.app`). tabitat.app stays registered: `api.tabitat.app` keeps serving older app installs, and everything else on tabitat.app redirects to gloslate.app with the same path. Email still sends from `hello@tabitat.app` until the gloslate.app SES identity is verified (then flip `MAIL_FROM`). Bundle ID `app.tabitat`, scheme `tabitat://`, Expo slug, AWS names `tabitat-*` and GitHub artifact names are unchanged on purpose.

## Design system (layout from canvas v3; Plum Night colors, logo and fonts from the GloNight brand canvas)

- Logo: **C · Bunny on the slate** (GloBunny canvas): a little off-white bunny sitting on top of a near-black slate with an off-white check, on a plum-night tile, with an amber sparkle + halo beside it; `inverted` = glass tile for night surfaces. Small sizes use the canvas's simplified drawings (under 72px: heavier strokes, no tail/eye/halo; under 48px and the favicon: one ear, plain slate). Wordmark: "glo" amber + "slate" off-white, Outfit 700. Source: `HouseMark` (old name kept) in `mobile/src/components/icons.tsx` and `api/app/views/public/_mark.html.erb`; also inlined in `api/app/services/requests/image.rb` and `api/public/site/og-v2.png`. App icon PNGs: `mobile/scripts/render-icons.py`.
- Loading: the **hopping bunny** (`BunnyLoader` / `FullScreenLoader` in `mobile/src/components/bunny-loader.tsx`, from the GloBunnyLoader canvas) for full-screen waits (night tone at app start, light on screens); busy buttons show a tiny bunny (`ButtonBunny`). Pull-to-refresh keeps the plain spinner.
- Fonts: **Outfit** (headings, names, titles, wordmark: `HT.font.display*`), **DM Sans** (everything else, 400–700). Money: DM Sans with fixed-width digits (`HT.font.mono`/`monoBold` → "DM Sans Tabular", made by `mobile/scripts/tabular-font.py` since DM Sans has no `tnum`); `Money` also sets tabular-nums. **IBM Plex Mono** only for tiny caps labels (`HT.font.label`, "BY GLOFLY").
- Colors (**Plum Night**): everyday screens stay light: ground `#F6F2F4`, ink `#241A23`, muted `#685A66`, brand plum `#6B3A63`, plum tint `#EFE3EC`, owed-to-you sage `#3A7457`, you-owe coral `#B4472A`, hairline `#E9E0E6`, chip border `#DCCFD8`. Hero surfaces (balance card, settle summary, sign-in, site hero) are the night sky `#4A2C5A → #2A1A33 → #140C18`: use `<NightSurface>` / `Card dark` in the app, `var(--night-sky)` on the web, never a flat dark color. On night: text `#F3EEF5` / `#BBA9C4`, owed `#A9D9BD`, owe `#FF9E80`, glass buttons `#FFFFFF14`. **Amber `#FFB547` (glow) is only the glow**: logo sparkle, highlights, the primary action on night (Request, I paid; `Button kind="onDark"`). It never means "you owe". Owed-to-you is no longer the brand color: use `owedToYou` / `--owed` for money owed to you, never `brand`.
- Radii: cards 24, tiles 14, buttons 15–16, pill FAB 29
- Touch targets ≥ 44pt. Icons: stroke SVG, no emoji.
- **Every screen adapts** to iPhone, iPad, Android phones/tablets and foldables via `useLayout()` (`mobile/src/hooks/use-layout.ts`): ≥700dp wide = two columns / side-by-side; content capped (`HT.maxWidth`); rotation, iPad split view and fold changes re-render. Check phone (390), small Android (360), unfolded foldable (~884) and iPad portrait/landscape.
- Android: custom fonts need one family per weight (`HT.font.*`), never `fontWeight`.
- Expo installs: this workspace can't reach Expo's version API, so install with npm using versions from `node_modules/expo/bundledNativeModules.json`.
- Tokens live in `mobile/src/constants/theme.ts`; the Rails views mirror them in `api/app/assets/stylesheets/tokens.css`.

## Build sequence

See the brief. Current step is tracked in `docs/decisions.md` → "Status".
