# Glofly integration — required Glofly changes (for later)

Do **not** modify the Glofly repo or backend from HomeTab work. This file lists what Glofly will need when "Sign in with Glofly" and related features are built.

## Sign in with Glofly (OAuth 2.0 / OpenID Connect provider)

- Authorization, token, userinfo endpoints; JWKS for signed ID tokens
- Client registration for HomeTab: client id/secret, redirect URIs (`hometab://auth/glofly`, `https://hometab.app/auth/glofly/callback`)
- Consent screen in Glofly apps: "HomeTab wants your name, avatar and email"
- Scopes: `openid profile email`; later `friends.read`
- Must respect restricted (family) accounts, Lockdown, Pause, two-step sign-in; keep older Glofly app versions working

## HomeTab side (already designed for it)

- `identities` table with `provider = 'glofly'` — no schema change
- OmniAuth-style pluggable strategy

## Later

- HomeTab request cards rendering natively in Glofly chats, live "Paid" status
- `/split 32 dinner` command in Glofly chats
- Shared staff accounts for a combined **HarborWorks Control** console (see `admin-api.md`)
