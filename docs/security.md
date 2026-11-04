# HomeTab security notes

## Model

- **No money movement.** HomeTab records and links out. Payments are *marked* by one person and *confirmed* by the other.
- **Two auth realms.** App users: opaque bearer tokens (`Session`, SHA-256 digest stored, revocable, expire after 180 idle days). Staff: scrypt password + required TOTP, 12-hour sessions, separate tables and routes (`/admin/v1`). Neither token works in the other realm.
- **Sign-in codes:** 6 digits, keyed HMAC digest, 10-minute life, 5 attempts counted atomically, consumed once (`SignInCode.redeem!`), never logged.
- **ID tokens (Apple/Google, later Glofly):** RS256 only, `kid` match, signature, `iss`, `aud`, `exp`, `nbf`, `iat` (`lib/hometab/oidc.rb`).
- **Household scoping:** every record loaded by id is re-checked against `current_user.members.current` for that household.
- **Append-only ledger and frozen statements** are enforced by Postgres triggers, not just the app.
- **Public pages** (`/r/:token`, `/i/:token`) use 128+ bit tokens and show first names, amounts and the breakdown only.

## Money-trust rules

| Rule | Where |
| --- | --- |
| Only the person owed can forgive a balance; nobody forgives their own debt | `Households::Leave` |
| Only the receiver confirms; either party can question a payment for 30 days | `Payments::Respond` |
| Silence confirms after 3 days only if the receiver has an account and still lives there | `Payments::Mark` |
| The public "I paid" form is capped at what's owed and always waits for the requester | `PublicController#mark_paid` |
| Bills, skips and one-month changes: payer or creator only (payer notified) | `Bill#manageable_by?` |
| Move dates are set by a roommate, never yourself; everyone is notified | `MembersController#update` |
| Payment handles: only your own | `MembersController#update` |
| An invite for one person can only claim that person's spot | `Households::AcceptInvite` |

## Rate limits (Rails `rate_limit`, backed by Solid Cache in production)

Sign-in codes 10/min and 40/hour per IP (plus 5/hour per destination); verify and provider sign-in 20/min; staff login 10 per 5 min; public request/invite pages 60/min; "I paid" 5 per 10 min per IP+token; requests 10/hour, invites 20/hour, payment notes 30/hour, flags 20/hour per user.

## Production settings

`force_ssl`, `assume_ssl` (TLS at the Kamal proxy), host allowlist (`ALLOWED_HOSTS`), sensitive params filtered from logs (codes, phones, tokens, payment handles), mail job arguments not logged, receipts served through 5-minute signed links.

## Review log

- **Nov 4, 2026:** independent review found 3 high, 6 medium and 6 low issues. All were fixed in `c43732d`, with regression tests in `api/test/integration/security_fixes_test.rb`.
- **Open owner action:** delete the `bootstrap/rails` branch on GitHub. It holds an early generated `master.key` for a credentials file that was never used. The key has since been replaced.
- **Before launch:** turn on error reporting and alerts (`Rails.error` subscriber), back up the database, and get a pen test once the app is on real infrastructure.
