# apps/api

Backend API for Ghassalny: one deployable modular monolith (see [ADR 0001](../../docs/adr/0001-free-first-modular-monolith.md)).

## Status

Placeholder. The HTTP framework is chosen and the app scaffolded before the auth endpoints (GHA-42 onward).

## Planned modules

`auth`, `users`, `organizations`, `branches`, `services`, `availability`, `bookings`.

Each module keeps route handlers thin (validate, then delegate), business rules in services, and database access behind repositories that use `@ghassalny/database`.

## Configuration

Copy `.env.example` to `.env`. Values are validated at startup with `apiEnvSchema` from `@ghassalny/config`, and the API refuses to start with invalid configuration.

## Related Linear issues

- GHA-8: Authentication and access control
- GHA-9: Booking and availability engine
- GHA-85: Admin API routes
- GHA-88 and GHA-89: Nearby and area search endpoints
