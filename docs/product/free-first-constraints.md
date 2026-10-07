# Free-First Constraints

Related Linear issue: GHA-21

## Decision

Ghassalny starts with free and open-source infrastructure wherever practical. Paid cloud services, paid databases, paid maps, paid notification providers, and paid payment services are deferred until the product proves pilot demand.

This constraint is not a quality downgrade. The codebase should still be clean, typed, modular, and suitable for commercial handover.

## Database

Initial choice:

- PostgreSQL running locally through Docker Compose.
- Prisma for schema, migrations, and typed database access.

Deferred upgrades:

- Managed PostgreSQL such as Neon, Supabase, Railway, Render, or AWS RDS.
- Read replicas, backups, and hosted observability.

## Maps and Search

Initial choice:

- Store branch latitude and longitude manually.
- Use radius search in the backend.
- Use OpenStreetMap-compatible rendering for the customer map experience.
- Provide external directions links using coordinates.

Deferred upgrades:

- Paid Google Maps APIs.
- Paid geocoding and places search.
- Advanced route optimization or traffic-aware ETA.

## Hosting

Initial choice:

- Local development only during foundation.
- Keep apps deployable with environment variables and build scripts.

Deferred upgrades:

- Vercel, Render, Fly.io, Railway, or cloud VPS.
- Production object storage and CDN.
- Managed logs and monitoring.

## Authentication

Initial choice:

- App-owned authentication using secure password hashing and JWT or secure sessions.
- Role-based access control enforced in backend modules.
- Tenant scoping enforced server-side.

Deferred upgrades:

- Auth0, Clerk, Firebase Auth, or Supabase Auth.
- Phone OTP through paid SMS.
- SSO for enterprise customers.

## Notifications

Initial choice:

- In-app state only.
- Manual support process for pilot operations.

Deferred upgrades:

- WhatsApp Business API.
- SMS providers.
- Push notification service.
- Transactional email provider.

## Payments

Initial choice:

- Payment is out of scope.
- Customers pay on-site.

Deferred upgrades:

- Stripe or local payment gateway.
- Deposits, cancellation fees, refunds, and invoices.

## Upgrade Triggers

Paid services become reasonable when one of these is true:

- A pilot operator needs production uptime.
- More than one operator requires hosted access.
- Booking volume makes manual reminders unreliable.
- Customer acquisition requires map search beyond stored branch data.
- Commercial buyers require managed backups, audit logs, SSO, or analytics.
