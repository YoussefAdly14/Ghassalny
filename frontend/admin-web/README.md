# frontend/admin-web

Next.js web app for business admins and station workers.

## Status

Placeholder. Scaffolded by GHA-76.

## Areas

- **Business admin**: branches, services, working hours, workers, bookings, and reports (GHA-12).
- **Worker**: a simpler, tablet-friendly daily schedule with walk-ins and status actions (GHA-11).

All data is tenant-scoped. The UI hides what a user cannot access, but the API is the enforcement point.

## Configuration

Copy `.env.example` to `.env.local`. Only `NEXT_PUBLIC_*` values reach the browser. Validate them with `adminWebEnvSchema` from `@ghassalny/config`.

Shared workspace packages ship TypeScript source, so `next.config.ts` must list them in `transpilePackages`.
