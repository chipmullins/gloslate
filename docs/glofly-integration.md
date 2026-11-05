# Glofly integration — required Glofly changes (for later)

Do **not** modify the Glofly repo or backend from Tabitat work. This file lists what Glofly will need when "Sign in with Glofly" and related features are built.

## Sign in with Glofly (OAuth 2.0 / OpenID Connect provider)

- Authorization, token, userinfo endpoints; JWKS for signed ID tokens
- Client registration for Tabitat: client id/secret, redirect URIs (`tabitat://auth/glofly`, `https://tabitat.app/auth/glofly/callback`)
- Consent screen in Glofly apps: "Tabitat wants your name, avatar and email"
- Scopes: `openid profile email`; later `friends.read`
- Must respect restricted (family) accounts, Lockdown, Pause, two-step sign-in; keep older Glofly app versions working

## Tabitat side (already designed for it)

- `identities` table with `provider = 'glofly'` — no schema change
- Pluggable OIDC verifier (`api/lib/hometab/oidc.rb`): add a `glofly` entry with issuer, JWKS URL and client IDs, and a `/v1/auth/glofly` route. The mobile app gets an ID token from Glofly (authorization code + PKCE) and posts it, same as Apple/Google.
- Glofly must issue RS256-signed ID tokens with `sub`, `email`, `email_verified`, `aud` = Tabitat's client id

## Later

- Tabitat request cards rendering natively in Glofly chats, live "Paid" status
- `/split 32 dinner` command in Glofly chats
- Shared staff accounts for a combined **HarborWorks Control** console (see `admin-api.md`)
