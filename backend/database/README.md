# @ghassalny/database

Prisma schema, migrations, seed data, and the database client. **Server-side only.** Never import this from the mobile or admin-web client code.

- Prisma 7 with the `prisma-client` generator. The client is generated into `src/generated/prisma` (gitignored).
- Connects through the `@prisma/adapter-pg` driver adapter.
- The connection URL comes from `DATABASE_URL`. Copy `.env.example` to `.env`.

## Scripts

Run from the repository root:

| Command                  | What it does                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `pnpm db:up`             | Start local PostgreSQL in Docker and wait until it is healthy        |
| `pnpm db:generate`       | Regenerate the typed client after editing the schema                 |
| `pnpm db:migrate`        | Create and apply a development migration                             |
| `pnpm db:migrate:deploy` | Apply committed migrations (CI and hosted environments)              |
| `pnpm db:seed`           | Wipe all tables and load the Cairo and Giza demo data                |
| `pnpm db:reset`          | Drop the database, re-apply every migration, then run `pnpm db:seed` |
| `pnpm db:studio`         | Open Prisma Studio                                                   |

## Usage

```ts
import { createDatabaseClient } from '@ghassalny/database';

const db = createDatabaseClient(); // validates DATABASE_URL, one client per process
```

## Rules enforced by the database

Some rules can't be written in `schema.prisma`, so they live as SQL at the end of the first migration:

| Constraint                                  | Rule                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `bookings_no_overlap_per_bay`               | Active bookings never overlap on the same branch bay                                       |
| Composite foreign keys on `organization_id` | Child rows cannot link records from another organization                                   |
| `user_role_assignments_scope_check`         | Worker and admin roles need an organization; customer and platform roles must not have one |
| `user_role_assignments_global_role_key`     | A user holds each global role at most once                                                 |
| `branch_working_hours_no_overlap`           | Opening intervals on the same day don't overlap                                            |
| `branches_coordinates_check`                | Latitude and longitude are within valid ranges                                             |
| Range checks                                | Positive durations and bays, non-negative prices, `ends_at > starts_at`                    |

Prisma leaves these constraints alone in later migrations. When a migration needs new raw SQL, create it with `prisma migrate dev --create-only`, add the SQL, then apply it.

Enum values shared with the apps (`UserRole`, `BookingStatus`, `BookingSource`, `VehicleType`, `Locale`) are checked against `@ghassalny/contracts` and `@ghassalny/config` at compile time in `src/enum-parity.ts`.

## Seed data

`pnpm db:seed` refuses to run when `NODE_ENV=production` or when the database host isn't local, unless `SEED_ALLOW_REMOTE=true` is set. It loads:

- One demo operator with 7 branches: 6 active across Nasr City, Heliopolis, Maadi, New Cairo, Mohandessin, and Sheikh Zayed, and 1 draft in 6th of October. One branch is open 24 hours and one is closed on Fridays.
- 4 services with branch-specific prices in EGP, and Friday prayer breaks in the opening hours.
- A maintenance block tomorrow afternoon and 5 sample bookings at the Nasr City pilot branch.
- These accounts, all with the password `Ghassalny123!` (development only):

| Email                     | Role                                |
| ------------------------- | ----------------------------------- |
| `customer@ghassalny.test` | Customer with two vehicles          |
| `worker@ghassalny.test`   | Worker assigned to Nasr City        |
| `admin@ghassalny.test`    | Business admin of the demo operator |
| `platform@ghassalny.test` | Platform admin                      |

Every brand, name, and phone number in the seed is fictional.

## Tenant rule

Every business-facing table resolves to an organization. Repositories must include the organization scope in every admin and worker query.
