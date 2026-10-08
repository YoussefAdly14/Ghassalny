import {
  ApiErrorCode,
  BookingSource,
  BookingStatus,
  type AvailabilityBlockDetails,
  type AvailabilityBlockReason,
  type AvailabilityResponse,
  type BookingDetails,
  type CreateAvailabilityBlockResponse,
  type VehicleType,
} from '@ghassalny/contracts';
import { AppError, notFound, validationFailed } from '../../common/errors';
import type { AuthContext } from '../access/auth-context';
import { assertCanOperateBranch } from '../access/tenant-scope';
import {
  BOOKING_HORIZON_DAYS,
  MAX_ACTIVE_BOOKINGS_PER_CUSTOMER,
  MAX_BLOCK_DAYS,
  MIN_LEAD_MINUTES,
  WALK_IN_BACKDATE_MINUTES,
} from '../availability/engine-config';
import {
  checkWalkInStart,
  generateSlots,
  overlaps,
  type TimeRange,
  type WalkInCheck,
} from '../availability/slot-generation';
import {
  formatLocalDate,
  localDateOf,
  zonedTimeToUtc,
  type LocalDate,
} from '../availability/zoned-time';
import { generateBookingReference } from './booking-reference';
import { checkStatusTransition, type StatusActor } from './booking-status';
import {
  BookingWriteConflictError,
  type BlockRecord,
  type BookingReader,
  type BookingRecord,
  type BookingRepository,
  type BookingStore,
  type BranchRecord,
  type OfferingRecord,
} from './bookings.repository';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Invariant 8.3: one retry with a fresh bay choice, then SLOT_UNAVAILABLE. */
const MAX_INSERT_ATTEMPTS = 2;

const slotUnavailable = (message = 'This time is no longer available. Choose another slot.') =>
  new AppError(409, ApiErrorCode.SLOT_UNAVAILABLE, message);

const WALK_IN_REJECTIONS: Record<Exclude<WalkInCheck, { ok: true }>['reason'], string> = {
  OUTSIDE_WORKING_HOURS:
    'The branch is closed at that time, or the service would run past closing.',
  BLOCKED: 'That time is blocked for this branch.',
  NO_FREE_BAY: 'Every bay is booked at that time.',
};

export type CustomerBookingInput = {
  branchId: string;
  serviceId: string;
  vehicleId: string;
  startsAt: Date;
  notes?: string | undefined;
};

export type WalkInBookingInput = {
  serviceId: string;
  startsAt?: Date | undefined;
  contactName: string;
  contactPhone?: string | undefined;
  vehicleType?: VehicleType | undefined;
  vehiclePlate?: string | undefined;
  notes?: string | undefined;
};

export type BlockInput = {
  startsAt: Date;
  endsAt: Date;
  reason: AvailabilityBlockReason;
  note?: string | undefined;
};

/**
 * The booking engine: availability, booking creation, status changes, and time blocks.
 * Enforces docs/architecture/booking-engine-invariants.md; section numbers are cited inline.
 */
export class BookingService {
  constructor(
    private readonly repository: BookingRepository,
    private readonly now: () => Date,
    private readonly newReference: () => string = generateBookingReference,
  ) {}

