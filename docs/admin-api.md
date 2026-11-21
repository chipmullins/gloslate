# Admin API (Gloslate Control)

I built this from day one so a staff console could plug in later. Gloslate Control (the console) now exists as server-rendered Rails pages at `/control` (see below); this JSON API stays the contract for a desktop Control later. The idea is that one console can eventually run both Glofly and Gloslate the same way.

## Status

Built (Nov 4, 2026): sign-in, roles, audit log, dashboard, user search/detail, revoke sessions, lock/unlock, send sign-in code, add/remove identity, household detail + read-only ledger, audit log, staff management. Still to come: activity feed, data export/delete via staff, job health, analytics rollups.

Create the first admin on the server: `bin/rails staff:create EMAIL=you@example.com NAME="Your Name"`. The first sign-in returns a 2-step secret (`otpauth://` link) to add to an authenticator app; every sign-in after needs the code.

## Principles

- Separate realm. Staff are `staff_users`, not app `users`. Separate tokens, separate routes (`/admin/v1/*`), separate host in production (`admin-api.tabitat.app`), never reachable from the mobile app's auth.
- Strong sign-in. Staff sign in with email + password and TOTP (2-step) required. Staff sessions last 12 hours, then sign in again; all revocable. Accounts lock after 10 wrong passwords.
- Roles. `viewer` (read-only, money amounts visible, contact details masked), `support` (account actions), `admin` (everything incl. staff management). Enforced per endpoint.
- Everything audited. Every staff request that reads personal data or changes anything writes an `admin_audit_events` row: staff id, action, target, params (redacted), reason, IP, user agent. Account actions require a `reason` string.
- Never touches the ledger directly. Staff can't edit balances. Corrections go through the same append-only events as users, flagged `actor_type: staff`, and are visible to the household.

## About "reset password"

Gloslate users have no passwords (sign-in is email/phone code, Apple, Google). The support equivalents are:

| Need | Endpoint |
| --- | --- |
| Locked out, lost phone/email | `POST /admin/v1/users/:id/identities` (attach a verified new email/phone) and `DELETE /admin/v1/users/:id/identities/:identity_id` |
| Suspected compromise | `POST /admin/v1/users/:id/revoke_sessions` (signs out every device) |
| Send a fresh sign-in code | `POST /admin/v1/users/:id/send_sign_in_code` |
| Lock / unlock account | `POST /admin/v1/users/:id/lock`, `/unlock` |
| Disable Face ID app lock remotely | not possible by design (it is local to the device); user reinstalls |

If password sign-in is ever added, `POST /admin/v1/users/:id/send_password_reset` fits here; staff never see or set a password.

## Endpoints (v1)

Read
- `GET /admin/v1/dashboard`: signups, DAU/WAU/MAU, active households, expenses logged, requests sent, payments marked/confirmed, push delivery rate (day/week/month)
- `GET /admin/v1/users?q=`: search by name, email, phone, id
- `GET /admin/v1/users/:id`: profile, identities, devices, sessions, households, last active
- `GET /admin/v1/users/:id/activity`: recent events
- `GET /admin/v1/households/:id`: members, bills, balances (computed), statements
- `GET /admin/v1/households/:id/ledger`: event stream, read-only
- `GET /admin/v1/requests/:token`: what a request page shows, for support
- `GET /admin/v1/jobs`: Solid Queue health, failed jobs
- `GET /admin/v1/audit_events`: staff audit log

Write
- Account actions above (identities, sessions, codes, lock/unlock)
- `POST /admin/v1/users/:id/export`: kick off data export (same as user's own)
- `POST /admin/v1/users/:id/delete`: account deletion (same flow as user's own; "Former member" ledger labels)
- `POST /admin/v1/jobs/:id/retry`
- `POST /admin/v1/staff`, `PATCH /admin/v1/staff/:id`: admin only

## Usage metrics

An `analytics_events` table (append-only, no PII beyond user/household ids) records product events: `signed_up`, `household_created`, `member_joined`, `expense_added`, `request_sent`, `request_page_viewed`, `payment_marked`, `payment_confirmed`, `statement_generated`. Dashboard numbers are computed from it and the ledger, with daily rollups by a Solid Queue job.

## One console for both apps later

Keep response shapes generic (`{ data, meta: { page, total } }`, ISO timestamps, string ids) so one console can talk to both apps. Note in `glofly-integration.md` any shared staff identity work.


## Gloslate Control (web, Nov 7, 2026)

Server-rendered Rails pages in the same app: `app/controllers/control/*`, `app/views/control/*`, `app/assets/stylesheets/control.css`. I mocked it up before building it.

- Where: `https://admin-api.gloslate.app/control` now; `https://control.gloslate.app` once the stack update adds its DNS record (then add `control.gloslate.app` to the Caddyfile's gloslate block). Only hosts in `CONTROL_HOSTS` answer; `/` on `control.`/`admin-api.` opens it.
- Sign-in: staff email + password + authenticator code (`Staff::SignIn`, shared with `POST /admin/v1/session`). The session token sits in an encrypted, httpOnly, SameSite=Strict cookie scoped to `/control`; every form posts a per-session HMAC token. No JavaScript (CSP `default-src 'none'`).
- Pages: Dashboard, Accounts (search/filters, detail, sign-in methods, change email/phone, send code, sign out one/all devices, lock/unlock, rename, message as team, export JSON, delete with typed name), Insights (DAU/WAU/MAU from `active_days`, funnel, cohorts, features, platforms, settle times, CSV), Tabs (balances, plan, ledger, CSV), Server, Audit log + staff (add, role, turn off, new authenticator secret, CSV).
- Server page: the kill switch (`Hometab::Switches.set_pause!`; `Hometab::Pause` middleware answers 503 `{code: "paused"}` to the app API and a paused page elsewhere; `/admin`, `/control`, `/up`, `/status`, fonts stay open; apps poll `GET /status`), read-only mode (503 `{code: "read_only"}` on API changes except sign-in), feature switches (sign-ups, sending requests, automatic reminders, pushes, web app), up time (`Hometab::Heartbeat`: a heartbeat every 30 s from the web process; a gap over 90 s becomes an `uptime_events` row: restart / update / outage; pauses recorded separately and not counted), machine stats, versions (`APP_REVISION` baked into the image), and tools (retry failed jobs, database backup via `pg_dump`, restart Puma in place). Pause, read-only, backup and restart need the authenticator code again.
- Roles: viewer (looks; contact details masked to the last 2 digits), support (account actions), admin (switches, deletes, backups, staff, audit log). Every look at personal data and every change is in `admin_audit_events` with a reason.
- JSON for a desktop Control: `GET /admin/v1/server`, `/admin/v1/server/uptime`, `/admin/v1/insights`; `POST /admin/v1/server/pause|read_only|feature`; `/admin/v1/dashboard` includes the same numbers under `control`.

First staff account (on the server, Session Manager):
`sudo docker exec -it tabitat-production-web bin/rails staff:create EMAIL=you@example.com NAME="Your Name"` (asks for a 12+ character password, prints the authenticator setup key once).
