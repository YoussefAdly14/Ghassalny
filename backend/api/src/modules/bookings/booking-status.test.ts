import {
  BOOKING_STATUSES,
  BookingStatus,
  type BookingStatus as Status,
} from '@ghassalny/contracts';
import { describe, expect, it } from 'vitest';
import {
  checkStatusTransition,
  formatMinutes,
  STAFF_TRANSITIONS,
  type TransitionRequest,
} from './booking-status';

const STARTS_AT = new Date('2027-01-13T08:00:00Z');
const minutes = (value: number) => new Date(STARTS_AT.getTime() + value * 60_000);

function check(overrides: Partial<TransitionRequest>) {
  return checkStatusTransition({
    from: BookingStatus.CONFIRMED,
    to: BookingStatus.ARRIVED,
    actor: 'STAFF',
    startsAt: STARTS_AT,
    now: minutes(30),
    ...overrides,
  });
}

// The table from invariant section 5, written out independently of STAFF_TRANSITIONS.
const ALLOWED: ReadonlyArray<[Status, Status]> = [
  ['CONFIRMED', 'ARRIVED'],
  ['CONFIRMED', 'CANCELLED'],
  ['CONFIRMED', 'NO_SHOW'],
  ['ARRIVED', 'IN_PROGRESS'],
  ['ARRIVED', 'COMPLETED'],
  ['ARRIVED', 'CANCELLED'],
  ['IN_PROGRESS', 'COMPLETED'],
];

describe('checkStatusTransition: staff (GHA-56)', () => {
  const allPairs = BOOKING_STATUSES.flatMap((from) =>
    BOOKING_STATUSES.map((to) => [from, to] as [Status, Status]),
  );

  it.each(allPairs)('%s -> %s follows the invariant table', (from, to) => {
    const allowed = ALLOWED.some(([a, b]) => a === from && b === to);
    expect(check({ from, to }).ok).toBe(allowed);
  });

  it('keeps the exported table in sync with the invariants', () => {
    const exported = Object.entries(STAFF_TRANSITIONS).flatMap(([from, targets]) =>
      targets.map((to) => [from, to]),
    );
    expect(exported.sort()).toEqual([...ALLOWED].sort());
  });

  it('allows a no-show only after the grace period', () => {
    const noShow = { from: BookingStatus.CONFIRMED, to: BookingStatus.NO_SHOW };
    expect(check({ ...noShow, now: minutes(14) })).toMatchObject({
      ok: false,
      code: 'INVALID_STATUS_TRANSITION',
    });
    expect(check({ ...noShow, now: minutes(15) }).ok).toBe(true);
  });

  it('lets staff cancel at any time, even after the start', () => {
    expect(check({ to: BookingStatus.CANCELLED, now: minutes(-1) }).ok).toBe(true);
    expect(check({ to: BookingStatus.CANCELLED, now: minutes(90) }).ok).toBe(true);
  });
});

describe('checkStatusTransition: customers (GHA-54)', () => {
  const cancel = (now: Date, from: Status = BookingStatus.CONFIRMED) =>
    check({ actor: 'CUSTOMER', from, to: BookingStatus.CANCELLED, now });

  it('cancels a confirmed booking more than 5 hours before it starts', () => {
    expect(cancel(minutes(-24 * 60)).ok).toBe(true);
    expect(cancel(minutes(-5 * 60 - 1)).ok).toBe(true);
  });

  it('refuses from 5 hours before the start onwards', () => {
    for (const now of [minutes(-5 * 60), minutes(-4 * 60), minutes(-30), minutes(10)]) {
      expect(cancel(now)).toEqual({
        ok: false,
        code: 'CANCELLATION_WINDOW_CLOSED',
        message:
          'Bookings can be cancelled in the app up to 5 hours before the start time. Call the branch instead.',
      });
    }
  });

  it.each([BookingStatus.ARRIVED, BookingStatus.CANCELLED, BookingStatus.COMPLETED])(
    'refuses to cancel a %s booking',
    (from) => {
      expect(cancel(minutes(-24 * 60), from)).toMatchObject({
        ok: false,
        code: 'INVALID_STATUS_TRANSITION',
      });
    },
  );

  it('never lets customers apply staff transitions', () => {
    expect(
      check({ actor: 'CUSTOMER', to: BookingStatus.ARRIVED, now: minutes(-24 * 60) }),
    ).toMatchObject({ ok: false, code: 'INVALID_STATUS_TRANSITION' });
  });
});

describe('formatMinutes', () => {
  it('prefers whole hours', () => {
    expect([formatMinutes(300), formatMinutes(60), formatMinutes(90)]).toEqual([
      '5 hours',
      '1 hour',
      '90 minutes',
    ]);
  });
});
