import {
  AVAILABILITY_BLOCK_REASONS,
  BOOKING_STATUSES,
  VEHICLE_TYPES,
  type AvailabilityQuery,
  type CancelBookingRequest,
  type ChangeBookingStatusRequest,
  type CreateAvailabilityBlockRequest,
  type CreateBookingRequest,
  type CreateWalkInBookingRequest,
} from '@ghassalny/contracts';
import { z } from 'zod';
import { parseLocalDate } from '../availability/zoned-time';
import { normalizeEgyptianMobile } from '../auth/phone';

const id = z.uuid('Must be a valid ID.');

/** ISO 8601 with an explicit offset or Z, so the instant is never ambiguous. */
const instant = z.iso
  .datetime({ offset: true, message: 'Use an ISO 8601 date and time, e.g. 2027-01-13T09:30:00Z.' })
  .transform((value) => new Date(value));

const localDate = z.string().transform((value, context) => {
  const date = parseLocalDate(value);
  if (!date) {
    context.addIssue({ code: 'custom', message: 'Use a calendar date, e.g. 2027-01-13.' });
    return z.NEVER;
  }
  return date;
});

const egyptianMobile = z.string().transform((value, context) => {
  const normalized = normalizeEgyptianMobile(value);
  if (!normalized) {
    context.addIssue({ code: 'custom', message: 'Enter an Egyptian mobile number (01XXXXXXXXX).' });
    return z.NEVER;
  }
  return normalized;
});

const notes = z.string().trim().max(500, 'Use at most 500 characters.').optional();
const reason = z.string().trim().max(300, 'Use at most 300 characters.').optional();

export const branchParamsSchema = z.object({ branchId: id });
export const bookingParamsSchema = z.object({ bookingId: id });
export const branchBookingParamsSchema = z.object({ branchId: id, bookingId: id });

export const availabilityQuerySchema = z.object({ serviceId: id, date: localDate });

export const createBookingSchema = z.object({
  branchId: id,
  serviceId: id,
  vehicleId: id,
  startsAt: instant,
  notes,
});

export const cancelBookingSchema = z.object({ reason });

export const createWalkInSchema = z.object({
  serviceId: id,
  startsAt: instant.optional(),
  contactName: z.string().trim().min(2, "Enter the customer's name.").max(100),
  contactPhone: egyptianMobile.optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
  vehiclePlate: z.string().trim().min(1).max(20).optional(),
  notes,
});

export const changeStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
  reason,
});

export const createBlockSchema = z
  .object({
    startsAt: instant,
    endsAt: instant,
    reason: z.enum(AVAILABILITY_BLOCK_REASONS),
    note: notes,
  })
  .refine((block) => block.endsAt > block.startsAt, {
    path: ['endsAt'],
    message: 'The end must be after the start.',
  });

// Compile-time checks: the shared request contracts are accepted by these schemas.
type Accepts<TSchema extends z.ZodType, TContract> = [TContract] extends [z.input<TSchema>]
  ? true
  : false;
type Assert<T extends true> = T;
export type ContractChecks = [
  Assert<Accepts<typeof availabilityQuerySchema, AvailabilityQuery>>,
  Assert<Accepts<typeof createBookingSchema, CreateBookingRequest>>,
  Assert<Accepts<typeof cancelBookingSchema, CancelBookingRequest>>,
  Assert<Accepts<typeof createWalkInSchema, CreateWalkInBookingRequest>>,
  Assert<Accepts<typeof changeStatusSchema, ChangeBookingStatusRequest>>,
  Assert<Accepts<typeof createBlockSchema, CreateAvailabilityBlockRequest>>,
];
