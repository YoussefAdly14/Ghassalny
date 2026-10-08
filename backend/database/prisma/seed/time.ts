const CAIRO = 'Africa/Cairo';

/** Offset of `timeZone` from UTC at `instant`, in minutes (e.g. +180 for Cairo in summer). */
function offsetMinutes(timeZone: string, instant: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? '');
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/** Calendar date (year, month, day) of `instant` in `timeZone`. */
function localDate(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * The UTC instant for a Cairo wall-clock time, `dayOffset` days from today's Cairo date.
 * Handles Egyptian daylight saving time via the IANA zone.
 */
export function cairoTime(dayOffset: number, hour: number, minute = 0): Date {
  const today = localDate(new Date(), CAIRO);
  const wallClockAsUtc = Date.UTC(today.year, today.month - 1, today.day + dayOffset, hour, minute);
  const guess = new Date(wallClockAsUtc - offsetMinutes(CAIRO, new Date(wallClockAsUtc)) * 60_000);
  return new Date(wallClockAsUtc - offsetMinutes(CAIRO, guess) * 60_000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
