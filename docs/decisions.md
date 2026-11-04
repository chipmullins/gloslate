# HomeTab decisions

## Settled Nov 4, 2026 (build chat)

| Topic | Decision |
| --- | --- |
| Logo | **A · Receipt house** (green rounded square, house with torn-receipt bottom) |
| Hosting | **Kamal 2 on EC2** (Docker), RDS Postgres, S3, SES, Route 53. Region `us-east-1`. Environments: staging + production |
| Receipt OCR | **On-device**: Apple Vision (iOS) / ML Kit text recognition (Android). Total detection first; itemizing parses recognized lines on device. No receipt image leaves the phone for OCR (photo is still uploaded to S3 only if the user attaches it) |
| Push | **Expo push service** (one API for APNs + FCM). Server sends via `expo-server-sdk`-style HTTP calls from Solid Queue jobs |
| Branding | "HomeTab by Glofly", HarborWorks as legal owner |
| Admin | Admin API ships from day one so a future HomeTab Control / HarborWorks Control app can plug in (see `admin-api.md`) |

## Earlier (Nov 2–4, see brief)

Rails 8 API + Postgres + Solid Queue; Expo/TypeScript/expo-router; integer cents; append-only ledger; everything in the spec ships in the first release.

## Status

- [x] Step 1 (partial): Expo skeleton, CLAUDE.md, docs
- [ ] Step 1: Rails skeleton — workspace can't reach rubygems.org; Rails app will be hand-written and installed/tested by GitHub Actions
- [x] CI: GitHub Actions runs the money engine tests on every push
- [~] Step 2: split (equal/%/exact/shares), per-pair balances, payments/credit, simplify debts — done in plain Ruby (api/lib/hometab/ledger), 17 tests incl. randomized checks. Next: ledger event models in Rails
