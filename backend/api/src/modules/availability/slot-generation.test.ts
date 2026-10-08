import { BookingStatus } from '@ghassalny/contracts';
import { describe, expect, it } from 'vitest';
import {
  checkWalkInStart,
  freeBaysFor,
  generateSlots,
  type ExistingBooking,
  type SlotQuery,
  type TimeRange,
} from './slot-generation';
import { zonedTimeToUtc } from './zoned-time';

// Wednesday 13 January 2027 in Cairo (UTC+2, no daylight saving in winter).
const DATE = { year: 2027, month: 1, day: 13 };
const CAIRO = 'Africa/Cairo';
const at = (hour: number, minute = 0) => zonedTimeToUtc(DATE, hour * 60 + minute, CAIRO);
const range = (from: [number, number], to: [number, number]): TimeRange => ({
  startsAt: at(...from),
  endsAt: at(...to),
});

function query(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    date: DATE,
    timeZone: CAIRO,
    workingHours: [{ dayOfWeek: 'WEDNESDAY', opensAtMinute: 9 * 60, closesAtMinute: 12 * 60 }],
    slotIntervalMinutes: 30,
    durationMinutes: 30,
    washBays: 1,
    blocks: [],
    bookings: [],
    now: new Date('2027-01-01T00:00:00Z'),
    minLeadMinutes: 30,
    horizonDays: 30,
    ...overrides,
  };
}

/** Slot start times as Cairo "HH:MM" for readable assertions. */
function startTimes(q: SlotQuery): string[] {
  return generateSlots(q).map((slot) =>
    slot.startsAt.toLocaleTimeString('en-GB', {
      timeZone: CAIRO,
      hour: '2-digit',
      minute: '2-digit',
    }),
  );
}

function booking(
  from: [number, number],
  to: [number, number],
  extra: Partial<ExistingBooking> = {},
) {
  return { ...range(from, to), bayNumber: 1, status: BookingStatus.CONFIRMED, ...extra };
}

describe('generateSlots: working hours (GHA-49)', () => {
  it('generates slots on the interval grid that fit before closing', () => {
    expect(startTimes(query())).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
  });

  it('returns UTC start and end timestamps of the right length', () => {
    const [first] = generateSlots(query({ durationMinutes: 45 }));
    expect(first?.startsAt.toISOString()).toBe('2027-01-13T07:00:00.000Z');
    expect(first?.endsAt.toISOString()).toBe('2027-01-13T07:45:00.000Z');
  });

  it('drops start times whose service would run past closing', () => {
    expect(startTimes(query({ durationMinutes: 60 }))).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
    ]);
    expect(startTimes(query({ durationMinutes: 240 }))).toEqual([]);
  });

  it('returns nothing on a day with no working hours (closed)', () => {
    expect(
      generateSlots(
        query({
          workingHours: [{ dayOfWeek: 'FRIDAY', opensAtMinute: 0, closesAtMinute: 1440 }],
        }),
      ),
    ).toEqual([]);
  });

  it('handles split shifts and never crosses the break', () => {
    const slots = startTimes(
      query({
        workingHours: [
          { dayOfWeek: 'WEDNESDAY', opensAtMinute: 13 * 60 + 30, closesAtMinute: 15 * 60 },
          { dayOfWeek: 'WEDNESDAY', opensAtMinute: 9 * 60, closesAtMinute: 10 * 60 + 30 },
        ],
        durationMinutes: 60,
      }),
    );
    expect(slots).toEqual(['09:00', '09:30', '13:30', '14:00']);
  });

  it('measures the grid from each interval opening time', () => {
    expect(
      startTimes(
        query({
          workingHours: [
            { dayOfWeek: 'WEDNESDAY', opensAtMinute: 9 * 60 + 15, closesAtMinute: 11 * 60 },
          ],
        }),
      ),
    ).toEqual(['09:15', '09:45', '10:15']);
  });

  it('supports 24-hour branches up to midnight', () => {
    const slots = generateSlots(
      query({ workingHours: [{ dayOfWeek: 'WEDNESDAY', opensAtMinute: 0, closesAtMinute: 1440 }] }),
    );
    expect(slots).toHaveLength(48);
    expect(slots.at(-1)?.endsAt.toISOString()).toBe('2027-01-13T22:00:00.000Z');
  });

  it('enforces minimum lead time and booking horizon', () => {
    expect(startTimes(query({ now: at(9, 45) }))).toEqual(['10:30', '11:00', '11:30']);
    expect(startTimes(query({ now: at(10, 0), minLeadMinutes: 0 }))).toEqual([
      '10:00',
      '10:30',
      '11:00',
      '11:30',
    ]);
    expect(startTimes(query({ now: new Date('2026-12-01T00:00:00Z'), horizonDays: 14 }))).toEqual(
      [],
    );
  });
});

