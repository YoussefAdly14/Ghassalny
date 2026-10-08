# ADR 0004: Fastify for the API

Related Linear issue: GHA-107

## Status

Accepted

## Context

ADR 0001 chose a Node.js modular monolith and deferred the HTTP framework. The API serves the iOS app and the admin web app, and has to stay understandable for a future buyer or new developers. Validation already uses Zod (`@ghassalny/config`), so the framework should work well with it.

## Decision

Use **Fastify 5** with plain TypeScript modules:

- `src/app.ts` builds the app from explicit dependencies (database, clock, config), so tests can pass fakes.
- One folder per domain module (`auth`, `users`, `access`, `availability`, ...). Each has routes (validate and delegate), a service (business rules), and a repository (Prisma queries).
- Request bodies and queries are validated with Zod through a small `parseInput` helper. Errors use one JSON shape: `{ "error": { "code", "message", "details"? } }` (see `@ghassalny/shared`).
- Security plugins: `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`.
- Development runs with `tsx watch`. Production is bundled with `tsup` into `dist/server.js`.
- Tests use Vitest. Route tests use Fastify's built-in `inject` and don't open a network port.

## Options Considered

- **NestJS:** strong module and dependency-injection conventions, but heavy, decorator-based, and more framework to learn and maintain for a small team.
- **Express:** ubiquitous, but older async error handling and slower. The ecosystem is moving to Fastify or Hono.
- **Hono:** small and fast, designed for edge runtimes. Less mature for long-running Node servers with plugins.
- **Fastify:** fast, typed, plugin-based, and mature on Node. Accepted.

## Consequences

- Module boundaries are a convention we enforce in review, not something the framework forces.
- No automatic OpenAPI generation yet. `@fastify/swagger` can be added when an external integrator needs it.

## Review Trigger

Revisit if the team grows enough that NestJS-style enforced structure would pay off, or if the API moves to an edge runtime.
