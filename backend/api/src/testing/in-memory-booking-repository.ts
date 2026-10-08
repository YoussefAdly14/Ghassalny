import { randomUUID } from 'node:crypto';
import type { BookingStatus } from '@ghassalny/contracts';
import {
  CAPACITY_HOLDING_STATUSES,
  overlaps,
  type TimeRange,
} from '../modules/availability/slot-generation';
import {
  BookingWriteConflictError,
  type BlockRecord,
  type BookingLookup,
  type BookingRecord,
  type BookingRepository,
  type BookingStore,
  type BranchRecord,
  type NewBlock,
  type NewBooking,
  type OfferingRecord,
  type StatusChange,
  type VehicleRecord,
} from '../modules/bookings/bookings.repository';
import type { InMemoryAuthRepository } from './in-memory-auth-repository';

type StoredOffering = OfferingRecord & { branchId: string };
type StoredVehicle = VehicleRecord & { ownerId: string; deleted: boolean };
type StoredBlock = BlockRecord & { organizationId: string };

export type HistoryRow = {
  bookingId: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  changedByUserId: string | null;
  reason: string | null;
};

/**
 * Test double for BookingRepository. Mirrors the database rules the engine relies on: the
 * per-bay exclusion constraint, the unique booking reference, and optimistic status updates.
 * Users (for contact snapshots) come from the shared in-memory auth repository.
 */
export class InMemoryBookingRepository implements BookingRepository, BookingStore {
  readonly branches = new Map<string, BranchRecord>();
  readonly offerings: StoredOffering[] = [];
  readonly vehicles: StoredVehicle[] = [];
  readonly blocks: StoredBlock[] = [];
  readonly bookings: BookingRecord[] = [];
  readonly history: HistoryRow[] = [];
  /** Advisory lock keys taken, in order, e.g. "customer:<id>" then "branch:<id>". */
  readonly locks: string[] = [];
  /** Runs before each insert. Tests use it to let a "concurrent" booking win the race. */
  beforeInsert: (() => void) | null = null;

  constructor(private readonly users: InMemoryAuthRepository) {}

  addBranch(branch: Partial<BranchRecord> = {}): BranchRecord {
    const stored: BranchRecord = {
      id: randomUUID(),
      organizationId: randomUUID(),
      name: 'Test Branch',
      nameAr: null,
      status: 'ACTIVE',
      organizationStatus: 'ACTIVE',
      timeZone: 'Africa/Cairo',
      washBays: 1,
      slotIntervalMinutes: 30,
      workingHours: [],
      ...branch,
    };
    this.branches.set(stored.id, stored);
    return stored;
  }

  addOffering(branchId: string, offering: Partial<OfferingRecord> = {}): StoredOffering {
    const stored: StoredOffering = {
      branchId,
      serviceId: randomUUID(),
      serviceName: 'Exterior wash',
      serviceActive: true,
      offeringActive: true,
      priceMinorUnits: 15_000,
      currency: 'EGP',
      durationMinutes: 30,
      ...offering,
    };
    this.offerings.push(stored);
    return stored;
  }

  addVehicle(ownerId: string, vehicle: Partial<StoredVehicle> = {}): StoredVehicle {
    const stored: StoredVehicle = {
      id: randomUUID(),
      ownerId,
      vehicleType: 'SEDAN',
      plateNumber: 'ABC 123',
      deleted: false,
      ...vehicle,
    };
    this.vehicles.push(stored);
    return stored;
  }