describe('generateSlots: availability blocks (GHA-50)', () => {
  it('removes slots inside a maintenance or closure block', () => {
    expect(startTimes(query({ blocks: [range([10, 0], [11, 0])] }))).toEqual([
      '09:00',
      '09:30',
      '11:00',
      '11:30',
    ]);
  });

  it('removes slots that only partially overlap a block', () => {
    // A 60-minute service starting 09:30 would run into a 10:15 block.
    expect(startTimes(query({ durationMinutes: 60, blocks: [range([10, 15], [10, 45])] }))).toEqual(
      ['09:00', '11:00'],
    );
  });

  it('keeps slots that touch a block boundary (half-open intervals)', () => {
    expect(startTimes(query({ blocks: [range([9, 30], [10, 0])] }))).toEqual([
      '09:00',
      '10:00',
      '10:30',
      '11:00',
      '11:30',
    ]);
  });

  it('a block covering the whole day leaves no slots', () => {
    expect(generateSlots(query({ blocks: [range([0, 0], [23, 59])] }))).toEqual([]);
  });
});

describe('generateSlots: existing bookings (GHA-51)', () => {
  it('a confirmed booking removes the slot on a single-bay branch', () => {
    expect(startTimes(query({ bookings: [booking([10, 0], [10, 30])] }))).toEqual([
      '09:00',
      '09:30',
      '10:30',
      '11:00',
      '11:30',
    ]);
  });

  it('removes every slot a longer booking partially overlaps', () => {
    expect(
      startTimes(query({ durationMinutes: 60, bookings: [booking([10, 15], [10, 45])] })),
    ).toEqual(['09:00', '11:00']);
  });

  it.each([BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.COMPLETED])(
    '%s bookings do not reduce availability',
    (status) => {
      expect(startTimes(query({ bookings: [booking([10, 0], [10, 30], { status })] }))).toContain(
        '10:00',
      );
    },
  );

  it.each([BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS])(
    '%s bookings still hold their bay',
    (status) => {
      expect(
        startTimes(query({ bookings: [booking([10, 0], [10, 30], { status })] })),
      ).not.toContain('10:00');
    },
  );

  it('with several bays, a slot stays open until every bay is taken', () => {
    const twoBays = query({ washBays: 2, bookings: [booking([10, 0], [10, 30])] });
    const slot = generateSlots(twoBays).find((s) => s.startsAt.getTime() === at(10).getTime());
    expect(slot?.freeBays).toEqual([2]);

    const full = query({
      washBays: 2,
      bookings: [booking([10, 0], [10, 30]), booking([10, 0], [10, 30], { bayNumber: 2 })],
    });
    expect(startTimes(full)).not.toContain('10:00');
  });
});

describe('freeBaysFor', () => {
  it('lists free bays lowest first, ignoring released bookings', () => {
    const bookings = [
      booking([10, 0], [11, 0], { bayNumber: 2 }),
      booking([10, 0], [11, 0], { bayNumber: 1, status: BookingStatus.CANCELLED }),
      booking([11, 0], [12, 0], { bayNumber: 3 }),
    ];
    expect(freeBaysFor(range([10, 0], [10, 30]), 3, bookings)).toEqual([1, 3]);
    expect(freeBaysFor(range([10, 30], [11, 30]), 3, bookings)).toEqual([1]);
  });
});

describe('checkWalkInStart (GHA-55)', () => {
  const walkIn = (startsAt: Date, overrides: Partial<SlotQuery> = {}) => {
    const { timeZone, workingHours, durationMinutes, washBays, blocks, bookings } =
      query(overrides);
    return checkWalkInStart({
      startsAt,
      timeZone,
      workingHours,
      durationMinutes,
      washBays,
      blocks,
      bookings,
    });
  };

  it('accepts any minute inside working hours, off the slot grid', () => {
    const check = walkIn(at(9, 7));
    expect(check).toEqual({
      ok: true,
      slot: { startsAt: at(9, 7), endsAt: at(9, 37), freeBays: [1] },
    });
  });

  it('rejects starts before opening or services that would run past closing', () => {
    expect(walkIn(at(8, 59))).toEqual({ ok: false, reason: 'OUTSIDE_WORKING_HOURS' });
    expect(walkIn(at(11, 31))).toEqual({ ok: false, reason: 'OUTSIDE_WORKING_HOURS' });
    expect(walkIn(at(11, 30)).ok).toBe(true);
  });

  it('rejects walk-ins that span a split-shift break', () => {
    const workingHours = [
      { dayOfWeek: 'WEDNESDAY' as const, opensAtMinute: 9 * 60, closesAtMinute: 10 * 60 },
      { dayOfWeek: 'WEDNESDAY' as const, opensAtMinute: 10 * 60 + 30, closesAtMinute: 12 * 60 },
    ];
    expect(walkIn(at(9, 45), { workingHours })).toEqual({
      ok: false,
      reason: 'OUTSIDE_WORKING_HOURS',
    });
  });

  it('respects availability blocks and bay capacity', () => {
    expect(walkIn(at(10, 15), { blocks: [range([10, 30], [11, 0])] })).toEqual({
      ok: false,
      reason: 'BLOCKED',
    });
    expect(walkIn(at(10, 15), { bookings: [booking([10, 0], [10, 30])] })).toEqual({
      ok: false,
      reason: 'NO_FREE_BAY',
    });
    const twoBays = walkIn(at(10, 15), { washBays: 2, bookings: [booking([10, 0], [10, 30])] });
    expect(twoBays.ok && twoBays.slot.freeBays).toEqual([2]);
  });
});
