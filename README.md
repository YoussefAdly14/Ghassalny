# Ghassalny

Ghassalny is a free-first car wash discovery, booking, and operations platform for Egypt.

Customers find nearby petrol station car washes, compare services, and book available time slots from the iOS app. Workers manage daily bookings, cancel slots when needed, and create walk-in bookings for customers who arrive without the app. Business admins manage branches, services, workers, working hours, and bookings.

## Current Phase

Foundation. The monorepo, shared packages, and local database are in place. Next up: the domain model (GHA-7), then auth (GHA-8) and the booking engine (GHA-9).

## Stack

| Area                  | Choice                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Language              | TypeScript 6 everywhere                                                                                                |
| Repository            | pnpm workspaces and Turborepo ([ADR 0002](docs/adr/0002-pnpm-turborepo-workspace.md))                                  |
| Backend               | Node.js modular monolith ([ADR 0001](docs/adr/0001-free-first-modular-monolith.md)), framework chosen at scaffold time |
| Customer app          | Expo React Native, **iOS first**                                                                                       |
| Admin and worker web  | Next.js                                                                                                                |
| Database              | PostgreSQL 17 (Docker) with Prisma 7                                                                                   |
| Validation and config | Zod                                                                                                                    |
| Maps                  | Stored coordinates and free map rendering (Apple Maps on iOS); paid providers deferred                                 |
| Auth                  | App-owned email and password with JWT or secure sessions                                                               |
| Payments              | Out of scope for MVP; customers pay at the station                                                                     |

## Repository Layout

```
apps/
  api/          Backend API (placeholder)
  admin-web/    Next.js admin and worker app (placeholder)
  mobile/       Expo customer iOS app (placeholder)
packages/
  config/       Constants, typed env parsing, TypeScript base configs
  database/     Prisma schema, migrations, client (server-only)
  shared/       Domain enums and contracts shared by every app
  ui/           Reserved for shared design tokens and components
docs/           Product, architecture, ADRs, development guides
```

## Quick Start

Requires Node.js 24, Docker Desktop (running), and pnpm through Corepack. The full guide is [Local Developer Setup](docs/development/local-setup.md).

```sh
corepack enable pnpm
pnpm install
cp packages/database/.env.example packages/database/.env
pnpm db:up
pnpm db:migrate
pnpm typecheck
```

## Scripts

| Script                                          | Purpose                          |
| ----------------------------------------------- | -------------------------------- |
| `pnpm dev`                                      | Run all apps in development mode |
| `pnpm build`                                    | Build all apps and packages      |
| `pnpm typecheck`                                | Type-check every workspace       |
| `pnpm test`                                     | Run all tests                    |
| `pnpm lint` / `pnpm lint:fix`                   | ESLint                           |
| `pnpm format` / `pnpm format:check`             | Prettier                         |
| `pnpm db:up` / `db:down` / `db:logs`            | Local PostgreSQL in Docker       |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Prisma                           |

## Documentation

Product

- [MVP Scope](docs/product/mvp-scope.md)
- [Personas and Roles](docs/product/personas-and-roles.md)
- [Free-First Constraints](docs/product/free-first-constraints.md)
- [iOS App Store Readiness](docs/product/ios-app-store-readiness.md)

Architecture

- [Architecture Overview](docs/architecture/architecture-overview.md)
- [ADR 0001: Free-First Modular Monolith](docs/adr/0001-free-first-modular-monolith.md)
- [ADR 0002: pnpm Workspaces with Turborepo](docs/adr/0002-pnpm-turborepo-workspace.md)
- [ADR Template](docs/adr/template.md)

Development

- [Local Developer Setup](docs/development/local-setup.md)
- [Workspace Conventions](docs/development/workspace-conventions.md)
