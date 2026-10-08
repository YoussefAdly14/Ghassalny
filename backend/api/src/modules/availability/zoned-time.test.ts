import { describe, expect, it } from 'vitest';
import {
  dayOfWeekOf,
  formatLocalDate,
  localDateOf,
  parseLocalDate,
  utcOffsetMinutes,
  zonedTimeToUtc,
} from './zoned-time';

const CAIRO = 'Africa/Cairo';

describe('zoned time', () => {
  it('follows Egyptian daylight saving time', () => {
    expect(utcOffsetMinutes(CAIRO, new Date('2027-01-15T12:00:00Z'))).toBe(120);
    expect(utcOffsetMinutes(CAIRO, new Date('2027-07-15T12:00:00Z'))).toBe(180);
    expect(utcOffsetMinutes('UTC', new Date('2027-07-15T12:00:00Z'))).toBe(0);
  });

  it('converts Cairo wall-clock time to UTC in winter and summer', () => {
    expect(zonedTimeToUtc({ year: 2027, month: 1, day: 13 }, 10 * 60, CAIRO).toISOString()).toBe(
      '2027-01-13T08:00:00.000Z',
    );
    expect(zonedTimeToUtc({ year: 2027, month: 7, day: 14 }, 10 * 60, CAIRO).toISOString()).toBe(
      '2027-07-14T07:00:00.000Z',
    );
  });

  it('treats minute 1440 as the following midnight', () => {
    expect(zonedTimeToUtc({ year: 2027, month: 1, day: 13 }, 1440, CAIRO).toISOString()).toBe(
      '2027-01-13T22:00:00.000Z',
    );
  });

  it('finds the local date and weekday of an instant', () => {
    // 23:30 UTC on Jan 12 is 01:30 on Jan 13 in Cairo.
    expect(localDateOf(new Date('2027-01-12T23:30:00Z'), CAIRO)).toEqual({
      year: 2027,
      month: 1,
      day: 13,
    });
    expect(dayOfWeekOf({ year: 2027, month: 1, day: 13 })).toBe('WEDNESDAY');
    expect(dayOfWeekOf({ year: 2027, month: 1, day: 15 })).toBe('FRIDAY');
  });

  it('parses and formats YYYY-MM-DD strictly', () => {
    expect(parseLocalDate('2027-01-13')).toEqual({ year: 2027, month: 1, day: 13 });
    expect(parseLocalDate('2027-02-30')).toBeNull();
    expect(parseLocalDate('13/01/2027')).toBeNull();
    expect(formatLocalDate({ year: 2027, month: 1, day: 3 })).toBe('2027-01-03');
  });
});
