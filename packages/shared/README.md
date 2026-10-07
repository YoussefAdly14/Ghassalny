# @ghassalny/shared

Stable domain contracts shared by the API, admin web, and iOS app: enums now, request and response DTOs as the API grows.

Rules:

- **No runtime dependencies.** This code ships inside the iOS bundle.
- No platform APIs (Node, DOM, or React Native).
- Enum string values must match the Prisma enums in `packages/database`.

```ts
import { BookingStatus, isBookingStatus, UserRole } from '@ghassalny/shared';
```
