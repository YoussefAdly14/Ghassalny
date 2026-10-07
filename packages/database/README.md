# @ghassalny/database

Prisma schema, migrations, and the database client. **Server-side only.** Never import this from the mobile or admin-web client code.

- Prisma 7 with the `prisma-client` generator. The client is generated into `src/generated/prisma` (gitignored).
- Connects through the `@prisma/adapter-pg` driver adapter.
- The connection URL comes from `DATABASE_URL`. Copy `.env.example` to `.env`.

## Scripts

Run from the repository root:

| Command                  | What it does                                                  |
| ------------------------ | ------------------------------------------------------------- |
| `pnpm db:up`             | Start local PostgreSQL in Docker and wait until it is healthy |
| `pnpm db:generate`       | Regenerate the typed client after editing the schema          |
| `pnpm db:migrate`        | Create and apply a development migration                      |
| `pnpm db:migrate:deploy` | Apply committed migrations (CI and hosted environments)       |
| `pnpm db:studio`         | Open Prisma Studio                                            |

## Usage

```ts
import { createDatabaseClient } from '@ghassalny/database';

const db = createDatabaseClient(); // validates DATABASE_URL, one client per process
```

## Tenant rule

Every business-facing table must resolve to an organization. Repositories must include the organization scope in every admin and worker query.
