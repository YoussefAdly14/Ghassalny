import type { BookingDetails } from './bookings';
import { createEnumGuard, type EnumValue } from './enum';

// Availability contracts for GET /branches/:branchId/availability and
// POST /branches/:branchId/availability-blocks. See docs/architecture/booking-engine-invariants.md.

/** Why a branch is not taking bookings for a period. */
export const AvailabilityBlockReason = {
  CLOSURE: 'CLOSURE',
  MAINTENANCE: 'MAINTENANCE',
  BREAK: 'BREAK',
  OTHER: 'OTHER',
} as const;
export type AvailabilityBlockReason = EnumValue<typeof AvailabilityBlockReason>;

export const AVAILABILITY_BLOCK_REASONS = Object.values(AvailabilityBlockReason);
export const isAvailabilityBlockReason = createEnumGuard(AvailabilityBlockReason);

/** Query string of GET /branches/:branchId/availability. */
export type AvailabilityQuery = {
  serviceId: string;
  /** Branch-local calendar date, "YYYY-MM-DD". */
  date: string;
};

export type AvailableSlot = {
  /** ISO 8601 instant (UTC). Format it in the branch `timeZone` for display. */
  startsAt: string;
  endsAt: string;
};

export type AvailabilityResponse = {
  branchId: string;
  serviceId: string;
  date: string;
  /** IANA zone of the branch, e.g. "Africa/Cairo". */
  timeZone: string;
  durationMinutes: number;
  /** Price in the currency's minor unit (piasters for EGP). */
  priceMinorUnits: number;
  currency: string;
  /** Bookable start times in order. Empty when the branch is closed or fully booked. */
  slots: AvailableSlot[];
};

export type CreateAvailabilityBlockRequest = {
  /** ISO 8601 instant with offset. */
  startsAt: string;
  endsAt: string;
  reason: AvailabilityBlockReason;
  note?: string;
};

export type AvailabilityBlockDetails = {
  id: string;
  branchId: string;
  startsAt: string;
  endsAt: string;
  reason: AvailabilityBlockReason;
  note: string | null;
  createdByUserId: string | null;
};

export type CreateAvailabilityBlockResponse = {
  block: AvailabilityBlockDetails;
  /**
   * Existing bookings that overlap the block. A block never cancels them (invariant 6.3): staff
   * contact these customers and cancel explicitly.
   */
  conflictingBookings: BookingDetails[];
};
