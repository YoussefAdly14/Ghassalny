import type {
  AvailabilityBlockReason,
  BookingSource,
  BookingStatus,
  VehicleType,
} from '@ghassalny/contracts';
import type { DatabaseClient, Prisma } from '@ghassalny/database';
import {
  CAPACITY_HOLDING_STATUSES,
  type ExistingBooking,
  type TimeRange,
  type WorkingInterval,
} from '../availability/slot-generation';

export type BranchRecord = {
  id: string;
  organizationId: string;
  name: string;
  nameAr: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  organizationStatus: 'ACTIVE' | 'SUSPENDED';
  timeZone: string;
  washBays: number;
  slotIntervalMinutes: number;
  workingHours: WorkingInterval[];
};

/** A service as offered at a branch, with that branch's price and duration. */
export type OfferingRecord = {
  serviceId: string;
  serviceName: string;
  serviceActive: boolean;
  offeringActive: boolean;
  priceMinorUnits: number;
  currency: string;
  durationMinutes: number;
};

export type VehicleRecord = {
  id: string;
  vehicleType: VehicleType;
  plateNumber: string;
};

export type BookingRecord = {
  id: string;
  reference: string;
  organizationId: string;
  branch: { id: string; name: string; nameAr: string | null; timeZone: string };
  serviceId: string;
  customerId: string | null;
  vehicleId: string | null;
  source: BookingSource;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  bayNumber: number;
  serviceName: string;
  durationMinutes: number;
  priceMinorUnits: number;
  currency: string;
  contactName: string;
  contactPhone: string | null;
  vehicleType: VehicleType | null;
  vehiclePlate: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
  cancellationReason: string | null;
};

export type NewBooking = Omit<
  BookingRecord,
  'id' | 'branch' | 'status' | 'createdAt' | 'cancelledAt' | 'cancellationReason'
> & { branchId: string };

export type StatusChange = {
  from: BookingStatus;
  to: BookingStatus;
  changedByUserId: string;
  reason: string | null;
  at: Date;
};

export type BlockRecord = {
  id: string;
  branchId: string;
  startsAt: Date;
  endsAt: Date;
  reason: AvailabilityBlockReason;
  note: string | null;
  createdByUserId: string | null;
};

export type NewBlock = Omit<BlockRecord, 'id'> & { organizationId: string };

/** A booking ID is only looked up together with its branch or its customer (invariant 7.3). */
export type BookingLookup = { bookingId: string } & ({ branchId: string } | { customerId: string });

/**
 * Thrown by `insertBooking` when the database rejects the row. `BAY_TAKEN` means a concurrent
 * booking won the bay (exclusion constraint, SQLSTATE 23P01, or a deadlock between inserts); the
 * caller retries once with a fresh bay choice (invariant 8.3). `REFERENCE_TAKEN` is a booking
 * reference collision.
 */
export class BookingWriteConflictError extends Error {
  override readonly name = 'BookingWriteConflictError';

  constructor(readonly kind: 'BAY_TAKEN' | 'REFERENCE_TAKEN') {
    super(`Booking insert conflict: ${kind}`);
  }
}

/** Reads the booking engine needs to decide whether a time is bookable. */
export interface BookingReader {
  findBranch(branchId: string): Promise<BranchRecord | null>;
  findOffering(branchId: string, serviceId: string): Promise<OfferingRecord | null>;
  /** Availability blocks at the branch that overlap `range`. */
  listBlocks(branchId: string, range: TimeRange): Promise<TimeRange[]>;
  /** Capacity-holding bookings at the branch that overlap `range`. */
  listHoldingBookings(branchId: string, range: TimeRange): Promise<ExistingBooking[]>;
}

/** Operations available inside a booking-creation transaction. */
export interface BookingStore extends BookingReader {
  /**
   * Serializes booking creation per customer until the transaction ends, so the customer limits
   * (invariant 4) cannot be raced. Take it before `lockBranch`; a fixed order prevents deadlocks.
   */
  lockCustomer(customerId: string): Promise<void>;
  /**
   * Serializes booking creation per branch until the transaction ends (invariant 8.2), so each
   * transaction sees every earlier booking and picks a genuinely free bay. Without it, concurrent
   * inserts on one bay can deadlock inside the exclusion constraint check.
   */
  lockBranch(branchId: string): Promise<void>;
  /** The customer's capacity-holding bookings that end after `after`, at any branch. */
  listCustomerHoldingBookings(customerId: string, after: Date): Promise<TimeRange[]>;
  /**
   * Inserts the booking and its creation history row. Throws BookingWriteConflictError when the
   * bay is taken or the reference collides; the transaction is then unusable.
   */
  insertBooking(booking: NewBooking): Promise<BookingRecord>;
}

