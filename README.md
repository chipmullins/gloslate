# Gloslate

Gloslate keeps a running tab of shared costs for roommates, friends and trips. It does the math and tells each person what to send. You still pay in Venmo, Cash App or Zelle. Gloslate never holds or moves money.

It runs on iPhone, Android and the web: [gloslate.app](https://gloslate.app) · [app.gloslate.app](https://app.gloslate.app)

![Ruby on Rails 8](https://img.shields.io/badge/Ruby_on_Rails_8-CC0000?style=flat-square&logo=rubyonrails&logoColor=white) ![Ruby 3.3](https://img.shields.io/badge/Ruby_3.3-CC342D?style=flat-square&logo=ruby&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![Expo SDK 58](https://img.shields.io/badge/Expo_SDK_58-000020?style=flat-square&logo=expo&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![AWS](https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazonwebservices&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)

| Backend | App | Data | Infrastructure |
| --- | --- | --- | --- |
| Rails 8 API · Solid Queue · Solid Cache | React Native · Expo · TypeScript · expo-router | PostgreSQL · S3 | AWS EC2 · Docker · Caddy · CloudFormation · GitHub Actions · EAS |

> Gloslate started out as HomeTab, then became Tabitat, and then Gloslate in November 2026 (mostly because of naming conflicts). This repo used to be `hometab`. I left internal names (`Hometab::`, the bundle ID `app.tabitat`, the AWS `tabitat-*` resources) alone on purpose, since renaming them would break installed apps and infrastructure for no real gain.

## What it does

- **Homes.** A shared tab for 2–5 roommates covering rent, utilities and groceries. Recurring bills post on their own, and variable ones (like the power bill) wait for someone to enter the amount. Monthly statements are frozen once they go out.
- **Friends and groups.** One-on-one tabs and groups for trips or dinners. More than one person can pay for something, and settling up uses the fewest possible payments.
- **One number per person.** If you live with someone and also went on a trip with them, Gloslate nets it all into one amount and can settle every tab at once.
- **Splits.** Equal, by shares, or exact amounts, and you can itemize a receipt line by line. Receipt text is read on the phone, so the photo isn't sent anywhere for that.
- **Payments.** You mark "I paid" and the other person confirms it. Either of you can question a payment for 30 days. Partial payments and credits work too.
- **Requests.** A private link and share image anyone can open without the app, showing only first names and amounts. You pick how pushy the reminder sounds: Gentle, Plain or Cheeky.
- **Reminders.** Automatic nudges, with quiet hours, so nobody has to be the one who asks. They stop as soon as a payment is marked.
- **Live and offline.** Screens update within a few seconds when someone else changes something. If you add an expense offline, it's saved on the phone and sent once you're back online, never twice.
- **The fun stuff.** A little "clean slate" animation when you're square with someone, a year recap (what you shared, never who paid more), dark mode, home screen widgets and Siri Shortcuts.
- **Privacy.** Face ID lock, full data export, and account deletion inside the app. Public pages never show profile photos.
- **Gloslate Control.** A staff console with its own login (password plus an authenticator code), an audit log of every staff action, and a kill switch.

## Tech stack

| Layer | What I used |
| --- | --- |
| Backend | Rails 8.1 (API mode) on Ruby 3.3, plus a few server-rendered pages: the website, public request pages, legal pages and Gloslate Control |
| Database | PostgreSQL, with database triggers that keep the ledger append-only |
| Background jobs | Solid Queue for scheduled work (posting bills, reminders, auto-confirming, statements) and Solid Cache for rate limits |
| App | React Native 0.88 with Expo SDK 58, TypeScript and expo-router. One codebase for iPhone, iPad, Android phones and tablets, foldables and the web |
| Native extras | Expo Widgets, Sign in with Apple, Face ID, on-device receipt OCR, and Siri Shortcuts through my own config plugin |
| Animation | Reanimated 4 (the hopping bunny loader and the clean slate moment), with Reduce Motion respected |
| Push | Expo Notifications (APNs and FCM), with batching, quiet hours and per-type settings |
| Images | libvips turns SVG into the share cards and year recap images on the server |
| Sign-in | Email or text codes, Apple, Google, and Sign in with Glofly (my messaging app, OpenID Connect with PKCE). Users have many identities, so adding a new provider doesn't change the schema |
| Hosting | One isolated AWS EC2 server running staging and production in Docker Compose, Caddy for HTTPS, Postgres on encrypted disks with nightly backups to S3, plus SES for email and SNS for texts. All defined in CloudFormation |
| CI/CD | GitHub Actions. Tests run on every push, a push to `main` builds staging, and one button promotes the same image to production. App fixes go out over the air with EAS Update; native builds go through EAS to TestFlight |

```
api/      Rails: the app API, staff API, Gloslate Control and public pages
mobile/   Expo app for iOS, Android and web
infra/    CloudFormation for the AWS setup
docs/     decisions log, deploy and security notes, store privacy answers
```

## Why I picked this stack

- **Rails for the money side.** The hard part of this app is getting the numbers right every time: splits, netting, statements and an audit trail. Rails and Postgres give me solid transactions, constraints and triggers, and a quick test loop. Rails 8 also has background jobs and caching built in, so I didn't need Redis or anything else running on a small server.
- **Expo so I only build it once.** One TypeScript codebase covers iPhone, Android and a real web app. Over-the-air updates mean I can ship a fix in minutes instead of waiting on App Store review, and I can still drop into native code when I need it (Siri, widgets).
- **The database as a safety net.** Expenses, edits and payments are only ever added, never changed in place. Balances are always calculated from that history, never stored as a number someone can edit. Statements are locked once sent. Postgres enforces all of that, so a bug in the app can't quietly rewrite history.
- **One cheap server.** Each home is 2–5 people, so a single small EC2 instance handles staging and production for about $10–15 a month. It's walled off from my other projects (its own network, permissions and storage), and it pulls its own updates, so GitHub never gets access to AWS.
- **Keep the risky parts simple.** All money is stored as whole cents (odd cents go to whoever paid) and there's no floating-point money math anywhere. Gloslate only links out to payment apps, so it never touches bank details or moves money.

## How I built it

I built Gloslate on my own, using Claude as an AI pair programmer. The product side was mine: the idea, the features, the rules for how money works, the look and feel, and every call about trade-offs. I reviewed and tested everything before it shipped. Roughly, here's how I worked:

1. **Rules before code.** I wrote a build brief and a feature spec first, along with a short list of rules I wouldn't break: whole cents, an append-only ledger, locked statements, never moving money, and sign-in that isn't tied to one provider.
2. **The math before the screens.** The split, netting and "fewest payments" logic was built and tested on its own before any screen used it.
3. **Mockups first.** I mocked up anything visual before building it (the logo, the Plum Night colors, screens, the clean slate animation) and picked the direction I liked. Colors and fonts live in one theme file that the website mirrors.
4. **Small releases.** Every change goes through a pull request with CI: Rails tests against a real Postgres, plus type checks, lint and unit tests for the app. It goes to staging first, then I promote it to production. Over-the-air updates check the native fingerprint first, so an update never lands on a build that can't run it.
5. **Write down the why.** Every real decision is dated in [`docs/decisions.md`](docs/decisions.md), so I can always see why something is the way it is.

## Running it locally

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

More detail in [`docs/running.md`](docs/running.md), [`docs/deploy.md`](docs/deploy.md) (AWS) and [`docs/ios.md`](docs/ios.md) (iPhone builds).

## Other docs

- [`docs/security.md`](docs/security.md): sign-in, rate limits and the rules around money
- [`docs/admin-api.md`](docs/admin-api.md): the staff API behind Gloslate Control
- [`docs/glofly-integration.md`](docs/glofly-integration.md): Sign in with Glofly
- [`docs/store-privacy.md`](docs/store-privacy.md): App Store and Google Play privacy answers

---

© 2026 Chip Mullins. All rights reserved.
