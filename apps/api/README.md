# @ghassalny/api

Backend API for Ghassalny: one deployable modular monolith built with Fastify ([ADR 0001](../../docs/adr/0001-free-first-modular-monolith.md), [ADR 0004](../../docs/adr/0004-fastify-api-framework.md)).

## Run it

```sh
pnpm db:up && pnpm db:seed          # from the repo root, once
cp apps/api/.env.example apps/api/.env
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

Request and response types live in `@ghassalny/shared` (`RegisterCustomerRequest`, `AuthSessionResponse`, `CurrentUserResponse`, and so on). Send the access token as `Authorization: Bearer <token>`. The credential endpoints allow 10 requests per minute per IP.

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

Clients branch on `code` (`ApiErrorCode` in `@ghassalny/shared`), not on `message`.

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
    availability/      Slot generation engine and time-zone helpers (pure functions)
    health/
  testing/             In-memory fakes and a test app factory
```

Module rules: routes validate and delegate, services hold business rules, repositories hold Prisma queries. Business endpoints must call `assertCanManageOrganization` or `assertCanOperateBranch` from `modules/access/tenant-scope.ts` before touching tenant data.

## Tests

- Test files sit next to the code they test and are named `*.test.ts`.
- Route tests use `createTestApp()` (in-memory repository, controllable clock) and `app.inject`, so they need no database or open port.
- The availability engine is pure and tested with fixed Cairo dates, including daylight saving.
