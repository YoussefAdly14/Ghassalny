import type { DayOfWeek } from '@ghassalny/database';
import { BookingStatus } from '@ghassalny/contracts';
import { dayOfWeekOf, localDateOf, zonedTimeToUtc, type LocalDate } from './zoned-time';

// Pure slot generation for one branch, service, and local date.
// Implements invariants 1-3 of docs/architecture/booking-engine-invariants.md. No I/O here: the
// caller loads hours, blocks, and bookings, so the rules are easy to test exhaustively.

export type WorkingInterval = {
  dayOfWeek: DayOfWeek;
  opensAtMinute: number;
  closesAtMinute: number;
};

/** A half-open time range [startsAt, endsAt). */
export type TimeRange = { startsAt: Date; endsAt: Date };

export type ExistingBooking = TimeRange & {
  bayNumber: number;
  status: BookingStatus;
};

export type SlotQuery = {
  /** The branch-local calendar date to generate slots for. */
  date: LocalDate;
  timeZone: string;
  workingHours: readonly WorkingInterval[];
  slotIntervalMinutes: number;
  durationMinutes: number;
  washBays: number;
  blocks: readonly TimeRange[];
  bookings: readonly ExistingBooking[];
  now: Date;
  /** Earliest start, relative to `now`. */
  minLeadMinutes: number;
  /** Latest start, relative to `now`. */
  horizonDays: number;
};

export type Slot = TimeRange & {
  /** Free bay numbers for this slot, lowest first. Never empty. */
  freeBays: number[];
};

/** Statuses that occupy a bay (invariant 2.1). */
export const CAPACITY_HOLDING_STATUSES: ReadonlySet<BookingStatus> = new Set([
  BookingStatus.CONFIRMED,
  BookingStatus.ARRIVED,
  BookingStatus.IN_PROGRESS,
]);

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * Bays (1..washBays) not used by any capacity-holding booking overlapping `range`, lowest first.
 * Booking creation assigns the first one (invariant 2.5).
 */
export function freeBaysFor(
  range: TimeRange,
  washBays: number,
  bookings: readonly ExistingBooking[],
): number[] {
  const taken = new Set(
    bookings
      .filter(
        (booking) => CAPACITY_HOLDING_STATUSES.has(booking.status) && overlaps(booking, range),
      )
      .map((booking) => booking.bayNumber),
  );
  const free: number[] = [];
  for (let bay = 1; bay <= washBays; bay += 1) if (!taken.has(bay)) free.push(bay);
  return free;
}

/**
 * Bookable slots for a customer on `query.date`, in start order. A slot is returned only if it:
 * - fits entirely inside one working-hours interval for that weekday (3.1),
 * - starts on the branch slot grid measured from that interval's opening time (3.4),
 * - does not overlap any availability block, including partial overlaps (3.2),
 * - starts within the lead-time and horizon window (3.5),
 * - has at least one free bay (2.3).
 */
export function generateSlots(query: SlotQuery): Slot[] {
  const weekday = dayOfWeekOf(query.date);
  const earliestStart = query.now.getTime() + query.minLeadMinutes * 60_000;
  const latestStart = query.now.getTime() + query.horizonDays * 24 * 60 * 60_000;
  const step = Math.max(1, query.slotIntervalMinutes);

  const intervals = query.workingHours
    .filter((interval) => interval.dayOfWeek === weekday)
    .toSorted((a, b) => a.opensAtMinute - b.opensAtMinute);

  const slots: Slot[] = [];
  for (const interval of intervals) {
    for (
      let startMinute = interval.opensAtMinute;
      startMinute + query.durationMinutes <= interval.closesAtMinute;
      startMinute += step
    ) {
      const range: TimeRange = {
        startsAt: zonedTimeToUtc(query.date, startMinute, query.timeZone),
        endsAt: zonedTimeToUtc(query.date, startMinute + query.durationMinutes, query.timeZone),
      };
      const start = range.startsAt.getTime();
      if (start < earliestStart || start > latestStart) continue;
      if (query.blocks.some((block) => overlaps(block, range))) continue;

      const freeBays = freeBaysFor(range, query.washBays, query.bookings);
      if (freeBays.length > 0) slots.push({ ...range, freeBays });
    }
  }
  return slots;
}

export type WalkInQuery = {
  startsAt: Date;
  timeZone: string;
  workingHours: readonly WorkingInterval[];
  durationMinutes: number;
  washBays: number;
  blocks: readonly TimeRange[];
  bookings: readonly ExistingBooking[];
};

export type WalkInCheck =
  | { ok: true; slot: Slot }
  | { ok: false; reason: 'OUTSIDE_WORKING_HOURS' | 'BLOCKED' | 'NO_FREE_BAY' };

/**
 * Whether a walk-in can start at `query.startsAt` (invariant 3.6). Walk-ins skip the slot grid and
 * the lead-time window, but must still fit inside one working-hours interval of the branch-local
 * day (3.1), avoid availability blocks (3.2), and find a free bay (2.3).
 */
export function checkWalkInStart(query: WalkInQuery): WalkInCheck {
  const range: TimeRange = {
    startsAt: query.startsAt,
    endsAt: new Date(query.startsAt.getTime() + query.durationMinutes * 60_000),
  };
  const date = localDateOf(query.startsAt, query.timeZone);
  const weekday = dayOfWeekOf(date);
  const insideHours = query.workingHours.some(
    (interval) =>
      interval.dayOfWeek === weekday &&
      zonedTimeToUtc(date, interval.opensAtMinute, query.timeZone) <= range.startsAt &&
      range.endsAt <= zonedTimeToUtc(date, interval.closesAtMinute, query.timeZone),
  );
  if (!insideHours) return { ok: false, reason: 'OUTSIDE_WORKING_HOURS' };
  if (query.blocks.some((block) => overlaps(block, range))) return { ok: false, reason: 'BLOCKED' };

  const freeBays = freeBaysFor(range, query.washBays, query.bookings);
  if (freeBays.length === 0) return { ok: false, reason: 'NO_FREE_BAY' };
  return { ok: true, slot: { ...range, freeBays } };
}
