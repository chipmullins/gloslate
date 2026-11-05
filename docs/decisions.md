# Tabitat decisions

## Settled Nov 4, 2026 (evening): rename and new look

| Topic | Decision |
| --- | --- |
| Name | **Tabitat** (tab + habitat), renamed from HomeTab, which was taken as a domain and is also a browser-extension name. Branding "Tabitat by Glofly" |
| Domain | **tabitat.app** |
| Logo | **B · t-roof monogram**: a lowercase t rising into a roof, white on plum. Replaces the receipt house. Canvas: https://claude.ai/artifact/QihYwPjZp7mtBypJJLwZBm |
| Colors | **Plum & Sage**: brand plum `#6B3A63`, owed-to-you sage `#3A7457`, you-owe `#A8441C`, ground `#F6F2F4`, ink `#241A23` |
| Hosting | Lean: one Tabitat-only EC2 server (`t3.micro`) runs staging + production with Kamal, Postgres on its own disk with nightly S3 backups (RDS later). Isolated from Glofly (own VPC, scoped IAM). See `docs/deploy.md` |
| Kept internal | Repo `chipmullins/hometab`, Ruby namespace `Hometab::`, dev/test database names |

## Settled Nov 4, 2026 (build chat)

| Topic | Decision |
| --- | --- |
| Logo | ~~A · Receipt house~~ (replaced by logo B, above) |
| Hosting | **Kamal 2 on EC2** (Docker), RDS Postgres, S3, SES, Route 53. Region `us-east-1`. Environments: staging + production |
| Receipt OCR | **On-device**: Apple Vision (iOS) / ML Kit text recognition (Android). Total detection first; itemizing parses recognized lines on device. No receipt image leaves the phone for OCR (photo is still uploaded to S3 only if the user attaches it) |
| Push | **Expo push service** (one API for APNs + FCM). Server sends via `expo-server-sdk`-style HTTP calls from Solid Queue jobs |
| Branding | "Tabitat by Glofly", HarborWorks as legal owner |
| Admin | Admin API ships from day one so a future Tabitat Control / HarborWorks Control app can plug in (see `admin-api.md`) |

## Earlier (Nov 2–4, see brief)

Rails 8 API + Postgres + Solid Queue; Expo/TypeScript/expo-router; integer cents; append-only ledger; everything in the spec ships in the first release.

## Status

- [x] Steps 1–12 built (Nov 4, 2026): ledger engine, auth + admin realm, households/invites, expenses, bills, payments, requests + public pages, statements + exports, notifications + widgets, receipts (on-device OCR + itemizing), settings/Face ID/export/deletion. API ~100 tests, app typecheck + lint + tests in CI.
- [ ] Step 13: AWS production (Kamal on EC2), TestFlight + Play internal testing, beta. Needs Chip's accounts — see docs/running.md.
- Not yet verified on a real device: Sign in with Apple, push delivery, widgets, Face ID, native receipt OCR (all need a development build). Google sign-in button in the app needs client IDs.
