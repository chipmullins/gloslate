# Building the iPhone app yourself with Xcode

On the Mac mini. You only need Expo's tools to generate the Xcode project; the build, signing and
TestFlight upload all happen in Xcode with your Apple account.

## Once: tools

- Xcode from the App Store. Open it once and sign in at **Xcode → Settings → Accounts → +**.
- Homebrew, then: `brew install node@22 cocoapods git`

## Each time you want a new build

```bash
git clone https://github.com/chipmullins/hometab.git   # first time only; afterwards: git pull
cd hometab/mobile
npm install
npx expo prebuild --platform ios --clean               # writes ios/ (never edit it by hand)
open ios/Tabitat.xcworkspace
```

In Xcode:
1. Select the **Tabitat** project, then for each target (**Tabitat** and **ExpoWidgetsTarget**) open
   **Signing & Capabilities**, tick **Automatically manage signing**, and choose your team
   (`4XK3F69URN`).
2. **Tabitat** target → **General** → raise **Build** by 1 for every upload (1, 2, 3…).
3. Run it on your own iPhone: plug it in, pick it at the top, and press ▶. The first time, the
   iPhone asks you to turn on Developer Mode.
4. Or send it to TestFlight: pick **Any iOS Device (arm64)**, then **Product → Archive** →
   **Distribute App → App Store Connect → Distribute**. In App Store Connect → TestFlight, add
   yourself to an internal testing group. The build shows up in the TestFlight app about 10–30
   minutes later.

The app talks to `https://api.tabitat.app` (from `mobile/.env.production`).

Push notifications also need an Expo project ID: run `npx eas-cli login`, then `npx eas-cli init`
once, and commit the `projectId` it writes into `app.json`.

The `.github/workflows/ios.yml` cloud build (EAS) is an optional alternative that needs no Mac.
