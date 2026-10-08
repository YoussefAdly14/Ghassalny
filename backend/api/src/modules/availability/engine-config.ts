// Booking engine defaults from docs/architecture/booking-engine-invariants.md.

/** Customer bookings must start at least this far in the future. */
export const MIN_LEAD_MINUTES = 30;

/** Customers can book this many days ahead. */
export const BOOKING_HORIZON_DAYS = 14;

export const MAX_ACTIVE_BOOKINGS_PER_CUSTOMER = 3;

export const NO_SHOW_GRACE_MINUTES = 15;

/**
 * Customers may cancel in the app until 5 hours before the start time (invariant 5.4). A booking
 * made less than 5 hours ahead cannot be cancelled in the app at all; the customer calls the
 * branch, and staff can still cancel it.
 */
export const CUSTOMER_CANCEL_CUTOFF_MINUTES = 5 * 60;

/** How far in the past a walk-in may start, to absorb clock skew and form-filling time. */
export const WALK_IN_BACKDATE_MINUTES = 15;

/** Longest single availability block. Longer closures are entered as several blocks. */
export const MAX_BLOCK_DAYS = 31;