/** Persistence boundary for the booking engine. */
export interface BookingRepository extends BookingReader {
  /** Runs `work` in one database transaction (invariant 8.1). */
  transaction<T>(work: (store: BookingStore) => Promise<T>): Promise<T>;
  /** A vehicle owned by `ownerId` that is not deleted. */
  findVehicle(vehicleId: string, ownerId: string): Promise<VehicleRecord | null>;
  findContact(userId: string): Promise<{ fullName: string; phone: string | null } | null>;
  findBooking(lookup: BookingLookup): Promise<BookingRecord | null>;
  /**
   * Applies the change only if the booking is still in `change.from` (invariant 8.4) and writes
   * the history row in the same transaction. Returns null if another change won.
   */
  changeStatus(bookingId: string, change: StatusChange): Promise<BookingRecord | null>;
  createBlock(block: NewBlock): Promise<BlockRecord>;
  /** Capacity-holding bookings at the branch overlapping `range`, in start order. */
  listHoldingBookingDetails(branchId: string, range: TimeRange): Promise<BookingRecord[]>;
}

const HOLDING_STATUSES = [...CAPACITY_HOLDING_STATUSES];

const bookingSelect = {
  id: true,
  reference: true,
  organizationId: true,
  branch: { select: { id: true, name: true, nameAr: true, timeZone: true } },
  serviceId: true,
  customerId: true,
  vehicleId: true,
  source: true,
  status: true,
  startsAt: true,
  endsAt: true,
  bayNumber: true,
  serviceName: true,
  durationMinutes: true,
  priceMinorUnits: true,
  currency: true,
  contactName: true,
  contactPhone: true,
  vehicleType: true,
  vehiclePlate: true,
  notes: true,
  createdByUserId: true,
  createdAt: true,
  cancelledAt: true,
  cancellationReason: true,
} as const satisfies Prisma.BookingSelect;

const blockSelect = {
  id: true,
  branchId: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  note: true,
  createdByUserId: true,
} as const satisfies Prisma.AvailabilityBlockSelect;

const overlapping = (range: TimeRange) => ({
  startsAt: { lt: range.endsAt },
  endsAt: { gt: range.startsAt },
});

/** Queries shared by the repository and its transaction-scoped store. */
class PrismaBookingReader implements BookingReader {
  constructor(protected readonly db: Prisma.TransactionClient) {}

  async findBranch(branchId: string): Promise<BranchRecord | null> {
    const branch = await this.db.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        nameAr: true,
        status: true,
        timeZone: true,
        washBays: true,
        slotIntervalMinutes: true,
        organization: { select: { status: true } },
        workingHours: { select: { dayOfWeek: true, opensAtMinute: true, closesAtMinute: true } },
      },
    });
    if (!branch) return null;
    const { organization, ...rest } = branch;
    return { ...rest, organizationStatus: organization.status };
  }

  async findOffering(branchId: string, serviceId: string): Promise<OfferingRecord | null> {
    const offering = await this.db.branchService.findUnique({
      where: { branchId_serviceId: { branchId, serviceId } },
      select: {
        priceMinorUnits: true,
        currency: true,
        durationMinutes: true,
        isActive: true,
        service: { select: { id: true, name: true, isActive: true } },
      },
    });
    if (!offering) return null;
    return {
      serviceId: offering.service.id,
      serviceName: offering.service.name,
      serviceActive: offering.service.isActive,
      offeringActive: offering.isActive,
      priceMinorUnits: offering.priceMinorUnits,
      currency: offering.currency,
      durationMinutes: offering.durationMinutes,
    };
  }

  listBlocks(branchId: string, range: TimeRange) {
    return this.db.availabilityBlock.findMany({
      where: { branchId, ...overlapping(range) },
      select: { startsAt: true, endsAt: true },
    });
  }

  listHoldingBookings(branchId: string, range: TimeRange) {
    return this.db.booking.findMany({
      where: { branchId, status: { in: HOLDING_STATUSES }, ...overlapping(range) },
      select: { startsAt: true, endsAt: true, bayNumber: true, status: true },
    });
  }
}

