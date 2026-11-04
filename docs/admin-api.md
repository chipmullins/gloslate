# Admin API (for HomeTab Control / HarborWorks Control)

Built from day one so a staff console can connect later. Today there is no console; the API is the contract. It is designed so a future **HarborWorks Control** can front both Glofly and HomeTab with the same patterns.

## Principles

- **Separate realm.** Staff are `staff_users`, not app `users`. Separate tokens, separate routes (`/admin/v1/*`), separate host in production (`admin-api.hometab.app`), never reachable from the mobile app's auth.
- **Strong sign-in.** Staff sign in with email + password **and** TOTP (2-step) required. Short-lived access tokens (15 min) + refresh tokens; all revocable.
- **Roles.** `viewer` (read-only, money amounts visible, contact details masked), `support` (account actions), `admin` (everything incl. staff management). Enforced per endpoint.
- **Everything audited.** Every staff request that reads personal data or changes anything writes an `admin_audit_events` row: staff id, action, target, params (redacted), reason, IP, user agent. Account actions require a `reason` string.
- **Never touches the ledger directly.** Staff can't edit balances. Corrections go through the same append-only events as users, flagged `actor_type: staff`, and are visible to the household.

## About "reset password"

HomeTab users have **no passwords** (sign-in is email/phone code, Apple, Google). The support equivalents are:

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
- `GET /admin/v1/dashboard` — signups, DAU/WAU/MAU, active households, expenses logged, requests sent, payments marked/confirmed, push delivery rate (day/week/month)
- `GET /admin/v1/users?q=` — search by name, email, phone, id
- `GET /admin/v1/users/:id` — profile, identities, devices, sessions, households, last active
- `GET /admin/v1/users/:id/activity` — recent events
- `GET /admin/v1/households/:id` — members, bills, balances (computed), statements
- `GET /admin/v1/households/:id/ledger` — event stream, read-only
- `GET /admin/v1/requests/:token` — what a request page shows, for support
- `GET /admin/v1/jobs` — Solid Queue health, failed jobs
- `GET /admin/v1/audit_events` — staff audit log

Write
- Account actions above (identities, sessions, codes, lock/unlock)
- `POST /admin/v1/users/:id/export` — kick off data export (same as user's own)
- `POST /admin/v1/users/:id/delete` — account deletion (same flow as user's own; "Former member" ledger labels)
- `POST /admin/v1/jobs/:id/retry`
- `POST /admin/v1/staff`, `PATCH /admin/v1/staff/:id` — admin only

## Usage metrics

An `analytics_events` table (append-only, no PII beyond user/household ids) records product events: `signed_up`, `household_created`, `member_joined`, `expense_added`, `request_sent`, `request_page_viewed`, `payment_marked`, `payment_confirmed`, `statement_generated`. Dashboard numbers are computed from it and the ledger, with daily rollups by a Solid Queue job.

## HarborWorks Control later

Keep response shapes generic (`{ data, meta: { page, total } }`, ISO timestamps, string ids) so one console can talk to both apps. Note in `glofly-integration.md` any shared staff identity work.
