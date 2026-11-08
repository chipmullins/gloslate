# Glofly integration

Do **not** modify the Glofly repo or backend from Gloslate work. Glofly-side work happens in the Glofly chat under Glofly's own rules. This file tracks what's built on Gloslate's side and what Gloslate needs from Glofly.

## Sign in with Glofly

**Status (Nov 8, 2026):** **on.** Glofly's sign-in server is live at `https://api.glofly.app` (discovery and JWKS checked Nov 8: issuer matches, RS256 key `kid 3e63726a`). Gloslate is registered in Glofly; client ID `gfa_2HbV4amyEL8I` is in `api/deploy/production.env` and `staging.env` (both use live Glofly; staging has no Glofly of its own).

### How it works

Glofly is an OpenID Connect provider; Gloslate is a **public client** (no secret) using authorization code + PKCE (S256).

1. App → `POST /v1/auth/glofly/start { redirect_uri }` (or `POST /v1/identities/glofly/start` when signed in, to add Glofly in Sign-in methods). The server makes the PKCE verifier, `state` and `nonce`, seals them in an encrypted `flow` (10 minutes) and answers `{ authorize_url, state, flow }`. The verifier never leaves the server.
2. App opens `authorize_url` (Glofly's consent page on chat.glofly.app): phones in the system browser sheet (`openAuthSessionAsync`), the web app in the same tab.
3. Glofly returns to `redirect_uri?code=…&state=…&iss=…` (or `error=access_denied` → "cancelled", no error). The app checks `state`.
4. App → `POST /v1/auth/glofly/finish { code, flow, state, iss }` (or `POST /v1/identities { provider: "glofly", code, flow, state, iss }`). The server checks state and `iss`, swaps the code at Glofly's token endpoint within its 60 seconds, verifies the ID token (RS256 via JWKS, issuer, audience, expiry, **our nonce**), then signs in by `sub` (`identities.provider_uid`) through `Auth::ProviderSignIn` (link offer for a matching verified email; sign-ups switch and kill switch apply). Glofly's tokens are discarded; Gloslate issues its own session.

Bare Glofly ID tokens are refused (`/v1/auth/glofly`, `/v1/identities { id_token }`): only the code flow, with a nonce Gloslate made, works.

Code: `api/app/services/auth/glofly_flow.rb`, `api/lib/hometab/oidc.rb` (`glofly` provider, discovery), `mobile/src/lib/glofly.ts`, `mobile/src/app/auth/glofly/` (return routes). Tests: `api/test/integration/glofly_sign_in_test.rb`, `mobile/scripts/glofly.test.ts`.

### Settings

| Setting | Value |
|---|---|
| `GLOFLY_ISSUER` | `https://api.glofly.app` (dev: `http://localhost:4000`). Must equal the `iss` Glofly puts in tokens. |
| `GLOFLY_CLIENT_IDS` | `gfa_2HbV4amyEL8I`. **Empty = off.** Not secret; set in `api/deploy/*.env`. |
| `GLOFLY_REDIRECT_URIS` | `tabitat://auth/glofly,https://app.gloslate.app/auth/glofly/callback` (dev web: add `http://localhost:8081/auth/glofly/callback`) |
| Scopes | `openid profile email` (email is optional for the person) |
| Control switch | Server → "Sign in with Glofly" turns the button off without a deploy |

### What Chip does in Glofly (once Glofly's sign-in server is live)

1. Glofly → Settings → **Developer** → **New app**: name `Gloslate`, website `https://gloslate.app`.
   - Return addresses: `tabitat://auth/glofly` and `https://app.gloslate.app/auth/glofly/callback`.
   - Extra permission: **email**. Skip roles.
   - Kind: **"A phone app or browser-only site (no secret, PKCE)"**.
2. Copy the `gfa_…` client ID into `GLOFLY_CLIENT_IDS` in `api/deploy/production.env`, push, promote.
3. Glofly Control → Sign-in apps → mark Gloslate **"Made by Glofly"**.

Staging uses live Glofly and the same registration (same return addresses).

### Suggested Glofly changes (for the Glofly chat, not done here)

- **"New Glofly app" in Glofly Control**: create first-party sign-in apps owned by Glofly (not a personal account) with "Made by Glofly" already on, audit-logged. Useful once Petal/ForkRoad also use Glofly sign-in.
- Before going live: security review of the sign-in server (exact return-address matching, single-use 60-second codes, rate limits) and how the RS256 signing key is stored.
- Glofly's privacy policy should say what it shares with apps people approve; Gloslate's says what it receives (Glofly user id, name, username, photo, email if allowed).

### Not done yet

- Glofly's firefly mark on the button (a plain amber glow dot stands in: `GloflyGlyph` in `mobile/src/components/icons.tsx`).
- Showing "@username" on the Sign-in methods row (would need storing `preferred_username`; today it shows the email if shared, else "Glofly account").
- A real sign-in on a phone and on the web app (needs a person at the consent screen).

## Later

- `friends.read` scope: import Glofly friends as Gloslate friends (`friendships`, `/v1/friends`).
- Gloslate request cards rendering natively in Glofly chats, live "Paid" status
- `/split 32 dinner` command in Glofly chats
- Shared staff accounts for a combined **HarborWorks Control** console (see `admin-api.md`)
