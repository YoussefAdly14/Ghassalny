import { BookingStatus } from '@ghassalny/contracts';
import {
  CUSTOMER_CANCEL_CUTOFF_MINUTES,
  NO_SHOW_GRACE_MINUTES,
} from '../availability/engine-config';

// Booking status rules from section 5 of docs/architecture/booking-engine-invariants.md.
// Pure: the service loads the booking, checks here, then applies the change optimistically.

/** Allowed next statuses for staff (workers and admins). Terminal statuses allow none (5.1). */
export const STAFF_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  CONFIRMED: [BookingStatus.ARRIVED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  ARRIVED: [BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  IN_PROGRESS: [BookingStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Customers act on their own bookings; staff act on bookings at branches they operate. */
export type StatusActor = 'CUSTOMER' | 'STAFF';

export type TransitionRequest = {
  from: BookingStatus;
  to: BookingStatus;
  actor: StatusActor;
  startsAt: Date;
  now: Date;
};

export type TransitionCheck =
  | { ok: true }
  | {
      ok: false;
      code: 'INVALID_STATUS_TRANSITION' | 'CANCELLATION_WINDOW_CLOSED';
      message: string;
    };

export function checkStatusTransition(request: TransitionRequest): TransitionCheck {
  const { from, to, actor, startsAt, now } = request;

  if (actor === 'CUSTOMER') {
    // 5.4: customers may only cancel their own CONFIRMED booking, before the cutoff.
    if (from !== BookingStatus.CONFIRMED || to !== BookingStatus.CANCELLED) {
      return invalid(
        from === BookingStatus.CONFIRMED
          ? 'Customers can only cancel a booking.'
          : `A ${statusLabel(from)} booking cannot be cancelled.`,
      );
    }
    const cutoff = startsAt.getTime() - CUSTOMER_CANCEL_CUTOFF_MINUTES * 60_000;
    if (now.getTime() >= cutoff) {
      return {
        ok: false,
        code: 'CANCELLATION_WINDOW_CLOSED',
        message: `Bookings can be cancelled in the app up to ${formatMinutes(CUSTOMER_CANCEL_CUTOFF_MINUTES)} before the start time. Call the branch instead.`,
      };
    }
    return { ok: true };
  }

  if (!STAFF_TRANSITIONS[from].includes(to)) {
    return invalid(`A ${statusLabel(from)} booking cannot be marked ${statusLabel(to)}.`);
  }
  // 5.2: a no-show can only be recorded once the grace period has passed.
  if (
    to === BookingStatus.NO_SHOW &&
    now.getTime() < startsAt.getTime() + NO_SHOW_GRACE_MINUTES * 60_000
  ) {
    return invalid(
      `A booking can be marked no-show ${NO_SHOW_GRACE_MINUTES} minutes after its start time.`,
    );
  }
  return { ok: true };
}

function invalid(message: string): TransitionCheck {
  return { ok: false, code: 'INVALID_STATUS_TRANSITION', message };
}

/** "5 hours", "1 hour", or "90 minutes". */
export function formatMinutes(minutes: number): string {
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

function statusLabel(status: BookingStatus): string {
  return status.toLowerCase().replace('_', ' ');
}