  /** Seeds a booking directly, bypassing the engine rules (but not the bay constraint). */
  addBooking(booking: Partial<NewBooking> & Pick<NewBooking, 'branchId' | 'startsAt' | 'endsAt'>) {
    return this.store({
      reference: `GHSEED${String(this.bookings.length).padStart(2, '0')}`,
      organizationId: this.branches.get(booking.branchId)?.organizationId ?? randomUUID(),
      serviceId: randomUUID(),
      customerId: null,
      vehicleId: null,
      source: 'WALK_IN',
      bayNumber: 1,
      serviceName: 'Exterior wash',
      durationMinutes: (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000,
      priceMinorUnits: 15_000,
      currency: 'EGP',
      contactName: 'Seeded Customer',
      contactPhone: null,
      vehicleType: null,
      vehiclePlate: null,
      notes: null,
      createdByUserId: null,
      ...booking,
    });
  }

  // BookingRepository -----------------------------------------------------------------------

  transaction<T>(work: (store: BookingStore) => Promise<T>): Promise<T> {
    // Inserts are the last step of every engine transaction, so there is nothing to roll back.
    return work(this);
  }

  async findBranch(branchId: string) {
    const branch = this.branches.get(branchId);
    return branch ? structuredClone(branch) : null;
  }

  async findOffering(branchId: string, serviceId: string) {
    const offering = this.offerings.find(
      (candidate) => candidate.branchId === branchId && candidate.serviceId === serviceId,
    );
    if (!offering) return null;
    const { branchId: _branchId, ...record } = offering;
    return record;
  }

  async listBlocks(branchId: string, range: TimeRange) {
    return this.blocks
      .filter((block) => block.branchId === branchId && overlaps(block, range))
      .map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));
  }

  async listHoldingBookings(branchId: string, range: TimeRange) {
    return this.holding(branchId, range).map(({ startsAt, endsAt, bayNumber, status }) => ({
      startsAt,
      endsAt,
      bayNumber,
      status,
    }));
  }

  async findVehicle(vehicleId: string, ownerId: string) {
    const vehicle = this.vehicles.find(
      (candidate) =>
        candidate.id === vehicleId && candidate.ownerId === ownerId && !candidate.deleted,
    );
    return vehicle
      ? { id: vehicle.id, vehicleType: vehicle.vehicleType, plateNumber: vehicle.plateNumber }
      : null;
  }

  async findContact(userId: string) {
    const user = await this.users.findUserProfile(userId);
    return user ? { fullName: user.fullName, phone: user.phone } : null;
  }

  async findBooking(lookup: BookingLookup) {
    const booking = this.bookings.find(
      (candidate) =>
        candidate.id === lookup.bookingId &&
        ('branchId' in lookup
          ? candidate.branch.id === lookup.branchId
          : candidate.customerId === lookup.customerId),
    );
    return booking ? structuredClone(booking) : null;
  }

  async changeStatus(bookingId: string, change: StatusChange) {
    const booking = this.bookings.find((candidate) => candidate.id === bookingId);
    if (!booking || booking.status !== change.from) return null;
    booking.status = change.to;
    if (change.to === 'CANCELLED') {
      booking.cancelledAt = change.at;
      booking.cancellationReason = change.reason;
    }
    this.history.push({
      bookingId,
      fromStatus: change.from,
      toStatus: change.to,
      changedByUserId: change.changedByUserId,
      reason: change.reason,
    });
    return structuredClone(booking);
  }

  async createBlock(block: NewBlock) {
    const stored: StoredBlock = { id: randomUUID(), ...block };
    this.blocks.push(stored);
    const { organizationId: _organizationId, ...record } = stored;
    return record;
  }

  async listHoldingBookingDetails(branchId: string, range: TimeRange) {
    return this.holding(branchId, range)
      .toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((booking) => structuredClone(booking));
  }

  // BookingStore ----------------------------------------------------------------------------

  async lockCustomer(customerId: string) {
    this.locks.push(`customer:${customerId}`);
  }

  async lockBranch(branchId: string) {
    this.locks.push(`branch:${branchId}`);
  }

  async listCustomerHoldingBookings(customerId: string, after: Date) {
    return this.bookings
      .filter(
        (booking) =>
          booking.customerId === customerId &&
          CAPACITY_HOLDING_STATUSES.has(booking.status) &&
          booking.endsAt > after,
      )
      .map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));
  }

  async insertBooking(booking: NewBooking) {
    const hook = this.beforeInsert;
    this.beforeInsert = null;
    hook?.();
    return structuredClone(this.store(booking));
  }

  private store(booking: NewBooking): BookingRecord {
    // bookings_no_overlap_per_bay
    if (
      this.holding(booking.branchId, booking).some(
        (existing) => existing.bayNumber === booking.bayNumber,
      )
    ) {
      throw new BookingWriteConflictError('BAY_TAKEN');
    }
    if (this.bookings.some((existing) => existing.reference === booking.reference)) {
      throw new BookingWriteConflictError('REFERENCE_TAKEN');
    }

    const branch = this.branches.get(booking.branchId);
    const { branchId, ...fields } = booking;
    const record: BookingRecord = {
      ...fields,
      id: randomUUID(),
      branch: {
        id: branchId,
        name: branch?.name ?? 'Test Branch',
        nameAr: branch?.nameAr ?? null,
        timeZone: branch?.timeZone ?? 'Africa/Cairo',
      },
      status: 'CONFIRMED',
      createdAt: new Date(),
      cancelledAt: null,
      cancellationReason: null,
    };
    this.bookings.push(record);
    this.history.push({
      bookingId: record.id,
      fromStatus: null,
      toStatus: 'CONFIRMED',
      changedByUserId: booking.createdByUserId,
      reason: null,
    });
    return record;
  }

  private holding(branchId: string, range: TimeRange) {
    return this.bookings.filter(
      (booking) =>
        booking.branch.id === branchId &&
        CAPACITY_HOLDING_STATUSES.has(booking.status) &&
        overlaps(booking, range),
    );
  }
}
