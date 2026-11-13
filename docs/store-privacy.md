# App Store and Google Play: privacy answers

What to enter in App Store Connect ("App Privacy") and the Play Console ("Data safety") so the stores match the privacy policy (`/privacy`, updated Nov 11, 2026). Not legal advice: have the attorney review the policy and these answers together before launch. If the code starts collecting something new, update the policy, this file and both store forms in the same change.

Checked against the code on Nov 11, 2026: no third-party analytics, ads, crash-reporting or tracking SDKs in the app or API; usage events (`analytics_events`) are first-party only.

## Seller and contact

| Field | Value |
|---|---|
| Seller / developer name | **Chip Mullins** (individual) until the LLC exists; then change the account to the LLC and set `LEGAL_OWNER` on the server |
| Support URL | https://gloslate.app/support |
| Privacy policy URL | https://gloslate.app/privacy |
| Contact email | support@gloslate.app |

As an individual seller, your legal name is shown publicly on the store listing.

## Apple: App Privacy

**Tracking:** No. Gloslate doesn't track people across other companies' apps or websites (no App Tracking Transparency prompt needed).

**Data linked to the user** (all collected, none used for tracking):

| Apple category | Data type | Why (Apple purpose) |
|---|---|---|
| Contact Info | Name | App Functionality |
| Contact Info | Email Address | App Functionality (sign-in, codes) |
| Contact Info | Phone Number | App Functionality (sign-in, codes) |
| Financial Info | Other Financial Info (amounts owed, expenses, payments marked) | App Functionality |
| User Content | Photos or Videos (receipt photos and a profile photo, only if added) | App Functionality |
| User Content | Other User Content (expenses, notes, home and group names) | App Functionality |
| Identifiers | User ID | App Functionality |
| Identifiers | Device ID (push token) | App Functionality |
| Usage Data | Product Interaction | Analytics, App Functionality |

Not collected: Health, Location, Contacts, Browsing/Search History, Purchases, Payment Info (no card or bank numbers), Credit Info, Diagnostics, Sensitive Info, Audio, Gameplay.

## Google Play: Data safety

- **Does the app collect or share user data?** Collects: yes. Shares: no (service providers that process data on our behalf don't count as sharing under Play's definitions).
- **Encrypted in transit:** yes.
- **Way to request deletion:** yes, in the app (Settings → Delete my account) and by email.
- **Account creation:** yes; account deletion URL: https://gloslate.app/support (explains Settings → Delete my account and the email option).

| Play category | Data type | Required? | Purposes |
|---|---|---|---|
| Personal info | Name | Required | App functionality, Account management |
| Personal info | Email address | Optional (phone works instead) | Account management |
| Personal info | Phone number | Optional (email works instead) | Account management |
| Personal info | User IDs | Required | App functionality, Account management |
| Financial info | Other financial info (amounts owed, payments marked) | Required | App functionality |
| Photos and videos | Photos (receipts, profile photo) | Optional | App functionality |
| App activity | App interactions | Required | Analytics, App functionality |
| App activity | Other user-generated content (expenses, notes) | Required | App functionality |
| Device or other IDs | Device or other IDs (push token) | Optional | App functionality |

Processed ephemerally: none. Receipt text recognition runs on the device and isn't collected.

## Other store items

- **Age rating:** answer "no" to all objectionable-content questions; Gloslate is for 18+ per the terms, so pick 17+ on Apple if offered and "Everyone" content on Play with the 18+ terms.
- **Payments wording:** Gloslate never takes or moves money; Pay buttons open Venmo/Cash App or show Zelle details. In review notes: "No in-app purchases or payments. Gloslate records who owes whom; payments happen in third-party apps and are marked by users."
- **Sign in with Apple:** required because Google and Glofly sign-in are offered; built.
- **Account deletion in the app:** built (Settings → Delete my account).
- **Demo account for review:** give App Review a phone number or email that can sign in (see `docs/ios.md`).