class PrismaBookingStore extends PrismaBookingReader implements BookingStore {
  // Transaction-scoped advisory locks, released automatically on commit or rollback. The key
  // prefix keeps customer and branch locks apart.
  async lockCustomer(customerId: string) {
    await this.advisoryLock(`customer:${customerId}`);
  }

  async lockBranch(branchId: string) {
    await this.advisoryLock(`branch:${branchId}`);
  }

  private async advisoryLock(key: string) {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  listCustomerHoldingBookings(customerId: string, after: Date) {
    return this.db.booking.findMany({
      where: { customerId, status: { in: HOLDING_STATUSES }, endsAt: { gt: after } },
      select: { startsAt: true, endsAt: true },
    });
  }

  async insertBooking(booking: NewBooking): Promise<BookingRecord> {
    try {
      return await this.db.booking.create({
        data: {
          ...booking,
          status: 'CONFIRMED',
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: 'CONFIRMED',
              changedByUserId: booking.createdByUserId,
            },
          },
        },
        select: bookingSelect,
      });
    } catch (error) {
      const text = errorText(error);
      // P2034 is Prisma's code for a deadlock or write conflict (SQLSTATE 40P01 or 40001).
      if (/23P01|40P01|P2034|bookings_no_overlap_per_bay/.test(text)) {
        throw new BookingWriteConflictError('BAY_TAKEN');
      }
      if (text.includes('P2002') && text.includes('reference')) {
        throw new BookingWriteConflictError('REFERENCE_TAKEN');
      }
      throw error;
    }
  }
}

export class PrismaBookingRepository extends PrismaBookingReader implements BookingRepository {
  constructor(private readonly client: DatabaseClient) {
    super(client);
  }

  transaction<T>(work: (store: BookingStore) => Promise<T>): Promise<T> {
    return this.client.$transaction((tx) => work(new PrismaBookingStore(tx)));
  }

  findVehicle(vehicleId: string, ownerId: string) {
    return this.client.vehicle.findFirst({
      where: { id: vehicleId, ownerId, deletedAt: null },
      select: { id: true, vehicleType: true, plateNumber: true },
    });
  }

  findContact(userId: string) {
    return this.client.user.findUnique({
      where: { id: userId },
      select: { fullName: true, phone: true },
    });
  }

  findBooking(lookup: BookingLookup) {
    const { bookingId, ...scope } = lookup;
    return this.client.booking.findFirst({
      where: { id: bookingId, ...scope },
      select: bookingSelect,
    });
  }

  changeStatus(bookingId: string, change: StatusChange) {
    return this.client.$transaction(async (tx) => {
      const { count } = await tx.booking.updateMany({
        where: { id: bookingId, status: change.from },
        data: {
          status: change.to,
          ...(change.to === 'CANCELLED'
            ? { cancelledAt: change.at, cancellationReason: change.reason }
            : {}),
        },
      });
      if (count !== 1) return null;
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: change.from,
          toStatus: change.to,
          changedByUserId: change.changedByUserId,
          reason: change.reason,
          createdAt: change.at,
        },
      });
      return tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: bookingSelect });
    });
  }

  createBlock(block: NewBlock) {
    return this.client.availabilityBlock.create({ data: block, select: blockSelect });
  }

  listHoldingBookingDetails(branchId: string, range: TimeRange) {
    return this.client.booking.findMany({
      where: { branchId, status: { in: HOLDING_STATUSES }, ...overlapping(range) },
      select: bookingSelect,
      orderBy: { startsAt: 'asc' },
    });
  }
}

/** Error message, code, and metadata as one string, for matching driver and Prisma errors. */
function errorText(error: unknown): string {
  if (typeof error !== 'object' || error === null) return String(error);
  const parts = [String((error as { message?: unknown }).message ?? '')];
  try {
    parts.push(JSON.stringify(error));
  } catch {
    // Circular structures: the message is enough.
  }
  if ('cause' in error && error.cause) parts.push(errorText(error.cause));
  return parts.join(' ');
}
