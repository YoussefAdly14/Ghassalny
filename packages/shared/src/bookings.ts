import { createEnumGuard, type EnumValue } from './enum';

/**
 * Booking lifecycle states. Customers pay on-site in the MVP, so a booking is CONFIRMED as soon
 * as it is created. Allowed transitions belong to the booking engine (GHA-48, GHA-56).
 */
export const BookingStatus = {
  CONFIRMED: 'CONFIRMED',
  ARRIVED: 'ARRIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type BookingStatus = EnumValue<typeof BookingStatus>;

export const BOOKING_STATUSES = Object.values(BookingStatus);
export const isBookingStatus = createEnumGuard(BookingStatus);

/** Where a booking originated. Walk-ins are created by a worker for a customer without the app. */
export const BookingSource = {
  CUSTOMER_APP: 'CUSTOMER_APP',
  WALK_IN: 'WALK_IN',
} as const;
export type BookingSource = EnumValue<typeof BookingSource>;

export const BOOKING_SOURCES = Object.values(BookingSource);
export const isBookingSource = createEnumGuard(BookingSource);
