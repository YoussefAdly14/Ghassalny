# Booking Engine Invariants

Related Linear issue: GHA-48

These are the rules the booking system must never break. The booking engine (GHA-49 to GHA-57) enforces all of them in its service layer. Where marked **[DB]**, PostgreSQL also enforces the rule, so a bug or race in application code cannot violate it.

## 1. Time

1. Every instant is stored as `timestamptz` in UTC.
2. Wall-clock rules (working hours, "today") are read in the branch's IANA time zone (`Branch.timeZone`, default `Africa/Cairo`). Egypt observes daylight saving time, so never use a fixed `+02:00` offset.
3. A booking occupies the half-open interval `[startsAt, endsAt)`. A booking ending at 10:30 and another starting at 10:30 do **not** overlap.
4. `endsAt > startsAt`. **[DB]**
5. `endsAt = startsAt + durationMinutes`, where `durationMinutes` is copied from the branch service when the booking is created.

## 2. Capacity and no-overlap

A branch can wash `Branch.washBays` cars at the same time (default 1).

1. A booking **holds capacity** while its status is `CONFIRMED`, `ARRIVED`, or `IN_PROGRESS`. `COMPLETED`, `CANCELLED`, and `NO_SHOW` release it.
2. Every booking is assigned a `bayNumber` from 1 to `washBays`. **[DB: range check against ≥ 1]**
3. **No-overlap:** two capacity-holding bookings at the same branch and bay never overlap in time. **[DB: exclusion constraint `bookings_no_overlap_per_bay`]**
4. It follows that at any instant, the number of capacity-holding bookings at a branch is at most `washBays`.
5. When creating a booking, the engine assigns the **lowest-numbered free bay** for the requested interval. If no bay is free, the slot is unavailable.
6. Lowering `washBays` below the number of bays used by future holding bookings is rejected until those bookings are moved or cancelled.

## 3. When a booking may start

A booking is valid only if all of these hold for its interval:

1. It lies entirely inside one working-hours interval for the branch's local day (`BranchWorkingHours`). Days with no working-hours rows are closed.
2. It does not overlap any availability block for the branch (`AvailabilityBlock`, half-open, same rule as 1.3).
3. The branch is `ACTIVE`, the organization is `ACTIVE`, and the branch service and service are both active.
4. **Customer bookings** start on the branch slot grid: a multiple of `Branch.slotIntervalMinutes` after the opening time of that working-hours interval.
5. **Customer bookings** start at least `MIN_LEAD_MINUTES` (30) from now and no more than `BOOKING_HORIZON_DAYS` (14) ahead.
6. **Walk-in bookings** made by workers may start at any minute inside working hours, including now. They still obey 2.3 and 3.1 to 3.3.

## 4. Customer limits

1. A customer cannot hold two capacity-holding bookings that overlap in time, at any branch.
2. A customer can hold at most `MAX_ACTIVE_BOOKINGS_PER_CUSTOMER` (3) future capacity-holding bookings. This stops slots being hoarded.
3. The vehicle on a booking belongs to the booking customer and is not deleted.

## 5. Status transitions

| From          | Allowed to                              | Who                                                     |
| ------------- | --------------------------------------- | ------------------------------------------------------- |
| `CONFIRMED`   | `ARRIVED`, `CANCELLED`, `NO_SHOW`       | Worker or admin. The customer may only cancel (see 5.4) |
| `ARRIVED`     | `IN_PROGRESS`, `COMPLETED`, `CANCELLED` | Worker or admin                                         |
| `IN_PROGRESS` | `COMPLETED`                             | Worker or admin                                         |
| `COMPLETED`   | (terminal)                              |                                                         |
| `CANCELLED`   | (terminal)                              |                                                         |
| `NO_SHOW`     | (terminal)                              |                                                         |

1. Any transition not in the table is rejected.
2. `NO_SHOW` is allowed only after `startsAt + NO_SHOW_GRACE_MINUTES` (15).
3. Every status change, including creation, writes a `BookingStatusHistory` row **in the same transaction** with the previous status, new status, acting user, and optional reason.
4. A customer may cancel only their own `CONFIRMED` booking before `startsAt - CUSTOMER_CANCEL_CUTOFF_MINUTES`. The exact cutoff is set by the cancellation policy (GHA-20).
5. Workers may change bookings only at branches they are assigned to. Business admins may change bookings only within their organization.
6. Leaving a capacity-holding status releases the bay immediately, so that time becomes bookable again.

## 6. Snapshots

A booking keeps working the same way when the catalog changes later.

1. Price, currency, duration, and service name are copied onto the booking when it is created. Later price or duration edits do not change existing bookings.
2. Contact name and phone are copied onto the booking, which covers walk-ins without an account. Vehicle type and plate are copied too.
3. Changing working hours or adding an availability block **does not cancel** existing bookings. The API reports the conflicting bookings so staff can contact customers and cancel them explicitly.

## 7. Tenancy

1. A booking's organization equals its branch's organization and its service's organization. **[DB: composite foreign keys]**
2. A branch service links a branch and a service of the same organization. **[DB: composite foreign keys]**
3. Every engine query is scoped by organization or by branch. A booking ID alone never grants access.

## 8. Concurrency

1. Create a booking inside one database transaction: check rules, pick a bay, insert the booking, insert the status history row.
2. If two requests race for the same bay, the exclusion constraint rejects the second (`SQLSTATE 23P01`). The engine retries once with a fresh bay choice, then returns a `SLOT_UNAVAILABLE` error.
3. Status changes use an optimistic check (`WHERE id = ? AND status = <expected>`) so two workers cannot apply conflicting transitions.

## Engine defaults

| Constant                           | Value | Notes                  |
| ---------------------------------- | ----- | ---------------------- |
| `MIN_LEAD_MINUTES`                 | 30    | Customer bookings only |
| `BOOKING_HORIZON_DAYS`             | 14    |                        |
| `MAX_ACTIVE_BOOKINGS_PER_CUSTOMER` | 3     |                        |
| `NO_SHOW_GRACE_MINUTES`            | 15    |                        |
| `CUSTOMER_CANCEL_CUTOFF_MINUTES`   | TBD   | Set by GHA-20          |

These are engine configuration values. They can move to per-branch settings once operators ask for it.
