# Memory Box

A pocket-sized keepsake box for photos: Polaroid-style cards with location stamps,
a handwritten caption on the front, the story on the back, a 3D flip, and a daily
memory streak. Offline-first, iOS + Android, built with Expo SDK 58.

## Stack

- Expo SDK 58 · Expo Router (typed routes) · TypeScript strict
- React Native Reanimated 4 + Gesture Handler (flip, drag-to-drop, particles)
- Skia (sparkle burst / celebration confetti)
- Zustand + `expo-sqlite/kv-store` persistence, files in `documentDirectory/memories`
- expo-camera · expo-image-picker · expo-location · expo-image · expo-haptics

## Run locally

```bash
npm install
npm start
```

Camera, location and photo-library features need a development build:

```bash
npx expo run:android   # or: npx expo run:ios
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Metro dev server |
| `npm run android` / `npm run ios` | Dev server on a device/simulator |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Android releases

`.github/workflows/android-release.yml` builds a signed **arm64-v8a only** release
APK — the fastest Android variant, since it skips every other ABI's native compile.

Pushing a `v*` tag builds and publishes the APK to a GitHub Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Manual runs (`workflow_dispatch`) produce a downloadable artifact without a release.

### Signing secrets

The workflow expects these repository secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 of the release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password |

`scripts/ci/configure-signing.js` injects them into the generated Gradle project
after `expo prebuild`, so no native folder needs to be committed.
