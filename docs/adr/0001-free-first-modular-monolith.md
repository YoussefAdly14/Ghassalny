# ADR 0001: Free-First Modular Monolith

## Status

Accepted

## Context

Ghassalny needs to move quickly from planning to a working pilot while keeping the codebase clean enough for future SaaS, marketplace, or white-label use.

The first build must avoid paid infrastructure. It also needs clear boundaries for customer booking, worker operations, business administration, and future platform administration.

## Decision

Start as a TypeScript monorepo with a modular monolith backend.

The backend will be organized around domain modules:

- auth
- users
- organizations
- branches
- services
- availability
- bookings

Each backend module should expose a small public interface and keep its business rules in services. Database access should sit behind repositories or narrowly scoped data-access adapters. API boundaries should validate input through DTOs or schemas before calling domain services.

The monorepo will eventually use this shape. (Superseded by [ADR 0005](0005-layered-folder-layout.md), which groups these under `backend/`, `frontend/`, and `shared/`.)

- apps/api
- apps/admin-web
- apps/mobile
- packages/database
- packages/shared
- packages/config
- packages/ui

## Patterns

- Modular monolith before microservices.
- Domain-driven module boundaries.
- Repository pattern for persistence boundaries.
- Service layer for business rules and booking invariants.
- DTO or schema validation at API boundaries.
- Role-based access control.
- Tenant scoping from day one.
- Shared types for stable contracts across API, web, and mobile.

## Options Considered

- Microservices: rejected for MVP because operational overhead would be high before product-market proof.
- Single app with mixed concerns: rejected because it would reduce resale and handover quality.
- Backend-as-a-service first: rejected because it could create lock-in and paid-service pressure too early.
- Modular monolith: accepted because it gives clean boundaries without distributed-system complexity.

## Consequences

Benefits:

- Faster local development.
- Clean enough for corporate handover.
- Easier refactoring into services later if the business grows.
- Lower infrastructure cost during validation.

Tradeoffs:

- The team must enforce module boundaries intentionally.
- Some platform concerns, such as audit logs and billing, are deferred.
- The first database schema must be designed carefully to avoid tenant leakage.

## Review Trigger

Revisit this decision when Ghassalny has multiple paying operators, production hosting, and clear scale pressure that cannot be handled inside one backend app.
