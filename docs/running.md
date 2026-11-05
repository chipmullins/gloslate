# Running Tabitat

## On your Mac (development)

Prereqs: Ruby 3.3.6, Node 22, PostgreSQL 16, libvips (`brew install vips`), Xcode for the iOS simulator.

```bash
# API
cd api
bundle install            # gems install from vendor/cache, no internet needed
bin/rails db:prepare
bin/rails s               # http://localhost:3000  (codes print in log/development.log)
bin/rails test            # full suite

# First admin for the admin API
bin/rails staff:create EMAIL=you@example.com NAME="Chip"

# App
cd ../mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-mac-ip>:3000 npx expo start
npm run typecheck && npm run lint && npm test
```

Expo Go runs most of the app. These need a **development build** (`npx eas-cli build --profile development`):
Sign in with Apple, push notifications, Face ID lock, home screen widgets, on-device receipt scanning.
In Expo Go, receipt scanning falls back to attaching the photo and typing the total.

## What step 13 needs from Chip

- **AWS** (us-east-1): one EC2 server (staging + production, Postgres on its own disk), S3 bucket for receipts and PDFs (private), SES (verify tabitat.app, request production access), SNS for SMS sign-in codes, Route 53 for tabitat.app.
- **Apple**: Team ID, App ID `app.tabitat` with Sign in with Apple, Associated Domains, Push; App Group `group.app.tabitat` (widgets).
- **Google Play**: developer account ($25), upload key SHA-256 for `assetlinks.json`.
- **Expo/EAS**: `npx eas-cli init` (sets `extra.eas.projectId`, required for push tokens).
- **Google sign-in**: OAuth client IDs (iOS, Android, web) → `GOOGLE_CLIENT_IDS`.

## Production environment variables (api)

| Variable | What |
| --- | --- |
| `RAILS_MASTER_KEY` | decrypts credentials (never commit `config/master.key`) |
| `TABITAT_DATABASE_PASSWORD` | RDS password |
| `ALLOWED_HOSTS` | default `tabitat.app,api.tabitat.app,admin-api.tabitat.app` |
| `PUBLIC_URL` | `https://tabitat.app` (request and invite links) |
| `S3_BUCKET`, `AWS_REGION` | receipts / exports (instance role, no keys) |
| `MAIL_FROM` | `Tabitat <hello@tabitat.app>` |
| `APPLE_CLIENT_IDS`, `GOOGLE_CLIENT_IDS` | ID token audiences |
| `APPLE_TEAM_ID`, `ANDROID_CERT_SHA256` | universal links (`/.well-known/...`) |
| `EXPO_ACCESS_TOKEN` | optional, for Expo push security |
| `APP_STORE_URL`, `PLAY_STORE_URL` | store links on the website and invite pages ("Coming soon" until set) |
| `SUPPORT_EMAIL` | contact address on Support, Privacy and Terms (default `support@tabitat.app`) |
| `LEGAL_DRAFT` | set to `false` once Privacy and Terms are reviewed, to hide the "Draft for review" notice |

## Before launch (not code)

- Privacy policy and terms pages (App Store requires a privacy policy URL).
- One hour with a fintech attorney to confirm the link-out payment model (spec open question).
- Tabitat trademark and the tabitat.app domain.
