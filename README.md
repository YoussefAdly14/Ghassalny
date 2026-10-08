# Ghassalny

Ghassalny is a free-first car wash discovery, booking, and operations platform for Egypt.

Customers find nearby petrol station car washes, compare services, and book available time slots from the iOS app. Workers manage daily bookings, cancel slots when needed, and create walk-in bookings for customers who arrive without the app. Business admins manage branches, services, workers, working hours, and bookings.

## Current Phase

Foundation. The monorepo, multi-tenant database, and API are in place, along with sign-in, role and tenant access control, and the slot-generation engine. Next up: booking endpoints (GHA-52 to GHA-57), then the customer iOS app (GHA-10).

## Stack

| Area                  | Choice                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language              | TypeScript 6 everywhere                                                                                                                              |
| Repository            | pnpm workspaces and Turborepo ([ADR 0002](docs/adr/0002-pnpm-turborepo-workspace.md))                                                                |
| Backend               | Fastify 5 modular monolith ([ADR 0001](docs/adr/0001-free-first-modular-monolith.md), [ADR 0004](docs/adr/0004-fastify-api-framework.md))            |
| Customer app          | Expo React Native, **iOS first**                                                                                                                     |
| Admin and worker web  | Next.js                                                                                                                                              |
| Database              | PostgreSQL 17 (Docker) with Prisma 7                                                                                                                 |
| Validation and config | Zod                                                                                                                                                  |
| Maps                  | Stored coordinates and free map rendering (Apple Maps on iOS); paid providers deferred                                                               |
| Auth                  | Email and password, scrypt hashing, 15-minute JWT access tokens and rotating refresh tokens ([ADR 0003](docs/adr/0003-free-first-authentication.md)) |
| Payments              | Out of scope for MVP; customers pay at the station                                                                                                   |

## Repository Layout

The code is grouped by layer ([ADR 0005](docs/adr/0005-layered-folder-layout.md)):

```
backend/                Runs on the server
  api/                  Fastify API: auth, access control, availability engine
  database/             Prisma schema, migrations, seed data, database client
frontend/               Runs on users' devices
  mobile/               Expo customer iOS app (placeholder)
  admin-web/            Next.js admin and worker website (placeholder)
  ui/                   Shared design tokens and components (placeholder)
shared/                 Used by both backend and frontend
  contracts/            Domain enums and API request/response types
  config/               Constants, typed env parsing, TypeScript base configs
docs/                   Product, architecture, ADRs, development guides
```

## Quick Start

Requires Node.js 24, Docker Desktop (running), and pnpm through Corepack. The full guide is [Local Developer Setup](docs/development/local-setup.md).

```sh
corepack enable pnpm
pnpm install
cp backend/database/.env.example backend/database/.env
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
- [ADR 0003: Free-First Authentication](docs/adr/0003-free-first-authentication.md)
- [ADR 0004: Fastify for the API](docs/adr/0004-fastify-api-framework.md)
- [ADR 0005: Layered Folder Layout](docs/adr/0005-layered-folder-layout.md)
- [Booking Engine Invariants](docs/architecture/booking-engine-invariants.md)
- [ADR Template](docs/adr/template.md)

Development

- [Local Developer Setup](docs/development/local-setup.md)
- [Workspace Conventions](docs/development/workspace-conventions.md)
