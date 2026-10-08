# @ghassalny/api

Backend API for Ghassalny: one deployable modular monolith built with Fastify ([ADR 0001](../../docs/adr/0001-free-first-modular-monolith.md), [ADR 0004](../../docs/adr/0004-fastify-api-framework.md)).

## Run it

```sh
pnpm db:up && pnpm db:seed          # from the repo root, once
cp backend/api/.env.example backend/api/.env
pnpm --filter @ghassalny/api dev    # http://localhost:4000, restarts on save
```

The API listens on `0.0.0.0`, so a physical iPhone on the same Wi-Fi can reach it at your computer's LAN IP.

| Command                              | What it does                                 |
| ------------------------------------ | -------------------------------------------- |
| `pnpm --filter @ghassalny/api dev`   | Development server with reload (`tsx watch`) |
| `pnpm --filter @ghassalny/api test`  | Unit and route tests (Vitest)                |
| `pnpm --filter @ghassalny/api build` | Production bundle in `dist/server.js` (tsup) |
| `pnpm --filter @ghassalny/api start` | Run the production bundle                    |

## Endpoints

| Method and path       | Auth          | Purpose                                                 |
| --------------------- | ------------- | ------------------------------------------------------- |
| `GET /health`         | Public        | Liveness and database check                             |
| `POST /auth/register` | Public        | Customer sign-up. Returns user and tokens (201)         |
| `POST /auth/login`    | Public        | Email and password sign-in. Returns user and tokens     |
| `POST /auth/refresh`  | Refresh token | Rotates the refresh token and issues a new access token |
| `POST /auth/logout`   | Refresh token | Revokes the session (204)                               |
| `GET /me`             | Access token  | Current user, roles, and assigned branches              |

Booking engine ([invariants](../../docs/architecture/booking-engine-invariants.md)):

| Method and path                                       | Auth         | Purpose                                                                          |
| ----------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| `GET /branches/:branchId/availability`                | Public       | Bookable slots for `?serviceId=&date=YYYY-MM-DD` (branch-local date)             |
| `POST /bookings`                                      | Customer     | Book a slot for one of your vehicles (201)                                       |
| `POST /bookings/:bookingId/cancel`                    | Customer     | Cancel your own booking up to 5 hours before it starts                           |
| `POST /branches/:branchId/walk-ins`                   | Branch staff | Book a walk-in by name and optional phone, at any free minute, default now (201) |
| `POST /branches/:branchId/bookings/:bookingId/status` | Branch staff | Arrived, in progress, completed, cancelled, or no-show                           |
| `POST /branches/:branchId/availability-blocks`        | Branch staff | Block time; lists existing bookings it overlaps, without cancelling them (201)   |

Branch staff means a worker assigned to that branch, a business admin of its organization, or a platform admin.

Request and response types live in `@ghassalny/contracts` (`RegisterCustomerRequest`, `AuthSessionResponse`, `CreateBookingRequest`, `BookingResponse`, `AvailabilityResponse`, and so on). Send the access token as `Authorization: Bearer <token>`. The credential endpoints allow 10 requests per minute per IP.

### Error shape

Every error, whatever the status code, has this body:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request is invalid.",
    "details": [{ "path": "email", "message": "Enter a valid email address." }]
  }
}
```

Clients branch on `code` (`ApiErrorCode` in `@ghassalny/contracts`), not on `message`.

## Layout

```
src/
  server.ts            Process entry: env, database, listen, graceful shutdown
  app.ts               buildApp(dependencies). Wires plugins and modules; tests inject fakes
  config.ts            Validated environment (apiEnvSchema)
  common/              Errors, error handler, Zod input parsing
  modules/
    access/            Auth context, role guards, tenant-scope helpers
    auth/              Passwords, tokens, auth service, repository, routes
    users/             GET /me
    availability/      Slot generation, walk-in checks, and time-zone helpers (pure functions)
    bookings/          Booking engine service, status rules, repository, and routes
    health/
  testing/             In-memory fakes and a test app factory
```

Module rules: routes validate and delegate, services hold business rules, repositories hold Prisma queries. Business endpoints must call `assertCanManageOrganization` or `assertCanOperateBranch` from `modules/access/tenant-scope.ts` before touching tenant data.

## Tests

- Test files sit next to the code they test and are named `*.test.ts`.
- Route tests use `createTestApp()` (in-memory repository, controllable clock) and `app.inject`, so they need no database or open port.
- The availability engine is pure and tested with fixed Cairo dates, including daylight saving.
- `InMemoryBookingRepository` mimics the database's per-bay exclusion constraint and optimistic status updates. Its `beforeInsert` hook simulates a concurrent booking winning the race. The advisory locks and constraint mapping in `PrismaBookingRepository` need a real database, so check them against local PostgreSQL after changing that file.
