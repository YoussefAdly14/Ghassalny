# Architecture Overview

Related Linear issue: GHA-99

## Goal

Ghassalny should begin as a compact, professional monorepo that can support a pilot quickly and remain credible for future sale, handover, or white-label use.

## Application Boundaries

The planned apps are:

- `apps/api`: backend API and domain services.
- `apps/admin-web`: business admin and worker operations web interface.
- `apps/mobile`: customer mobile app built with Expo React Native.

The planned packages are:

- `packages/database`: Prisma schema, migrations, seed data, and database client.
- `packages/shared`: shared DTOs, enums, and domain contracts.
- `packages/config`: typed environment and app configuration helpers.
- `packages/ui`: shared UI primitives when reuse becomes worth it.

## Backend Shape

The backend starts as a modular monolith. That means one deployable backend with strict internal module boundaries.

Initial modules:

- Auth: login, registration, session/token handling, password hashing.
- Users: profiles, roles, organization membership, worker assignment.
- Organizations: tenant accounts and platform ownership boundaries.
- Branches: petrol station car wash locations, coordinates, hours, and branch settings.
- Services: car wash service catalog, pricing, duration, and branch availability.
- Availability: working hours, blocked times, capacity, and slot generation.
- Bookings: booking creation, cancellation, status transitions, and history.

## Multi-Tenant Model

Tenant isolation is required from day one. Business-facing data should belong to an organization. Branches, services, workers, hours, and bookings should always resolve through an organization boundary.

The first schema should make tenant leakage hard by design:

- Branches belong to organizations.
- Workers belong to organizations and may be assigned to branches.
- Services belong to organizations and may be enabled per branch.
- Bookings belong to a branch and organization.
- Admin queries must include organization scope.

This is implemented in [`packages/database/prisma/schema.prisma`](../../packages/database/prisma/schema.prisma). Branch services, working hours, availability blocks, staff assignments, and bookings reference their branch and service through composite foreign keys on `(id, organization_id)`. PostgreSQL therefore rejects any row that links records from two different organizations.

### Data model

| Table                      | Tenant-scoped          | Purpose                                                   |
| -------------------------- | ---------------------- | --------------------------------------------------------- |
| `organizations`            | (the tenant)           | Car wash operators                                        |
| `users`                    | No                     | Everyone who signs in                                     |
| `user_role_assignments`    | Worker and admin roles | Role grants; tenant roles must name an organization       |
| `vehicles`                 | No                     | Customer cars, soft-deleted                               |
| `station_brands`           | No                     | Petrol station brands (platform catalog)                  |
| `branches`                 | Yes                    | Wash locations with coordinates, bays, and time zone      |
| `branch_staff_assignments` | Yes                    | Which workers operate which branch                        |
| `services`                 | Yes                    | The operator's service catalog                            |
| `branch_services`          | Yes                    | Price and duration of a service at a branch               |
| `branch_working_hours`     | Yes                    | Weekly opening intervals in local time                    |
| `availability_blocks`      | Yes                    | Closures and maintenance windows                          |
| `bookings`                 | Yes                    | Reserved slots with price, contact, and vehicle snapshots |
| `booking_status_history`   | Through booking        | Append-only status change log                             |

## Booking Engine Boundary

The booking engine is a core product asset and should not be scattered across controllers or UI code.

It owns:

- Slot generation.
- Existing booking conflict checks.
- Blocked-time checks.
- Booking status transition rules.
- Cancellation policy hooks.

It does not own:

- User authentication.
- UI formatting.
- Payment capture.
- Notification delivery.

The rules it must never break are listed in [Booking Engine Invariants](booking-engine-invariants.md). The most important one, no two active bookings on the same bay at the same time, is also enforced by a PostgreSQL exclusion constraint.

## Design Pattern Decisions

The first accepted decision is [ADR 0001](../adr/0001-free-first-modular-monolith.md).

Practical rules:

- Controllers or route handlers validate and delegate.
- Services hold business logic.
- Repositories hide database queries.
- Shared packages expose stable contracts, not app internals.
- Each module should be understandable in isolation.
