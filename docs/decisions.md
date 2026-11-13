# Gloslate decisions

## Settled Nov 12, 2026: round 2 (one push, one OTA)

- **Live updates:** `GET /v1/pulse` is a cheap fingerprint; open screens poll it every 10s and on foreground/notification, and reload only when it changes. **Offline add:** expenses saved while offline wait in an on-device outbox and send with `client_id` (idempotent).
- **Push diagnostics:** Send a test notification (Notifications settings) shows Apple/Google's answer; dead tokens are cleared. iPhone push needs the APNs key (LUYZW3H7PW, team 4XK3F69URN) assigned to `app.tabitat` in Expo. The project had no bundle identifier there yet, so it's done after the next iOS build. Android push needs Firebase (next native build).
- **One number per person (netting):** `GET /v1/people`, `/v1/people/:id`, `POST …/settle` (marks one payment per tab that owes, note "Settled up across N tabs") and `POST …/request`. Friends shows "across N tabs" rows; the person screen shows how it nets out. Each tab's ledger stays separate; netting only marks payments.
- **Activity search:** a totals card (count, total, your share) over every match, plus this year / last year chips (`history?year=`).
- **Add expense:** "What was it?" is its own field right under Scan receipt, with quick picks (Groceries, Dinner, Takeout, Household supplies) that set the category too.
- **Bell:** tinted with a count badge and a shake when it rises; the newest unread shows as a card on Home.
- **Settings overhaul:** You is a profile card plus pages: Payments, Notifications, Reminders, Appearance, Home, Privacy & security, Your data, Help & legal, then Sign out / Delete account.
- **Profile photo:** take, choose, use your Glofly photo, or remove (`POST/DELETE /v1/me/photo`, Active Storage, 12h signed links). Shown to people you share a tab with and friends; never on request pages. Privacy policy and store answers updated.
- **Dark mode:** Light / Dark in Appearance, saved per device. `HT.color` is swapped in place (`applyScheme`) and the root remounts on change. Text on brand-filled buttons uses `onBrand`. **Match phone** appears once a native build sets `userInterfaceStyle: "automatic"` (it's hidden until then, because the current build always reports light).
- **Year recap:** `GET /v1/recap?year=` and a share card `GET /v1/recap/image.png`. It shows places shared, things split (top category), payments settled and busiest month. It never shows who paid more or who owes. Opens from You, and from a Home banner Dec 1 to Jan 15. ("Clean slates" from the canvas became "payments settled", because a true clean-slate count isn't stored.)
- **Native batch (next build):** Siri & Shortcuts, `userInterfaceStyle: "automatic"`, Android Firebase push, favicon, Android `/f/` intent filters.

## Settled Nov 11, 2026: legal pages and website

- **Legal owner on every page comes from `LEGAL_OWNER`** (default "Chip Mullins"); privacy, terms and the site footer use it. Switching to the LLC = set the env var (and the store seller), no code change. `LEGAL_DRAFT=true` keeps the "Draft for review" banner until the attorney signs off.
- Privacy policy (Nov 11) now covers friends and the "add me" link, one-on-ones and groups, Glofly email handling, settings, IP address/app version per signed-in device, browser storage on the web app, and what deletion removes. Terms cover friends/groups, requests and reminders sent on your behalf (tone), third-party sign-in terms, and no spam.
- Store privacy answers for App Store Connect and Play Data safety: `docs/store-privacy.md` (no tracking, no third-party SDKs; checked against the code).
- Landing page: new Friends and clean slate sections with real screenshots from the current app (`app-friends-v1`, `app-cleanslate-v1`), web app link in the hero and footer, tiles for the browser, Sign in with Glofly and reminder tone, FAQ for friends-only and computers/Glofly. The request screenshot and share image no longer show tabitat.app (`app-request-v3`, `og-v3`).
- Checked live (Nov 11): tabitat.app and www.tabitat.app redirect to the same path on gloslate.app, request links included; favicon is the current mark.
- Still Chip's: verify the gloslate.app SES identity and flip `MAIL_FROM`; attorney review of privacy, terms and trademark; the app's own `favicon.png` (one-ear drawing) waits for the next native build.

## Settled Nov 11, 2026: polish pass

- Walked Home, Friends, Bills, Activity, You and onboarding (plus friends-only and brand-new accounts) on the web build at 390, 360, ~884 and iPad, with fake API data.
- Friends shortcuts are now one row of three compact tiles (Settle up · New group · Add friend), so Balances sits near the top on phones; full descriptions stay in the screen-reader labels.
- Wide screens: the Friends to-confirm count shows as a pill after the label (the icon badge sat on the word when labels are beside icons).
- Placeholder color `faint` darkened to `#776975` (4.6:1 on ground, was 3.5:1).
- Clean slate card and sheet keep their size while the text fades in (no jump). Bottom sheet: the backdrop is its own button so VoiceOver reaches "Nice".
- Settle screen "Pending" pill: button role and 44pt target. Code entry announces how many digits are in.
- Data export downloads as `gloslate-my-data.json` (was `tabitat-…`). No other user-visible HomeTab/Tabitat copy found; the "glo" wordmark in `glowDeep` is a logo and exempt from contrast rules.
- Not covered here (needs a device): Dynamic Type at 1.4× (text caps at 1.6×), haptics, VoiceOver on iOS, Android TalkBack.

## Settled Nov 11, 2026: clean slate moment

- **All three styles ship; A is the default.** You → Clean slate moment: **Full screen** (A, default), **Card** at the top of the screen (B), **Bottom sheet** (C), with a Preview button. Stored account-wide on `users.celebration_style` (`full|card|sheet`, `PATCH /v1/me`). Canvas: https://claude.ai/artifact/QMbXs2hZNLvnmJKLWCCJwo
- B is a card at the top of whatever screen is open, not drawn inside the balance card itself: payments get confirmed from several screens (payment details, group settle, banners) that have no balance card.
- Plays only right after *you* confirm a payment (or record one as received) and it leaves you square with that person or the whole tab; once per payment; never on app open; never for deleted expenses. Replaces the old "All settled!" pop-up (`SettledHost`, `celebrateIfSettled`).
- Scene (`mobile/src/components/clean-slate.tsx`): the loader bunny hops in with legs on two real arcs, tucks its legs away as it sits on the slate (the logo pose), the amount is wiped off, the check is drawn and the glow star flares; success haptic lands with the check. Reduce Motion: the finished picture, faded in. Same code on the web app.
- Request page: once the requester confirms a payment that brings it to $0, it shows a small "Clean slate with Chip." version (CSS, honors prefers-reduced-motion).

## Settled Nov 11, 2026: reminder tone

- **Gentle · Plain · Cheeky**, default Plain. Every string in the requester's voice lives in `api/app/services/requests/tone.rb`: the request push, auto-reminder push, share text, request page headline/og tags and the share image. The app's picker previews them from `GET /v1/reminder_tones` (`{ data, default }`), so the app holds no copy of its own.
- Stored on `members.reminder_tone` (saved to every tab via `PATCH /v1/me { member: { reminder_tone } }`, like the other reminder settings) and frozen onto `payment_requests.tone` when sent, so a page keeps the voice it went out with. `POST …/requests { tone }` overrides it for one request; the picker sits above every Request button and in You → Reminders.
- Plain reads exactly as before. Rules for all variants (tested): kind, no "debt/overdue/late", never claims Gloslate verified or moved money. The "did it arrive?" nudge to the receiver is Gloslate's own voice and stays Plain.

## Settled Nov 11, 2026: friends-only start, Friends tab split

- **Onboarding asks "I live with people" or "Just with friends".** Either choice sets `users.onboarded_at` (`PATCH /v1/me { onboarded: true }`, set once, never cleared), so it holds across devices. The launch gate only shows onboarding to someone with no tabs **and** no `onboarded_at`; the migration backfills everyone who already has a tab or a friend. No home → land on Friends.
- **Home later:** a "Set up your home" card (runs `/setup`) on the Home tab, Bills tab and You tab when there's no home. Without a home, Home shows a "With friends" total (owed to you / you owe across one-on-ones and groups, taps to Friends) above that card; Bills explains that bills belong to a home.
- **Friends tab = Balances · Friends · Groups.** Balances: one-on-ones with money owed either way or a payment waiting to confirm (waiting first, then largest). Friends: every friend you're square with (settled tab, hidden tab or no tab), A–Z; friends never swipe away. Settled one-on-ones with non-friends sit under "Settled one-on-ones" and keep swipe-to-hide. Wide screens: Balances + Groups left, Friends right. No server change beyond the onboarding flag.
- **Legal owner: Chip Mullins personally** until his LLC exists (replaces HarborWorks). Use it on Terms, Privacy, the site footer and the App Store / Play seller; switch everything to the LLC once it's registered.
- Ship order: deploy the API (migration) before the OTA update. An older server ignores `onboarded`, so the worst case is onboarding showing again.

## Settled Nov 7, 2026: Sign in with Glofly

- **Code + PKCE (S256), run by Gloslate's server.** `POST /v1/auth/glofly/start` makes the verifier, state and nonce and seals them in an encrypted 10-minute `flow`; the app opens Glofly's authorize URL and posts `{ code, flow, state, iss }` to `/v1/auth/glofly/finish`, which swaps the code (Gloslate is a public client: no secret) and verifies the ID token with a **required** nonce. The verifier never leaves the server, and the app needs no crypto, so no new native module and no OTA fingerprint change. (This replaces "swap the code on the phone with expo-auth-session" from the Glofly handoff: that needs `expo-crypto`, a native module.)
- **No bare Glofly ID tokens.** `/v1/auth/glofly` and `/v1/identities { provider: "glofly", id_token }` are refused; only the code flow works.
- **Same email → link offer, never a silent link** (the Glofly handoff agrees). Accounts are keyed by Glofly's `sub`. Email is optional on Glofly's consent screen; sign-in works without it. A Glofly email is kept on the identity but **never becomes the account's email**, so a Glofly account can't pre-claim an email someone later signs in with by code (security review, Nov 7). Unknown signing key → keys are re-read (at most every 5 min), so a Glofly key rotation doesn't break sign-in.
- **Phone:** the system browser sheet (`openAuthSessionAsync`), return `tabitat://auth/glofly`. **Web app:** the same tab goes to Glofly and returns to `https://app.gloslate.app/auth/glofly/callback` (mobile browsers block the popup `openAuthSessionAsync` uses on web). Return addresses are an allowlist (`GLOFLY_REDIRECT_URIS`).
- **Off until configured:** the button shows only when `GLOFLY_CLIENT_IDS` is set and the Control switch "Sign in with Glofly" is on (`GET /v1/auth/providers`). Issuer `https://api.glofly.app`; endpoints come from Glofly's discovery.

## Settled Nov 7, 2026: friends, settled moments, account-wide settings

- **Friends** are separate from homes: add someone once with your link (`gloslate.app/f/<token>`, rotatable), and requests/charges between you go out as notifications instead of texted links. Friendships are stored both ways; a one-on-one tab with a friend has both real users in it (no invite). Joining someone's one-on-one invite makes you friends automatically. Unfriending keeps all tabs and history.
- **Hiding a settled tab** (`members.hidden_at`) only takes it off your Friends list; it reappears on any new expense, payment or request in it. Homes can't be hidden.
- **Payment apps and reminder settings** are saved to every tab you're in (`PATCH /v1/me { member: {...} }`); new tabs start with the payment apps you already set.
- **App updates only reach builds with the same native fingerprint.** `mobile/native-fingerprints.json` holds the fingerprints of the builds people have installed, and the OTA workflow refuses to publish if the current code doesn't match. Any edit under `mobile/modules/`, `app.json`, native packages or icons changes it, even a comment (that's how a podspec homepage edit on Nov 6 silently stranded the iPhone build until it was reverted). After a new Xcode/APK build, update the file.
- **Pending native change** (do it with the next Xcode/APK build, not before: it changes the OTA runtime): add `"pathPrefix": "/f/"` entries next to the `/i/` ones in `mobile/app.json` Android intent filters. iOS already opens `/f/` links (the paths come from the server's apple-app-site-association).

## Settled Nov 6, 2026: Gloslate and Plum Night

| Topic | Decision |
| --- | --- |
| Name | **Gloslate** (renamed from Tabitat). Wordmark "glo" in amber + "slate" in off-white, set in Outfit. Branding "Gloslate by Glofly" |
| Domain | Still **tabitat.app** (and `api.`, `support@`) until Chip switches it. Bundle ID `app.tabitat`, scheme `tabitat://`, Expo slug, AWS names `tabitat-*` and env files are unchanged |
| Logo | **Clean slate**: a near-black slate with an off-white check on a plum-night tile, amber 4-point sparkle with a halo at its top-right. Source: `HouseMark` (name kept) in `mobile/src/components/icons.tsx` and `api/app/views/public/_mark.html.erb`; PNGs from `mobile/scripts/render-icons.py` |
| Colors | **Plum Night**: everyday screens stay light (ground `#F6F2F4`, ink `#241A23`, plum `#6B3A63`); hero surfaces are a night sky `#4A2C5A → #2A1A33 → #140C18` (`NightSurface` in the app). Owed to you sage `#3A7457` (on dark `#A9D9BD`), you owe coral `#B4472A` (on dark `#FF9E80`). Glofly amber `#FFB547` is only the glow: sparkle, highlights, the primary action on night surfaces. It never means "you owe" |
| Fonts | **Outfit** (headings, names, wordmark), **DM Sans** (everything else). Money: DM Sans with fixed-width digits ("DM Sans Tabular", generated by `mobile/scripts/tabular-font.py`, because DM Sans has no `tnum` feature). IBM Plex Mono only for tiny caps labels ("BY GLOFLY") |

## Superseded: Nov 4, 2026 (evening): Tabitat

## Settled Nov 4, 2026 (evening): rename and new look

| Topic | Decision |
| --- | --- |
| Name | **Tabitat** (tab + habitat), renamed from HomeTab, which was taken as a domain and is also a browser-extension name. Branding "Tabitat by Glofly" |
| Domain | **tabitat.app** |
| Logo | **B · t-roof monogram**: a lowercase t rising into a roof, white on plum. Replaces the receipt house. Canvas: https://claude.ai/artifact/QihYwPjZp7mtBypJJLwZBm |
| Colors | **Plum & Sage**: brand plum `#6B3A63`, owed-to-you sage `#3A7457`, you-owe `#A8441C`, ground `#F6F2F4`, ink `#241A23` |
| Hosting | Lean: one Tabitat-only EC2 server (`t3.micro`) runs staging + production with Docker Compose + Caddy, Postgres on its own disk with nightly S3 backups (RDS later). **The server pulls new images from ghcr.io itself**: an SCP above the Glofly account blocks GitHub OIDC, so GitHub never gets AWS access. Isolated from Glofly (own VPC, scoped IAM). See `docs/deploy.md` |
| Kept internal | Repo `chipmullins/hometab`, Ruby namespace `Hometab::`, dev/test database names |

## Settled Nov 4, 2026 (build chat)

| Topic | Decision |
| --- | --- |
| Logo | ~~A · Receipt house~~ (replaced by logo B, above) |
| Hosting | **Kamal 2 on EC2** (Docker), RDS Postgres, S3, SES, Route 53. Region `us-east-1`. Environments: staging + production |
| Receipt OCR | **On-device**: Apple Vision (iOS) / ML Kit text recognition (Android). Total detection first; itemizing parses recognized lines on device. No receipt image leaves the phone for OCR (photo is still uploaded to S3 only if the user attaches it) |
| Push | **Expo push service** (one API for APNs + FCM). Server sends via `expo-server-sdk`-style HTTP calls from Solid Queue jobs |
| Branding | "Tabitat by Glofly", HarborWorks as legal owner |
| Admin | Admin API ships from day one so a future Tabitat Control / HarborWorks Control app can plug in (see `admin-api.md`) |

## Earlier (Nov 2–4, see brief)

Rails 8 API + Postgres + Solid Queue; Expo/TypeScript/expo-router; integer cents; append-only ledger; everything in the spec ships in the first release.

## Status

- [x] Steps 1–12 built (Nov 4, 2026): ledger engine, auth + admin realm, households/invites, expenses, bills, payments, requests + public pages, statements + exports, notifications + widgets, receipts (on-device OCR + itemizing), settings/Face ID/export/deletion. API ~100 tests, app typecheck + lint + tests in CI.
- [ ] Step 13: AWS (one CloudFormation upload, see docs/deploy.md), TestFlight (Android later), beta. Needs Chip's accounts — see docs/running.md.
- [x] Sign in with Glofly built (Nov 7), switched on Nov 8 with live Glofly (docs/glofly-integration.md).
- Not yet verified on a real device: Sign in with Apple, push delivery, widgets, Face ID, native receipt OCR (all need a development build). Google sign-in button in the app needs client IDs.
