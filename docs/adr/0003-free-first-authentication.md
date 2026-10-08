# ADR 0003: Free-First Authentication

Related Linear issue: GHA-41

## Status

Accepted

## Context

Customers sign in on the iOS app, and workers and admins sign in on the web app. Phone numbers matter in Egypt: stations call customers about bookings, and many people expect phone login. Verifying phone numbers needs SMS one-time passwords (OTP), which cost money per message. The MVP must avoid paid services (see [free-first constraints](../product/free-first-constraints.md)) and must also pass App Store review.

## Decision

**Email and password, owned by the app, for every role.**

- Passwords are hashed with **scrypt** from Node's standard library (`node:crypto`), with a random 16-byte salt per password. The stored format is `scrypt$N$r$p$salt$hash` (N=16384, r=8, p=1, 64-byte key), so the cost settings can be raised later without breaking existing hashes. There is no native dependency.
- Password rules: 8 to 128 characters.
- Emails are stored lowercase and are unique.
- Customers give a **phone number at registration, stored unverified** in E.164 format (`+201XXXXXXXXX`). Phone numbers are unique, so one number can't be attached to two accounts. It is used for station contact only, never as a login identifier until verified.

**Sessions: short-lived access token plus rotating refresh token.**

- **Access token:** a JWT signed with HS256 using `AUTH_SECRET`, valid for 15 minutes. It holds the user ID (`sub`) and session ID (`sid`). Roles are **not** put in the token. They are loaded from the database on every request, so role changes and account deletion take effect immediately.
- **Refresh token:** 32 random bytes, valid for 30 days. Only its SHA-256 hash is stored, in `auth_sessions`. Each use replaces it with a new one (rotation), and logout revokes it.
- Every authenticated request checks that its session hasn't been revoked or expired.
- The iOS app stores tokens in the Keychain through `expo-secure-store`, never in AsyncStorage. The admin web app will use the same API. Moving it to httpOnly cookies is a later option.

**Abuse protection, free and in-process.**

- Rate limit on the auth endpoints (in-memory, per IP).
- Login returns the same `INVALID_CREDENTIALS` error whether the email is unknown or the password is wrong. It also runs a dummy hash for unknown emails so response timing doesn't reveal which accounts exist.

## Options Considered

- **Phone and SMS OTP as primary login:** best fit for Egypt, but every login costs money. Deferred.
- **Hosted auth (Auth0, Clerk, Firebase Auth, Supabase Auth):** fast to adopt, but adds lock-in and paid tiers at scale. Rejected for the MVP (ADR 0001).
- **Sign in with Apple and Google:** adding Google login would require Sign in with Apple as well (App Store guideline 4.8). Deferred until there's demand.
- **Argon2id:** stronger memory-hardness than scrypt, but needs a native module with build scripts. scrypt is a sound, standard choice and avoids native builds on Windows and CI.
- **Long-lived JWT only:** simple, but can't be revoked, which breaks logout and account deletion (App Store 5.1.1(v)). Rejected.

## Consequences

Benefits:

- Zero cost and zero external services.
- Revocable sessions, so logout, "sign out everywhere", and account deletion all work.
- Roles are always current.

Tradeoffs:

- One extra session lookup per request. This is negligible at pilot scale, and could be cached later.
- Phone numbers are unverified, so a customer could enter someone else's number. Staff should treat the number as contact information, not proof of identity.
- The in-memory rate limiter resets on restart and isn't shared between instances. It needs a shared store when the API runs on more than one instance.

## Future Upgrade Path

1. **Phone OTP** through an SMS or WhatsApp provider when the upgrade triggers in the free-first constraints are met. Verify existing numbers on next login, then allow phone-plus-OTP sign-in.
2. **Sign in with Apple**, plus Google if wanted. Both must ship together on iOS.
3. **Refresh-token reuse detection:** keep previous token hashes and revoke the whole session family when an old one is replayed.
4. **Password reset by email** once a transactional email provider exists. Until then, support resets passwords manually.
5. Move the rate limiter to a shared store when the API scales out.

## Review Trigger

Revisit when paid SMS is approved, when more than one API instance runs, or when App Review or customers ask for social login.
