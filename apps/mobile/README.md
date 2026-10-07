# apps/mobile

Customer iOS app built with Expo (React Native). Customers browse nearby car washes, compare services and prices, and book a time slot in a few taps.

## Status

Placeholder. Scaffolded by GHA-58 with the TypeScript Expo template.

## iOS is the primary target

Every screen and dependency choice must keep the app shippable on the App Store. Read [iOS App Store readiness](../../docs/product/ios-app-store-readiness.md) before adding features that touch accounts, location, payments, or user content.

Rules that apply from the first commit:

- Browsing branches works without an account. Sign-in is only required to book.
- Location permission is optional ("When In Use" only). Discovery falls back to the Cairo map center and area search when permission is denied.
- Every value in `.env` ships inside the app binary, so nothing secret goes here.
- Production builds must call the API over HTTPS.
- Only free, keyless map rendering (Apple Maps through `react-native-maps` on iOS) until the paid maps upgrade triggers are met.

## Configuration

Copy `.env.example` to `.env`. Read values with **static** property access so Expo can inline them, then validate:

```ts
import { mobileEnvSchema, parseEnv } from '@ghassalny/config';

export const env = parseEnv('mobile', mobileEnvSchema, {
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
```

Never import `@ghassalny/database` here. It is server-side only.

## Running on iOS from Windows

There is no iOS Simulator on Windows. Use Expo Go on a physical iPhone during development, and EAS Build for installable and App Store builds. See [local setup](../../docs/development/local-setup.md#ios-development).
