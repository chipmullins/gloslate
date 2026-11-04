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

- [x] Step 1: repo, CLAUDE.md, Expo skeleton, Rails 8 app (bootstrapped by GitHub Actions; gems vendored in api/vendor/cache so the build workspace installs offline), CI on every push
- [x] Step 2: money engine (api/lib/hometab/ledger) + households, members, expenses, shares, payments, allocations, append-only ledger_events (DB trigger blocks UPDATE/DELETE). Services: Expenses::Create/Update/Destroy/Restore, Payments::Mark/Respond (confirm, dispute, 3-day auto-confirm, receiver-recorded cash). 31 tests.
- [x] Step 3: sign-in by email/phone code, Sign in with Apple, Google (native ID tokens verified against provider keys, stdlib OpenSSL — no extra gems). users → identities (provider, provider_uid); glofly is one more provider config, no schema change. Link offer when a provider's verified email matches an existing account. Opaque device tokens (digest stored), revocable.
- [x] Admin API realm: staff_users (scrypt password + required TOTP 2-step), 12h staff sessions, roles viewer/support/admin, admin_audit_events on every read of personal data and every action (reason required). Endpoints: dashboard, user search/detail, revoke sessions, lock/unlock, send sign-in code, add/remove identity, household detail + read-only ledger, audit log, staff management. First admin: `bin/rails staff:create EMAIL=... NAME=...`. 53 tests total.
- [ ] Step 4: households, members, invites by link, placeholders joining (API + mobile)
- Pending infra: SMS delivery adapter (SNS) and SES email in step 13; until then codes are logged in development.
