# Gloslate app

The Expo / React Native app for iPhone, iPad, Android and the web (app.gloslate.app).

## Setup

You'll need Node 22. Point the app at your local API:

```bash
npm install
EXPO_PUBLIC_API_URL=http://<your-ip>:3000 npx expo start
```

Checks (these also run in CI):

```bash
npm run typecheck && npm run lint && npm test
```

Expo Go runs most of it. Sign in with Apple, push, Face ID, widgets and on-device receipt scanning need a development build (`npx eas-cli build --profile development`).

## Where things are

- `src/app/`: screens (expo-router, one file per route)
- `src/components/`: shared UI, icons, the bunny loader, the clean slate scene
- `src/lib/`: API client, money math, offline outbox, live updates, theme
- `src/constants/theme.ts`: colors, fonts and spacing (light and dark)
- `plugins/`: config plugins for native bits (Siri Shortcuts)
- `scripts/`: icon and font generators, unit tests

Over-the-air updates only reach builds with the same native fingerprint, so `native-fingerprints.json` tracks what's installed. Update it after every new native build.
