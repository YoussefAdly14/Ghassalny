# Ghassalny

Ghassalny is a free-first car wash discovery, booking, and operations platform for Egypt.

Customers can find nearby petrol station car washes, compare services, and book available time slots. Workers can manage daily bookings, cancel slots when needed, and create walk-in bookings for customers who arrive without the app. Business admins can manage branches, services, workers, working hours, and bookings.

## Current Phase

The project is in foundation planning. The first goal is to lock the MVP scope, user roles, free-first constraints, and architecture decisions before production code is written.

## Planned Stack

- Language: TypeScript across backend, web, mobile, and shared packages where practical.
- Repository: monorepo.
- Backend: modular monolith in Node.js, with framework choice finalized before scaffolding.
- Admin web: Next.js.
- Mobile app: Expo React Native.
- Database: local PostgreSQL with Prisma.
- Maps: OpenStreetMap-compatible approach, with paid map providers deferred.
- Auth: local-first app auth with JWT or secure sessions.
- Payments: out of scope for MVP.

## Documentation

- [MVP Scope](docs/product/mvp-scope.md)
- [Personas and Roles](docs/product/personas-and-roles.md)
- [Free-First Constraints](docs/product/free-first-constraints.md)
- [Architecture Overview](docs/architecture/architecture-overview.md)
- [ADR Template](docs/adr/template.md)
- [ADR 0001: Free-First Modular Monolith](docs/adr/0001-free-first-modular-monolith.md)

