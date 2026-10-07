# iOS App Store Readiness

## Purpose

The customer app ships on the Apple App Store first. This document lists the App Review Guidelines that affect Ghassalny, so features are designed to pass review from the start instead of being reworked after a rejection.

Guideline numbers refer to Apple's App Review Guidelines. Re-check them before each submission, because Apple updates them regularly.

## Requirements that shape the MVP

### 1. Browse without an account (5.1.1(v))

Apple rejects apps that force sign-in before the user can reach features that don't need an account.

- Discovery (nearby list, map, search, branch detail, services, prices, hours) works signed out.
- Sign-in or registration is requested only when the customer taps **Book**, then the booking flow resumes.
- The bookings, vehicles, and profile tabs show a sign-in prompt when signed out, never a blank or broken screen.

Affects GHA-59 (navigation must have a public discovery area), GHA-60, GHA-61, GHA-62, and GHA-63.

### 2. In-app account deletion (5.1.1(v))

Any app that lets users create an account must let them **start account deletion inside the app**. A support email address alone is not accepted.

- Profile screen with a clearly labelled "Delete account" action and a confirmation step.
- API endpoint that deletes the customer account, vehicles, and personal data. Booking records the operator needs are kept with personal fields anonymized.
- Upcoming bookings are cancelled as part of deletion.

**Not in the Linear backlog yet. This blocks App Store submission.**

### 3. Privacy policy and data disclosure (5.1.1(i), 5.1.2)

- A privacy policy at a public URL, entered in App Store Connect **and** linked inside the app (profile screen and registration screen).
- App Privacy answers in App Store Connect must match what the app collects. Expected for the MVP: name, email, phone number, user ID, vehicle details including plate number, and coarse or precise location if it is sent to the API. None of it is used for tracking.
- Collect only what bookings need (5.1.1(iii)). Explain on the registration screen why the phone number is needed (the station may contact you about your booking).

**Not in the Linear backlog yet.**

### 4. Location permission (5.1.1(iv), 5.1.5)

- Request **When In Use** only, never Always. Ask at the moment the customer opens nearby discovery, not at launch.
- The `NSLocationWhenInUseUsageDescription` text must say exactly why, for example: "Ghassalny uses your location to show car washes near you."
- If permission is denied, the app keeps working: it centers on Cairo (`PILOT_MAP_CENTER`), lists branches, and offers area search (GHA-89). No repeated prompts and no blocking dialogs.

Affects GHA-62, GHA-88, and GHA-90.

### 5. Payments (3.1.1, 3.1.3(e))

The car wash is a physical service used outside the app, so Apple's **in-app purchase must not be used** for it. The MVP's pay-at-the-station model needs nothing from Apple. A future online payment (Paymob, Stripe, or Fawry) for washes is allowed through a regular payment provider.

Any purely digital feature sold later (for example, a premium subscription that unlocks app features) would require in-app purchase.

### 6. Login services (4.8)

Email and password with the app's own account system does **not** require Sign in with Apple. If Google, Facebook, or another third-party login is ever added, Sign in with Apple (or an equivalent privacy-focused login) must be offered alongside it. Phone OTP through the app's own system does not trigger this rule.

### 7. A live backend and a demo account for App Review (2.1)

App Review tests the real app against a reachable server.

- The API must be hosted over **HTTPS** before the first TestFlight or App Store submission. iOS App Transport Security blocks plain HTTP, and `mobileEnvSchema` refuses a production build with an `http://` API URL.
- Provide a demo customer account and seeded branches with available slots in the review notes.
- No placeholder screens, "coming soon" tabs, or broken links in the submitted build.

This is the first point where the free-first, local-only constraint must give way to hosting. Keep a free or low-cost hosting option ready before submission.

### 8. Real app, not a website wrapper (4.2)

The Expo app uses native navigation, maps, and controls, and it doesn't embed the admin website. Worker and admin tools stay in the web app. Their screens must not appear in the customer app until there is a worker iOS experience reviewed in its own right.

## Technical checklist for the Expo app

Covered when the app is scaffolded (GHA-58) and before the first build:

- [ ] Bundle identifier chosen and registered (for example, `com.ghassalny.app`). It cannot change after release.
- [ ] `ios.infoPlist.NSLocationWhenInUseUsageDescription` set through the `expo-location` config plugin.
- [ ] `ios.config.usesNonExemptEncryption: false`. The app only uses standard HTTPS, so no export compliance documents are needed.
- [ ] Privacy manifest: Expo generates `PrivacyInfo.xcprivacy`. Add `ios.privacyManifests` entries for any required-reason APIs used by our own code. Check third-party libraries ship their own manifests.
- [ ] Built with the Xcode and iOS SDK version Apple currently requires for new submissions. EAS Build images are updated to keep up.
- [ ] App icon (1024×1024, no transparency) and launch screen.
- [ ] Supports the iPhone screen sizes Apple currently requires for screenshots. iPad support is off unless designed for.
- [ ] Dynamic Type and VoiceOver labels on interactive elements. This is not a formal guideline, but reviewers notice.
- [ ] Arabic right-to-left layout works (`I18nManager`), with Arabic and English App Store metadata.
- [ ] No third-party tracking or ads SDKs, so no App Tracking Transparency prompt is needed. Adding any tracking SDK later requires ATT (5.1.2(i)).
- [ ] Age rating questionnaire completed (expected 4+).

## Maps on iOS (free-first)

- `react-native-maps` with the default provider renders **Apple Maps** on iOS with **no API key and no cost**. This fits the free-first constraint better than public OpenStreetMap tiles, whose usage policy does not allow heavy app traffic.
- Directions handoff (GHA-91): open `https://maps.apple.com/?daddr=<lat>,<lng>`. Optionally offer Google Maps when it is installed, which requires `comgooglemaps` in `LSApplicationQueriesSchemes`.
- The admin web can use Leaflet with OpenStreetMap tiles at low volume.

GHA-86 (free maps decision record) should record this.

## Later features with review impact

| Feature                      | Guideline                  | Requirement                                                                                |
| ---------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| Ratings and reviews          | 1.2 User-generated content | Filtering, a report action, the ability to block users, and published contact details      |
| Push notifications           | 4.5.4                      | Opt-in only. The app must work without them. Marketing pushes need separate consent        |
| Asking for App Store ratings | 5.6.1                      | Use the system review prompt (`expo-store-review`) only                                    |
| Car services beyond washing  | 3.1.3(e)                   | Still physical services, so in-app purchase is not required                                |
| Loyalty points or wallet     | 3.1.1                      | Points with no cash value tied to physical services are fine. Buying digital credit is not |

## Costs outside the free-first constraint

- **Apple Developer Program**: a yearly membership fee is required to publish on the App Store and to use TestFlight. There is no free alternative.
- **HTTPS hosting** for the API and database is needed before App Review (see section 7).
- **EAS Build** has a free tier with queued builds. A Mac with Xcode can build for free instead.
