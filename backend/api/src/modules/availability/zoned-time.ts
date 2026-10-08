import type { DayOfWeek } from '@ghassalny/database';

// Wall-clock helpers built on Intl, so daylight saving time follows the IANA database without a
// date library. Egypt switches clocks, so never assume a fixed +02:00 offset.

export type LocalDate = { year: number; month: number; day: number };

const DAYS: readonly DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string) {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function dateFormatter(timeZone: string) {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** UTC offset of `timeZone` at `instant`, in minutes (e.g. 180 for Cairo summer time). */
export function utcOffsetMinutes(timeZone: string, instant: Date): number {
  const label = offsetFormatter(timeZone)
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(label ?? '');
  if (!match) return 0; // "GMT" exactly, i.e. UTC.
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/** Parses "YYYY-MM-DD"; returns null for malformed or impossible dates. */
export function parseLocalDate(value: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return check.getUTCMonth() === date.month - 1 && check.getUTCDate() === date.day ? date : null;
}

export function formatLocalDate(date: LocalDate): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** The calendar date of `instant` in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const parts = dateFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function dayOfWeekOf(date: LocalDate): DayOfWeek {
  return DAYS[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()]!;
}

/**
 * The UTC instant of a wall-clock time `minuteOfDay` minutes after local midnight on `date`.
 * 1440 means the following midnight. During a spring-forward gap the result moves forward by the
 * gap, which matches what a clock on the wall shows.
 */
export function zonedTimeToUtc(date: LocalDate, minuteOfDay: number, timeZone: string): Date {
  const wallClockAsUtc = Date.UTC(date.year, date.month - 1, date.day, 0, minuteOfDay);
  const firstGuess = wallClockAsUtc - utcOffsetMinutes(timeZone, new Date(wallClockAsUtc)) * 60_000;
  return new Date(wallClockAsUtc - utcOffsetMinutes(timeZone, new Date(firstGuess)) * 60_000);
}