  /** Public slot list for one branch, service, and branch-local date (GHA-52). */
  async getAvailability(
    branchId: string,
    input: { serviceId: string; date: LocalDate },
  ): Promise<AvailabilityResponse> {
    const { branch, offering } = await loadBookable(this.repository, branchId, input.serviceId);
    const day: TimeRange = {
      startsAt: zonedTimeToUtc(input.date, 0, branch.timeZone),
      endsAt: zonedTimeToUtc(input.date, 24 * 60, branch.timeZone),
    };
    const [blocks, bookings] = await Promise.all([
      this.repository.listBlocks(branchId, day),
      this.repository.listHoldingBookings(branchId, day),
    ]);
    const slots = generateSlots({
      date: input.date,
      timeZone: branch.timeZone,
      workingHours: branch.workingHours,
      slotIntervalMinutes: branch.slotIntervalMinutes,
      durationMinutes: offering.durationMinutes,
      washBays: branch.washBays,
      blocks,
      bookings,
      now: this.now(),
      minLeadMinutes: MIN_LEAD_MINUTES,
      horizonDays: BOOKING_HORIZON_DAYS,
    });
    return {
      branchId,
      serviceId: offering.serviceId,
      date: formatLocalDate(input.date),
      timeZone: branch.timeZone,
      durationMinutes: offering.durationMinutes,
      priceMinorUnits: offering.priceMinorUnits,
      currency: offering.currency,
      slots: slots.map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
      })),
    };
  }

  /** A signed-in customer books a slot from the availability list (GHA-53). */
  async createCustomerBooking(
    customerId: string,
    input: CustomerBookingInput,
  ): Promise<BookingDetails> {
    const [vehicle, contact] = await Promise.all([
      this.repository.findVehicle(input.vehicleId, customerId),
      this.repository.findContact(customerId),
    ]);
    // 4.3: the vehicle belongs to the customer and is not deleted.
    if (!vehicle) {
      throw validationFailed([{ path: 'vehicleId', message: 'Choose one of your vehicles.' }]);
    }
    if (!contact) throw notFound('User not found.');

    const record = await this.insertWithRetry(async (store) => {
      await store.lockCustomer(customerId);
      await store.lockBranch(input.branchId);
      const { branch, offering } = await loadBookable(store, input.branchId, input.serviceId);
      const now = this.now();
      const range = rangeFor(input.startsAt, offering.durationMinutes);
      const [blocks, bookings] = await loadConflicts(store, branch.id, range);

      // 3.1-3.5 and 2.3: the start must be one of the slots the availability endpoint offers.
      const slot = generateSlots({
        date: localDateOf(input.startsAt, branch.timeZone),
        timeZone: branch.timeZone,
        workingHours: branch.workingHours,
        slotIntervalMinutes: branch.slotIntervalMinutes,
        durationMinutes: offering.durationMinutes,
        washBays: branch.washBays,
        blocks,
        bookings,
        now,
        minLeadMinutes: MIN_LEAD_MINUTES,
        horizonDays: BOOKING_HORIZON_DAYS,
      }).find((candidate) => candidate.startsAt.getTime() === input.startsAt.getTime());
      if (!slot) throw slotUnavailable();

      // 4.1 and 4.2, serialized per customer by the advisory lock above.
      const held = await store.listCustomerHoldingBookings(customerId, now);
      if (held.some((booking) => overlaps(booking, slot))) {
        throw new AppError(
          409,
          ApiErrorCode.BOOKING_OVERLAP,
          'You already have a booking at this time.',
        );
      }
      if (held.length >= MAX_ACTIVE_BOOKINGS_PER_CUSTOMER) {
        throw new AppError(
          409,
          ApiErrorCode.BOOKING_LIMIT_REACHED,
          `You can hold up to ${MAX_ACTIVE_BOOKINGS_PER_CUSTOMER} upcoming bookings. Cancel one to book another.`,
        );
      }

      return store.insertBooking({
        ...snapshot(branch, offering, slot, slot.freeBays[0]!),
        reference: this.newReference(),
        source: BookingSource.CUSTOMER_APP,
        customerId,
        vehicleId: vehicle.id,
        contactName: contact.fullName,
        contactPhone: contact.phone,
        vehicleType: vehicle.vehicleType,
        vehiclePlate: vehicle.plateNumber,
        notes: input.notes ?? null,
        createdByUserId: customerId,
      });
    });
    return toBookingDetails(record);
  }

  /** A worker or admin books a customer who arrived without the app (GHA-55). */
  async createWalkIn(
    auth: AuthContext,
    branchId: string,
    input: WalkInBookingInput,
  ): Promise<BookingDetails> {
    await this.findOperableBranch(auth, branchId);

    const now = this.now();
    const startsAt = floorToMinute(input.startsAt ?? now);
    if (startsAt.getTime() < now.getTime() - WALK_IN_BACKDATE_MINUTES * MINUTE) {
      throw validationFailed([
        {
          path: 'startsAt',
          message: `A walk-in can start at most ${WALK_IN_BACKDATE_MINUTES} minutes ago.`,
        },
      ]);
    }
    if (startsAt.getTime() > now.getTime() + BOOKING_HORIZON_DAYS * DAY) {
      throw validationFailed([
        { path: 'startsAt', message: `Book within the next ${BOOKING_HORIZON_DAYS} days.` },
      ]);
    }

    const record = await this.insertWithRetry(async (store) => {
      await store.lockBranch(branchId);
      const { branch, offering } = await loadBookable(store, branchId, input.serviceId);
      const range = rangeFor(startsAt, offering.durationMinutes);
      const [blocks, bookings] = await loadConflicts(store, branch.id, range);

      // 3.6: any minute inside working hours, still subject to blocks and bay capacity.
      const check = checkWalkInStart({
        startsAt,
        timeZone: branch.timeZone,
        workingHours: branch.workingHours,
        durationMinutes: offering.durationMinutes,
        washBays: branch.washBays,
        blocks,
        bookings,
      });
      if (!check.ok) throw slotUnavailable(WALK_IN_REJECTIONS[check.reason]);

      return store.insertBooking({
        ...snapshot(branch, offering, check.slot, check.slot.freeBays[0]!),
        reference: this.newReference(),
        source: BookingSource.WALK_IN,
        customerId: null,
        vehicleId: null,
        contactName: input.contactName,
        contactPhone: input.contactPhone ?? null,
        vehicleType: input.vehicleType ?? null,
        vehiclePlate: input.vehiclePlate ?? null,
        notes: input.notes ?? null,
        createdByUserId: auth.userId,
      });
    });
    return toBookingDetails(record);
  }

  /** A customer cancels their own upcoming booking (GHA-54, invariant 5.4). */
  async cancelAsCustomer(
    customerId: string,
    bookingId: string,
    reason: string | undefined,
  ): Promise<BookingDetails> {
    const booking = await this.repository.findBooking({ bookingId, customerId });
    if (!booking) throw notFound('Booking not found.');
    return this.applyStatusChange(booking, BookingStatus.CANCELLED, 'CUSTOMER', customerId, reason);
  }

  /** Arrived, in progress, completed, cancelled, and no-show, by branch staff (GHA-56). */
  async changeStatusAsStaff(
    auth: AuthContext,
    branchId: string,
    bookingId: string,
    input: { status: BookingStatus; reason?: string | undefined },
  ): Promise<BookingDetails> {
    await this.findOperableBranch(auth, branchId);
    const booking = await this.repository.findBooking({ bookingId, branchId });
    if (!booking) throw notFound('Booking not found.');
    return this.applyStatusChange(booking, input.status, 'STAFF', auth.userId, input.reason);
  }

  /** Blocks time at a branch so it is no longer offered (GHA-57). */
  async createBlock(
    auth: AuthContext,
    branchId: string,
    input: BlockInput,
  ): Promise<CreateAvailabilityBlockResponse> {
    const branch = await this.findOperableBranch(auth, branchId);
    if (input.endsAt.getTime() <= this.now().getTime()) {
      throw validationFailed([{ path: 'endsAt', message: 'The block must end in the future.' }]);
    }
    if (input.endsAt.getTime() - input.startsAt.getTime() > MAX_BLOCK_DAYS * DAY) {
      throw validationFailed([
        { path: 'endsAt', message: `A block can last at most ${MAX_BLOCK_DAYS} days.` },
      ]);
    }

    const block = await this.repository.createBlock({
      organizationId: branch.organizationId,
      branchId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: input.reason,
      note: input.note ?? null,
      createdByUserId: auth.userId,
    });
    // 6.3: a block never cancels bookings. Report them so staff can follow up.
    const conflicts = await this.repository.listHoldingBookingDetails(branchId, block);
    return {
      block: toBlockDetails(block),
      conflictingBookings: conflicts.map(toBookingDetails),
    };
  }

  /** 404 for unknown branches, 403 unless the user may operate it (invariant 5.5). */
  private async findOperableBranch(auth: AuthContext, branchId: string): Promise<BranchRecord> {
    const branch = await this.repository.findBranch(branchId);
    if (!branch) throw notFound('Branch not found.');
    assertCanOperateBranch(auth, { branchId, organizationId: branch.organizationId });
    return branch;
  }

  private async applyStatusChange(
    booking: BookingRecord,
    to: BookingStatus,
    actor: StatusActor,
    userId: string,
    reason: string | undefined,
  ): Promise<BookingDetails> {
    const now = this.now();
    const check = checkStatusTransition({
      from: booking.status,
      to,
      actor,
      startsAt: booking.startsAt,
      now,
    });
    if (!check.ok) throw new AppError(409, ApiErrorCode[check.code], check.message);

    const updated = await this.repository.changeStatus(booking.id, {
      from: booking.status,
      to,
      changedByUserId: userId,
      reason: reason ?? null,
      at: now,
    });
    if (!updated) {
      throw new AppError(
        409,
        ApiErrorCode.CONFLICT,
        'This booking was just updated by someone else. Refresh and try again.',
      );
    }
    return toBookingDetails(updated);
  }

  /** Runs a booking-creation transaction, retrying once if a concurrent booking took the bay. */
  private async insertWithRetry(work: (store: BookingStore) => Promise<BookingRecord>) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.repository.transaction(work);
      } catch (error) {
        if (!(error instanceof BookingWriteConflictError)) throw error;
        if (attempt < MAX_INSERT_ATTEMPTS) continue;
        if (error.kind === 'BAY_TAKEN') throw slotUnavailable();
        throw error;
      }
    }
  }
}

