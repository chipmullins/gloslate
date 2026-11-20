# Gloslate

**Shared home costs, without the awkward math.** Gloslate keeps a running tab of what roommates, friends and travel groups spend together, works out who owes whom, and tells each person exactly what to send. Payment happens in the apps people already use (Venmo, Cash App, Zelle): **Gloslate never holds or moves money.**

*Gloslate by Glofly* · [gloslate.app](https://gloslate.app) · iOS, Android and web ([app.gloslate.app](https://app.gloslate.app))

> The repo is still named `hometab` (the project's first name). It was renamed to Tabitat and then to Gloslate in November 2026. Internal names (`Hometab::`, bundle ID `app.tabitat`, AWS `tabitat-*`) keep the older names on purpose, so renames never break installed apps or infrastructure.

---

## What it does

| | |
| --- | --- |
| **Homes** | A running tab for 2–5 roommates: rent, utilities, groceries. Recurring bills post on their own (fixed amounts, or "variable" bills that wait for the amount). Monthly statements are frozen once sent. |
| **Friends & groups** | One-on-one tabs ("you owe me") and groups for trips or dinners. Several people can pay for one thing, and the app finds the **fewest payments** to settle everyone. |
| **One number per person** | If you share a home *and* a trip with someone, Gloslate nets it into one amount and settles across every tab at once. |
| **Splits** | Equal, by shares, or by exact amounts. Itemize a receipt line by line. Receipt text is read **on the phone**, so the image never leaves it for OCR. |
| **Payments** | Mark "I paid" and the other person confirms. Either side can question a payment for 30 days. Partial payments and credits are handled. |
| **Requests** | A private link (`/r/…`) and share image anyone can open without the app. It shows first names, amounts and the breakdown only. Pick a reminder tone: Gentle, Plain or Cheeky. |
| **Reminders** | Automatic nudges with quiet hours, so nobody has to be the bad guy. They stop the moment a payment is marked. |
| **Live & offline** | Screens update within seconds when someone else changes something. Expenses added offline wait on the phone and sync safely later, never twice. |
| **Delight** | The "clean slate" moment when you're square with someone, a year recap (what you shared, never who paid more), dark mode, home-screen widgets, Siri Shortcuts. |
| **Trust & privacy** | Face ID lock, full data export (CSV/JSON), in-app account deletion, profile photos never shown on public pages. |
| **Gloslate Control** | A staff console with an audit-logged admin API, a kill switch, and a separate login (password plus a required authenticator code). |

---

## Tech stack

| Layer | Choice |
| --- | --- |
| **Backend** | Ruby on Rails 8.1 (API mode) on Ruby 3.3, plus a few server-rendered pages: landing site, public request pages, legal pages and the Gloslate Control console |
| **Database** | PostgreSQL. Ledger rules are enforced by **database triggers**, not only by app code |
| **Background work** | Solid Queue recurring jobs (posting bills, reminders, auto-confirm, statements) and Solid Cache (rate limits) |
| **Mobile** | React Native 0.88 through **Expo SDK 58** (TypeScript, expo-router). One codebase for iPhone, iPad, Android phones, tablets, foldables and the web |
| **Native extras** | Expo Widgets, Sign in with Apple, Face ID, on-device receipt OCR, and App Intents (Siri Shortcuts) added through a custom config plugin |
| **Animation** | Reanimated 4: the hopping-bunny loader and the clean slate moment. Reduce Motion is respected throughout |
| **Push** | Expo Notifications (APNs and FCM), with batching, quiet hours and per-type preferences |
| **Images** | libvips renders share cards and the year recap server-side from SVG |
| **Auth** | Provider-agnostic identities: email and phone codes, Apple, Google, and **Sign in with Glofly** (OIDC with PKCE). A `users` → `identities (provider, uid)` design means a new provider needs no schema change |
| **Hosting** | AWS: one isolated EC2 server running staging and production side by side in Docker Compose, Caddy (automatic HTTPS), encrypted Postgres disks with nightly S3 backups, S3, SES and SNS. Defined in CloudFormation (`infra/aws/tabitat.yml`) |
| **CI/CD** | GitHub Actions: tests on every push. A push to `main` builds staging. "Promote" ships the same image to production. Phone updates go out over the air (EAS Update) and native builds through EAS/TestFlight |

### Repo layout

```
api/      Rails 8: JSON API (/v1), admin API (/admin/v1), Gloslate Control (/control), public pages
mobile/   Expo app (iOS, Android, web): src/app = screens (expo-router), src/components, src/lib
infra/    AWS CloudFormation for the whole environment
docs/     Decisions log, deploy runbook, security model, admin API, store privacy answers
```

---

## Why this stack

- **Rails 8 for a money app.** The hard part of Gloslate is correctness: splits, netting, statements and audit trails. Rails gave me mature transactions, Postgres features (triggers, constraints) and a fast test loop. Rails 8's built-in Solid Queue and Solid Cache meant no Redis or extra services to run and pay for on a small server.
- **Expo / React Native for reach.** One TypeScript codebase covers iOS, Android and a real web app. Expo's over-the-air updates let me ship fixes to phones in minutes without waiting on App Store review. Config plugins still let me drop down to native code where it matters (Siri Shortcuts, widgets).
- **Postgres as the last line of defense.** Expenses, edits and payments are an **append-only ledger**. Balances are always computed, never stored as editable numbers, and statements are frozen. Triggers enforce that even if app code has a bug.
- **One small AWS server instead of a managed platform.** Gloslate is a 2–5-person-per-home app, so a single `t3.micro` running staging and production costs about $10–15/month. It's fully isolated from my other app's infrastructure (own VPC, IAM role and buckets), and it pulls updates instead of letting GitHub into AWS.
- **Boring where it counts.** Money is integer cents everywhere (odd cents go to the payer), with no floats in app code. Gloslate only links out to payment apps, so there's no money transmission, no stored bank details and much less risk.

---

## How I built it

I built Gloslate as a solo founder-developer, using Claude (Anthropic) as an AI pair programmer. I owned the product: the idea, the feature spec, the money rules, the design direction and every trade-off. I reviewed and tested the work and shipped every release. The process:

1. **Spec and rules first.** A written build brief and feature spec, plus a set of non-negotiable engineering rules (integer cents, append-only ledger, frozen statements, no money movement, provider-agnostic auth). These were set before any code.
2. **The math before the UI.** The split, netting and "simplify debts" engine was written as pure, heavily tested service objects before any screen was built on it.
3. **Design on a canvas, then build.** Every visual feature was mocked up first (logo, the Plum Night color system, screens, the clean slate animation). I picked a direction before it was built. Design tokens live in one file and are mirrored in the Rails CSS.
4. **Small, reviewed releases.** Pull requests run CI (Rails tests against real Postgres, TypeScript checks, lint and unit tests). Each release goes to staging, gets checked, then is promoted to production. Native fingerprints are checked so an over-the-air update never reaches a build that can't run it.
5. **A decisions log.** Every product and technical decision is dated in [`docs/decisions.md`](docs/decisions.md), so the "why" survives as long as the code.

---

## Running it

See [`docs/running.md`](docs/running.md) for local setup, [`docs/deploy.md`](docs/deploy.md) for AWS, and [`docs/ios.md`](docs/ios.md) for iPhone builds. Quick version:

```bash
# API (Ruby 3.3.6, PostgreSQL 16, libvips)
cd api && bundle install && bin/rails db:prepare
bin/rails s          # http://localhost:3000
bin/rails test

# App (Node 22)
cd mobile && npm install
EXPO_PUBLIC_API_URL=http://<your-ip>:3000 npx expo start
npm run typecheck && npm run lint && npm test
```

## More docs

- [`docs/security.md`](docs/security.md): auth realms, rate limits, money-trust rules
- [`docs/admin-api.md`](docs/admin-api.md): the staff API behind Gloslate Control
- [`docs/glofly-integration.md`](docs/glofly-integration.md): Sign in with Glofly
- [`docs/store-privacy.md`](docs/store-privacy.md): App Store and Google Play privacy answers

---

© 2026 Chip Mullins. All rights reserved.
