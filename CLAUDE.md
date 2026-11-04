# HomeTab — notes for Claude

HomeTab keeps a running tab of shared home costs for 2–5 people, does the math, and tells each person what to send. Payment happens in Venmo / Cash App / Zelle. **HomeTab never holds or moves money.**

Owner: Chip Mullins. Brand line: "HomeTab by Glofly". Legal owner: HarborWorks.

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
infra/    Kamal 2 config, AWS notes
docs/     decisions, admin API, Glofly integration, runbooks
```

## Non-negotiable rules

1. **Money is integer cents.** No floats/decimals in app code. Odd cents go to the payer's share.
2. **Append-only ledger.** Expenses, edits, deletions, payments are events. Balances are always computed, never stored as editable numbers. Edits keep old/new values.
3. **Split / netting / simplify-debts logic is pure and heavily tested** before UI is built on it.
4. **Statements are frozen.** Later changes become adjustment lines on the next statement.
5. **No money movement.** Copy says a payment was *marked* or *confirmed by a person*, never verified by HomeTab.
6. **Auth is provider-agnostic.** `users` has many `identities (provider, provider_uid)`. Launch providers: email, phone, apple, google. `glofly` drops in later with no schema change.
7. **Request pages** are public by unguessable token; show first names, amounts, breakdown only.
8. **Admin API from day one** (see `docs/admin-api.md`). Staff are a separate auth realm from app users; every staff action is audit-logged.
9. **Never modify the Glofly repo or backend.** Track required Glofly changes in `docs/glofly-integration.md`.

## Design system (from canvas v3)

- Fonts: **Manrope** (UI, 400–800), **IBM Plex Mono** (all money amounts, 500–600)
- Colors: ground `#F3F4EF`, ink `#15201A`, muted `#56625B`, brand green `#1C6A4C`, green tint `#E3EFE8`, owed-to-you `#1C6A4C`, you-owe `#B0440C`, hairline `#E1E4DC`, chip border `#D5D9CF`, dark card `#15201A`
- Radii: cards 24, tiles 14, buttons 15–16, pill FAB 29
- Touch targets ≥ 44pt. Icons: stroke SVG, no emoji.
- Tokens live in `mobile/src/constants/theme.ts`; the Rails views mirror them in `api/app/assets/stylesheets/tokens.css`.

## Build sequence

See the brief. Current step is tracked in `docs/decisions.md` → "Status".
