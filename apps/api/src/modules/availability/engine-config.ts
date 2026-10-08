// Booking engine defaults from docs/architecture/booking-engine-invariants.md.

/** Customer bookings must start at least this far in the future. */
export const MIN_LEAD_MINUTES = 30;

/** Customers can book this many days ahead. */
export const BOOKING_HORIZON_DAYS = 14;

export const MAX_ACTIVE_BOOKINGS_PER_CUSTOMER = 3;

export const NO_SHOW_GRACE_MINUTES = 15;
