# ADR 0005: Layered Folder Layout

## Status

Accepted. Supersedes the folder shape listed in ADR 0001 (`apps/*` and `packages/*`). The rest of ADR 0001 still stands.

## Context

The repository started with the common `apps/` and `packages/` monorepo layout. That layout groups code by "deployable or library", which says little about where code runs. The product owner wants the structure to be obvious at a glance: backend in one place, frontend in another, shared code in a third.

## Decision

Group workspaces by layer:

| Folder               | Contents                                                                          |
| -------------------- | --------------------------------------------------------------------------------- |
| `backend/api`        | Fastify API                                                                       |
| `backend/database`   | Prisma schema, migrations, seed data, database client                             |
| `frontend/mobile`    | Expo customer iOS app                                                             |
| `frontend/admin-web` | Next.js admin and worker website                                                  |
| `frontend/ui`        | Shared design tokens and components                                               |
| `shared/contracts`   | Domain enums and API types (`@ghassalny/contracts`, formerly `@ghassalny/shared`) |
| `shared/config`      | Constants, env parsing, TypeScript base configs                                   |

Rules:

- Imports flow one way: `backend` and `frontend` may use `shared`. `shared` uses neither. `frontend` never imports `backend`. This keeps server-only code (database client, secrets) out of the iOS binary.
- Inside an app, code is organized by feature module (for example `backend/api/src/modules/auth/`), with tests next to the code.
- Package names stay `@ghassalny/<name>`, so moving a folder never changes imports.

## Options Considered

- **Keep `apps/` and `packages/`:** the conventional layout, but it hides the backend and frontend split.
- **Separate repositories for backend and frontend:** makes sharing contracts harder and loses atomic changes across layers.
- **Layered monorepo:** accepted.

## Consequences

- New contributors see immediately where server and device code lives.
- An additional backend service or frontend app goes under the matching layer folder, for example `backend/worker` or `frontend/worker-tablet`.
- Tooling globs (`pnpm-workspace.yaml`, ESLint and Prettier ignores) reference these three folders.

## Review Trigger

Revisit if the backend is split into independently deployed services that need their own top-level grouping.
