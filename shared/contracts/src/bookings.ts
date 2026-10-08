import { createEnumGuard, type EnumValue } from './enum';
import type { VehicleType } from './vehicles';

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

// Booking contracts for POST /bookings, POST /bookings/:bookingId/cancel,
// POST /branches/:branchId/walk-ins, and POST /branches/:branchId/bookings/:bookingId/status.
// Rules are in docs/architecture/booking-engine-invariants.md.

export type CreateBookingRequest = {
  branchId: string;
  serviceId: string;
  vehicleId: string;
  /** ISO 8601 instant of a slot returned by the availability endpoint. */
  startsAt: string;
  notes?: string;
};

export type CancelBookingRequest = {
  reason?: string;
};

/** A booking made by a worker for a customer who arrived without the app. */
export type CreateWalkInBookingRequest = {
  serviceId: string;
  /** ISO 8601 instant. Any minute inside working hours. Defaults to now. */
  startsAt?: string;
  contactName: string;
  /** Egyptian mobile number, local (01XXXXXXXXX) or international (+201XXXXXXXXX). */
  contactPhone?: string;
  vehicleType?: VehicleType;
  vehiclePlate?: string;
  notes?: string;
};

export type ChangeBookingStatusRequest = {
  status: BookingStatus;
  reason?: string;
};

/**
 * A booking as the API returns it. Service name, price, duration, contact, and vehicle fields are
 * snapshots taken when the booking was made, so catalog edits never change existing bookings.
 */
export type BookingDetails = {
  id: string;
  /** Short code shown to customers and workers, e.g. "GH7K3P9Q". */
  reference: string;
  status: BookingStatus;
  source: BookingSource;
  branch: { id: string; name: string; nameAr: string | null; timeZone: string };
  serviceId: string;
  serviceName: string;
  /** ISO 8601 instants (UTC). The booking occupies [startsAt, endsAt). */
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  priceMinorUnits: number;
  currency: string;
  bayNumber: number;
  /** Null for walk-ins without an account. */
  customerId: string | null;
  vehicleId: string | null;
  vehicleType: VehicleType | null;
  vehiclePlate: string | null;
  contactName: string;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
};

export type BookingResponse = {
  booking: BookingDetails;
};
