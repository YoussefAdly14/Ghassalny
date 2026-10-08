import type {
  ApiErrorBody,
  AuthSessionResponse,
  AvailabilityResponse,
  BookingResponse,
  CreateAvailabilityBlockResponse,
  RoleAssignment,
} from '@ghassalny/contracts';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BranchAssignment } from '../access/auth-context';
import { zonedTimeToUtc } from '../availability/zoned-time';
import { hashPassword } from '../auth/password';
import type { InMemoryAuthRepository } from '../../testing/in-memory-auth-repository';
import type { InMemoryBookingRepository } from '../../testing/in-memory-booking-repository';
import { createTestApp } from '../../testing/test-app';

// Wednesday 13 January 2027 in Cairo (UTC+2). The clock starts at 07:00 local time.
const DATE = { year: 2027, month: 1, day: 13 };
const CAIRO = 'Africa/Cairo';
const cairo = (hour: number, minute = 0) => zonedTimeToUtc(DATE, hour * 60 + minute, CAIRO);
const iso = (hour: number, minute = 0) => cairo(hour, minute).toISOString();
const PASSWORD = 'super-secret-1';

describe('booking routes', () => {
  let passwordHash: string;
  let app: FastifyInstance;
  let users: InMemoryAuthRepository;
  let repository: InMemoryBookingRepository;
  let clock: Date;
  let branch: { id: string; organizationId: string };
  let serviceId: string;

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    clock = cairo(7);
    ({
      app,
      authRepository: users,
      bookingRepository: repository,
    } = await createTestApp({ now: () => clock }));
    branch = repository.addBranch({
      workingHours: [{ dayOfWeek: 'WEDNESDAY', opensAtMinute: 9 * 60, closesAtMinute: 17 * 60 }],
    });
    serviceId = repository.addOffering(branch.id, { durationMinutes: 30 }).serviceId;
  });
  afterEach(() => app.close());

  let userCount = 0;
  /** Creates a user with the given roles and signs them in. */
  async function signIn(
    roles: RoleAssignment[],
    assignedBranches: BranchAssignment[] = [],
    extra: { fullName?: string; phone?: string } = {},
  ) {
    userCount += 1;
    const email = `user${userCount}@example.com`;
    const user = users.addUser({ email, passwordHash, roles, assignedBranches, ...extra });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: PASSWORD },
    });
    return { id: user.id, token: response.json<AuthSessionResponse>().tokens.accessToken };
  }

  const signInCustomer = () =>
    signIn([{ role: 'CUSTOMER', organizationId: null }], [], {
      fullName: 'Mona Customer',
      phone: '+201001234567',
    });
  const signInWorker = (target: { id: string; organizationId: string } = branch) =>
    signIn(
      [{ role: 'WORKER', organizationId: target.organizationId }],
      [{ branchId: target.id, organizationId: target.organizationId }],
    );

  const post = (url: string, token: string | null, payload: object = {}) =>
    app.inject({
      method: 'POST',
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const availability = (query: Record<string, string> = {}, branchId = branch.id) =>
    app.inject({
      method: 'GET',
      url: `/branches/${branchId}/availability`,
      query: { serviceId, date: '2027-01-13', ...query },
    });

  const slotTimes = async () =>
    (await availability()).json<AvailabilityResponse>().slots.map((slot) => slot.startsAt);

  async function bookAsCustomer(customer: { id: string; token: string }, startsAt = iso(10)) {
    const vehicle = repository.addVehicle(customer.id);
    return post('/bookings', customer.token, {
      branchId: branch.id,
      serviceId,
      vehicleId: vehicle.id,
      startsAt,
    });
  }

  const errorCode = (response: { json: <T>() => T }) => response.json<ApiErrorBody>().error.code;

  describe('GET /branches/:branchId/availability (GHA-52)', () => {
    it('returns the slot list with price, duration, and branch time zone', async () => {
      const response = await availability();
      expect(response.statusCode).toBe(200);
      const body = response.json<AvailabilityResponse>();
      expect(body).toMatchObject({
        branchId: branch.id,
        serviceId,
        date: '2027-01-13',
        timeZone: CAIRO,
        durationMinutes: 30,
        priceMinorUnits: 15_000,
        currency: 'EGP',
      });
      expect(body.slots).toHaveLength(16);
      expect(body.slots[0]).toEqual({ startsAt: iso(9), endsAt: iso(9, 30) });
      expect(body.slots.at(-1)).toEqual({ startsAt: iso(16, 30), endsAt: iso(17) });
    });

    it('needs no account and leaves out booked slots', async () => {
      repository.addBooking({ branchId: branch.id, startsAt: cairo(10), endsAt: cairo(11) });
      const slots = await slotTimes();
      expect(slots).toContain(iso(9, 30));
      expect(slots).not.toContain(iso(10));
      expect(slots).not.toContain(iso(10, 30));
      expect(slots).toContain(iso(11));
    });

    it('rejects malformed input with field errors', async () => {
      const response = await availability({ serviceId: 'nope', date: '2027-02-30' });
      expect(response.statusCode).toBe(400);
      expect(
        response
          .json<ApiErrorBody>()
          .error.details?.map((detail) => detail.path)
          .sort(),
      ).toEqual(['date', 'serviceId']);
      expect((await availability({}, 'not-a-uuid')).statusCode).toBe(400);
    });

    it('returns 404 for unknown, draft, or suspended branches and unoffered services', async () => {
      expect((await availability({}, crypto.randomUUID())).statusCode).toBe(404);
      expect((await availability({ serviceId: crypto.randomUUID() })).statusCode).toBe(404);

      repository.branches.get(branch.id)!.status = 'DRAFT';
      expect((await availability()).statusCode).toBe(404);
      repository.branches.get(branch.id)!.status = 'ACTIVE';
      repository.branches.get(branch.id)!.organizationStatus = 'SUSPENDED';
      expect((await availability()).statusCode).toBe(404);
    });

    it('returns 404 when the service is switched off at the branch', async () => {
      repository.offerings[0]!.offeringActive = false;
      expect(errorCode(await availability())).toBe('NOT_FOUND');
    });
  });

  describe('POST /bookings (GHA-53)', () => {
    it('books a slot with price, contact, and vehicle snapshots', async () => {
      const customer = await signInCustomer();
      const response = await bookAsCustomer(customer);
      expect(response.statusCode).toBe(201);
      const { booking } = response.json<BookingResponse>();
      expect(booking).toMatchObject({
        status: 'CONFIRMED',
        source: 'CUSTOMER_APP',
        branch: { id: branch.id, timeZone: CAIRO },
        serviceId,
        serviceName: 'Exterior wash',
        startsAt: iso(10),
        endsAt: iso(10, 30),
        durationMinutes: 30,
        priceMinorUnits: 15_000,
        currency: 'EGP',
        bayNumber: 1,
        customerId: customer.id,
        contactName: 'Mona Customer',
        contactPhone: '+201001234567',
        vehicleType: 'SEDAN',
        vehiclePlate: 'ABC 123',
        cancelledAt: null,
      });
      expect(booking.reference).toMatch(/^GH[2-9A-HJ-NP-Z]{6}$/);
      expect(repository.history).toEqual([
        {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: 'CONFIRMED',
          changedByUserId: customer.id,
          reason: null,
        },
      ]);
      expect(repository.locks).toEqual([`customer:${customer.id}`, `branch:${branch.id}`]);
      expect(await slotTimes()).not.toContain(iso(10));
    });

    it('requires a signed-in customer', async () => {
      expect((await post('/bookings', null)).statusCode).toBe(401);
      const worker = await signInWorker();
      expect((await post('/bookings', worker.token)).statusCode).toBe(403);
    });

    it.each([
      ['off the slot grid', iso(10, 15)],
      ['inside the minimum lead time', iso(7, 15)],
      ['outside working hours', iso(17)],
    ])('rejects a start %s', async (_case, startsAt) => {
      const response = await bookAsCustomer(await signInCustomer(), startsAt);
      expect(response.statusCode).toBe(409);
      expect(errorCode(response)).toBe('SLOT_UNAVAILABLE');
    });

    it('rejects a slot that is already taken', async () => {
      repository.addBooking({ branchId: branch.id, startsAt: cairo(10), endsAt: cairo(10, 30) });
      expect(errorCode(await bookAsCustomer(await signInCustomer()))).toBe('SLOT_UNAVAILABLE');
    });

    it("rejects someone else's or a deleted vehicle", async () => {
      const customer = await signInCustomer();
      const otherVehicle = repository.addVehicle(crypto.randomUUID());
      const deleted = repository.addVehicle(customer.id, { deleted: true });
      for (const vehicleId of [otherVehicle.id, deleted.id]) {
        const response = await post('/bookings', customer.token, {
          branchId: branch.id,
          serviceId,
          vehicleId,
          startsAt: iso(10),
        });
        expect(response.statusCode).toBe(400);
        expect(response.json<ApiErrorBody>().error.details).toEqual([
          { path: 'vehicleId', message: 'Choose one of your vehicles.' },
        ]);
      }
    });

    it('assigns the lowest free bay', async () => {
      repository.branches.get(branch.id)!.washBays = 3;
      repository.addBooking({ branchId: branch.id, startsAt: cairo(10), endsAt: cairo(10, 30) });
      const response = await bookAsCustomer(await signInCustomer());
      expect(response.json<BookingResponse>().booking.bayNumber).toBe(2);
    });

    it('stops a customer holding two overlapping bookings, even at different branches', async () => {
      const customer = await signInCustomer();
      const other = repository.addBranch({ workingHours: [] });
      repository.addBooking({
        branchId: other.id,
        customerId: customer.id,
        startsAt: cairo(10, 15),
        endsAt: cairo(10, 45),
      });
      const response = await bookAsCustomer(customer);
      expect(response.statusCode).toBe(409);
      expect(errorCode(response)).toBe('BOOKING_OVERLAP');
    });

    it('caps upcoming bookings per customer', async () => {
      repository.branches.get(branch.id)!.washBays = 5;
      const customer = await signInCustomer();
      for (const hour of [10, 11, 12]) {
        expect((await bookAsCustomer(customer, iso(hour))).statusCode).toBe(201);
      }
      const fourth = await bookAsCustomer(customer, iso(13));
      expect(fourth.statusCode).toBe(409);
      expect(errorCode(fourth)).toBe('BOOKING_LIMIT_REACHED');
    });

    it('retries once with a fresh bay when a concurrent booking wins the race', async () => {
      repository.branches.get(branch.id)!.washBays = 2;
      repository.beforeInsert = () =>
        repository.addBooking({ branchId: branch.id, startsAt: cairo(10), endsAt: cairo(10, 30) });
      const response = await bookAsCustomer(await signInCustomer());
      expect(response.statusCode).toBe(201);
      expect(response.json<BookingResponse>().booking.bayNumber).toBe(2);
    });

    it('returns SLOT_UNAVAILABLE when the race leaves no bay', async () => {
      repository.beforeInsert = () =>
        repository.addBooking({ branchId: branch.id, startsAt: cairo(10), endsAt: cairo(10, 30) });
      const response = await bookAsCustomer(await signInCustomer());
      expect(response.statusCode).toBe(409);
      expect(errorCode(response)).toBe('SLOT_UNAVAILABLE');
      expect(repository.bookings).toHaveLength(1);
    });
  });

  describe('POST /bookings/:bookingId/cancel (GHA-54)', () => {
    it('cancels a booking more than 5 hours ahead, records history, and frees the slot', async () => {
      const customer = await signInCustomer();
      const { booking } = (await bookAsCustomer(customer, iso(13))).json<BookingResponse>();

      const response = await post(`/bookings/${booking.id}/cancel`, customer.token, {
        reason: 'Plans changed',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json<BookingResponse>().booking).toMatchObject({
        status: 'CANCELLED',
        cancelledAt: clock.toISOString(),
        cancellationReason: 'Plans changed',
      });
      expect(repository.history.at(-1)).toEqual({
        bookingId: booking.id,
        fromStatus: 'CONFIRMED',
        toStatus: 'CANCELLED',
        changedByUserId: customer.id,
        reason: 'Plans changed',
      });
      expect(await slotTimes()).toContain(iso(13));
    });

    it("hides other customers' bookings", async () => {
      const { booking } = (await bookAsCustomer(await signInCustomer())).json<BookingResponse>();
      const stranger = await signInCustomer();
      expect((await post(`/bookings/${booking.id}/cancel`, stranger.token)).statusCode).toBe(404);
    });

    it('refuses less than 5 hours before the start', async () => {
      // 07:00 now: 12:00 is exactly 5 hours ahead, so the window has just closed.
      const customer = await signInCustomer();
      const { booking } = (await bookAsCustomer(customer, iso(12))).json<BookingResponse>();
      const response = await post(`/bookings/${booking.id}/cancel`, customer.token);
      expect(response.statusCode).toBe(409);
      expect(response.json<ApiErrorBody>().error).toEqual({
        code: 'CANCELLATION_WINDOW_CLOSED',
        message:
          'Bookings can be cancelled in the app up to 5 hours before the start time. Call the branch instead.',
      });
      expect(repository.bookings[0]?.status).toBe('CONFIRMED');
    });

    it('still lets branch staff cancel inside the 5-hour window', async () => {
      const customer = await signInCustomer();
      const { booking } = (await bookAsCustomer(customer, iso(10))).json<BookingResponse>();
      const worker = await signInWorker();
      const response = await post(
        `/branches/${branch.id}/bookings/${booking.id}/status`,
        worker.token,
        {
          status: 'CANCELLED',
          reason: 'Customer called the branch',
        },
      );
      expect(response.statusCode).toBe(200);
      expect(response.json<BookingResponse>().booking.status).toBe('CANCELLED');
    });

    it('refuses to cancel twice', async () => {
      const customer = await signInCustomer();
      const { booking } = (await bookAsCustomer(customer, iso(13))).json<BookingResponse>();
      await post(`/bookings/${booking.id}/cancel`, customer.token);
      const again = await post(`/bookings/${booking.id}/cancel`, customer.token);
      expect(again.statusCode).toBe(409);
      expect(errorCode(again)).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('POST /branches/:branchId/walk-ins (GHA-55)', () => {
    const walkIn = (token: string, payload: object = {}, branchId = branch.id) =>
      post(`/branches/${branchId}/walk-ins`, token, {
        serviceId,
        contactName: 'Walk-in Ahmed',
        contactPhone: '011 2345 6789',
        vehicleType: 'SUV',
        vehiclePlate: 'س ص ع 456',
        ...payload,
      });

    it('books any free minute inside working hours, starting now by default', async () => {
      clock = new Date(cairo(9, 7).getTime() + 42_000);
      const worker = await signInWorker();
      const response = await walkIn(worker.token);
      expect(response.statusCode).toBe(201);
      const { booking } = response.json<BookingResponse>();
      expect(booking).toMatchObject({
        source: 'WALK_IN',
        status: 'CONFIRMED',
        startsAt: iso(9, 7),
        endsAt: iso(9, 37),
        customerId: null,
        vehicleId: null,
        contactName: 'Walk-in Ahmed',
        contactPhone: '+201123456789',
        vehicleType: 'SUV',
        vehiclePlate: 'س ص ع 456',
      });
      expect(repository.bookings[0]?.createdByUserId).toBe(worker.id);
      expect(repository.history[0]?.changedByUserId).toBe(worker.id);
    });

    it('needs only a contact name', async () => {
      const worker = await signInWorker();
      const response = await post(`/branches/${branch.id}/walk-ins`, worker.token, {
        serviceId,
        contactName: 'Hassan',
        startsAt: iso(12, 10),
      });
      expect(response.statusCode).toBe(201);
      expect(response.json<BookingResponse>().booking).toMatchObject({
        contactPhone: null,
        vehicleType: null,
      });
    });

    it('checks availability before booking', async () => {
      const worker = await signInWorker();
      repository.addBooking({ branchId: branch.id, startsAt: cairo(12), endsAt: cairo(12, 30) });

      const busy = await walkIn(worker.token, { startsAt: iso(12, 20) });
      expect(busy.statusCode).toBe(409);
      expect(busy.json<ApiErrorBody>().error).toMatchObject({
        code: 'SLOT_UNAVAILABLE',
        message: 'Every bay is booked at that time.',
      });

      const late = await walkIn(worker.token, { startsAt: iso(16, 45) });
      expect(errorCode(late)).toBe('SLOT_UNAVAILABLE');
    });

    it('rejects a start too far in the past', async () => {
      clock = cairo(12);
      const worker = await signInWorker();
      const response = await walkIn(worker.token, { startsAt: iso(11, 40) });
      expect(response.statusCode).toBe(400);
      expect(response.json<ApiErrorBody>().error.details?.[0]?.path).toBe('startsAt');
    });

    it('is limited to staff who operate the branch', async () => {
      const otherBranch = repository.addBranch();
      const outsider = await signInWorker(otherBranch);
      expect((await walkIn(outsider.token)).statusCode).toBe(403);

      const customer = await signInCustomer();
      expect((await walkIn(customer.token)).statusCode).toBe(403);

      const admin = await signIn([
        { role: 'BUSINESS_ADMIN', organizationId: branch.organizationId },
      ]);
      expect((await walkIn(admin.token, { startsAt: iso(9) })).statusCode).toBe(201);
    });

    it('returns 404 for an unknown branch', async () => {
      const worker = await signInWorker();
      expect((await walkIn(worker.token, {}, crypto.randomUUID())).statusCode).toBe(404);
    });
  });

  describe('POST /branches/:branchId/bookings/:bookingId/status (GHA-56)', () => {
    const setStatus = (token: string, bookingId: string, status: string, branchId = branch.id) =>
      post(`/branches/${branchId}/bookings/${bookingId}/status`, token, { status });

    it('walks a booking through arrived, in progress, and completed', async () => {
      const worker = await signInWorker();
      const { id } = repository.addBooking({
        branchId: branch.id,
        startsAt: cairo(9),
        endsAt: cairo(9, 30),
      });
      for (const status of ['ARRIVED', 'IN_PROGRESS', 'COMPLETED']) {
        const response = await setStatus(worker.token, id, status);
        expect(response.statusCode).toBe(200);
        expect(response.json<BookingResponse>().booking.status).toBe(status);
      }
      expect(repository.history.map((row) => [row.fromStatus, row.toStatus])).toEqual([
        [null, 'CONFIRMED'],
        ['CONFIRMED', 'ARRIVED'],
        ['ARRIVED', 'IN_PROGRESS'],
        ['IN_PROGRESS', 'COMPLETED'],
      ]);
      expect(repository.history.slice(1).every((row) => row.changedByUserId === worker.id)).toBe(
        true,
      );
    });

    it('blocks invalid transitions and early no-shows', async () => {
      clock = cairo(9, 10);
      const worker = await signInWorker();
      const { id } = repository.addBooking({
        branchId: branch.id,
        startsAt: cairo(9),
        endsAt: cairo(9, 30),
      });
      expect(errorCode(await setStatus(worker.token, id, 'COMPLETED'))).toBe(
        'INVALID_STATUS_TRANSITION',
      );
      expect(errorCode(await setStatus(worker.token, id, 'NO_SHOW'))).toBe(
        'INVALID_STATUS_TRANSITION',
      );
      clock = cairo(9, 15);
      expect((await setStatus(worker.token, id, 'NO_SHOW')).statusCode).toBe(200);
    });

    it('only finds bookings through the branch they belong to', async () => {
      const otherBranch = repository.addBranch({ organizationId: branch.organizationId });
      const { id } = repository.addBooking({
        branchId: otherBranch.id,
        startsAt: cairo(9),
        endsAt: cairo(9, 30),
      });
      const worker = await signInWorker();
      expect((await setStatus(worker.token, id, 'ARRIVED')).statusCode).toBe(404);
      expect((await setStatus(worker.token, id, 'ARRIVED', otherBranch.id)).statusCode).toBe(403);
    });

    it('reports a conflict when another change got there first', async () => {
      const worker = await signInWorker();
      const { id } = repository.addBooking({
        branchId: branch.id,
        startsAt: cairo(9),
        endsAt: cairo(9, 30),
      });
      repository.changeStatus = async () => null;
      const response = await setStatus(worker.token, id, 'ARRIVED');
      expect(response.statusCode).toBe(409);
      expect(errorCode(response)).toBe('CONFLICT');
    });

    it('rejects unknown statuses', async () => {
      const worker = await signInWorker();
      expect((await setStatus(worker.token, crypto.randomUUID(), 'WASHED')).statusCode).toBe(400);
    });
  });

  describe('POST /branches/:branchId/availability-blocks (GHA-57)', () => {
    const block = (token: string, payload: object = {}) =>
      post(`/branches/${branch.id}/availability-blocks`, token, {
        startsAt: iso(13),
        endsAt: iso(14),
        reason: 'MAINTENANCE',
        note: 'Pressure washer repair',
        ...payload,
      });

    it('blocks time, removes it from availability, and reports conflicting bookings', async () => {
      const worker = await signInWorker();
      const kept = repository.addBooking({
        branchId: branch.id,
        startsAt: cairo(13, 30),
        endsAt: cairo(14),
      });
      repository.addBooking({ branchId: branch.id, startsAt: cairo(14), endsAt: cairo(14, 30) });

      const response = await block(worker.token);
      expect(response.statusCode).toBe(201);
      const body = response.json<CreateAvailabilityBlockResponse>();
      expect(body.block).toMatchObject({
        branchId: branch.id,
        startsAt: iso(13),
        endsAt: iso(14),
        reason: 'MAINTENANCE',
        note: 'Pressure washer repair',
        createdByUserId: worker.id,
      });
      expect(body.conflictingBookings.map((booking) => booking.id)).toEqual([kept.id]);
      expect(repository.bookings.every((booking) => booking.status === 'CONFIRMED')).toBe(true);

      const slots = await slotTimes();
      expect(slots).toContain(iso(12, 30));
      expect(slots).not.toContain(iso(13));
      expect(slots).not.toContain(iso(13, 30));
    });

    it('validates the time range', async () => {
      const worker = await signInWorker();
      const backwards = await block(worker.token, { startsAt: iso(14), endsAt: iso(13) });
      expect(backwards.statusCode).toBe(400);
      expect(backwards.json<ApiErrorBody>().error.details?.[0]?.path).toBe('endsAt');

      const past = await block(worker.token, { startsAt: iso(5), endsAt: iso(6) });
      expect(past.statusCode).toBe(400);

      const tooLong = await block(worker.token, {
        endsAt: new Date(cairo(13).getTime() + 32 * 24 * 3_600_000).toISOString(),
      });
      expect(tooLong.statusCode).toBe(400);
    });

    it('requires a worker or admin of the branch', async () => {
      const customer = await signInCustomer();
      expect((await block(customer.token)).statusCode).toBe(403);
      const outsider = await signInWorker(repository.addBranch());
      expect((await block(outsider.token)).statusCode).toBe(403);
    });
  });
});