/** 3.3: the branch, its organization, the service, and the branch offering are all active. */
async function loadBookable(reader: BookingReader, branchId: string, serviceId: string) {
  const branch = await reader.findBranch(branchId);
  if (!branch || branch.status !== 'ACTIVE' || branch.organizationStatus !== 'ACTIVE') {
    throw notFound('Branch not found.');
  }
  const offering = await reader.findOffering(branchId, serviceId);
  if (!offering || !offering.serviceActive || !offering.offeringActive) {
    throw notFound('This service is not offered at this branch.');
  }
  return { branch, offering };
}

function loadConflicts(store: BookingStore, branchId: string, range: TimeRange) {
  return Promise.all([
    store.listBlocks(branchId, range),
    store.listHoldingBookings(branchId, range),
  ]);
}

/** 1.5 and section 6: interval, bay, and catalog snapshot copied onto the booking. */
function snapshot(branch: BranchRecord, offering: OfferingRecord, range: TimeRange, bay: number) {
  return {
    organizationId: branch.organizationId,
    branchId: branch.id,
    serviceId: offering.serviceId,
    startsAt: range.startsAt,
    endsAt: range.endsAt,
    bayNumber: bay,
    serviceName: offering.serviceName,
    durationMinutes: offering.durationMinutes,
    priceMinorUnits: offering.priceMinorUnits,
    currency: offering.currency,
  };
}

function rangeFor(startsAt: Date, durationMinutes: number): TimeRange {
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * MINUTE) };
}

function floorToMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / MINUTE) * MINUTE);
}

export function toBookingDetails(record: BookingRecord): BookingDetails {
  return {
    id: record.id,
    reference: record.reference,
    status: record.status,
    source: record.source,
    branch: record.branch,
    serviceId: record.serviceId,
    serviceName: record.serviceName,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    durationMinutes: record.durationMinutes,
    priceMinorUnits: record.priceMinorUnits,
    currency: record.currency,
    bayNumber: record.bayNumber,
    customerId: record.customerId,
    vehicleId: record.vehicleId,
    vehicleType: record.vehicleType,
    vehiclePlate: record.vehiclePlate,
    contactName: record.contactName,
    contactPhone: record.contactPhone,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    cancellationReason: record.cancellationReason,
  };
}

function toBlockDetails(block: BlockRecord): AvailabilityBlockDetails {
  return {
    id: block.id,
    branchId: block.branchId,
    startsAt: block.startsAt.toISOString(),
    endsAt: block.endsAt.toISOString(),
    reason: block.reason,
    note: block.note,
    createdByUserId: block.createdByUserId,
  };
}
