import {
  UserRole,
  type AvailabilityResponse,
  type BookingResponse,
  type CreateAvailabilityBlockResponse,
} from '@ghassalny/contracts';
import type { FastifyInstance } from 'fastify';
import { parseInput } from '../../common/validation';
import { requireAuthContext, type AuthGuards } from '../access/guards';
import {
  availabilityQuerySchema,
  bookingParamsSchema,
  branchBookingParamsSchema,
  branchParamsSchema,
  cancelBookingSchema,
  changeStatusSchema,
  createBlockSchema,
  createBookingSchema,
  createWalkInSchema,
} from './bookings.schemas';
import type { BookingService } from './bookings.service';

/** Branch staff. Which branches each may operate is checked per request in the service. */
const STAFF_ROLES = [UserRole.WORKER, UserRole.BUSINESS_ADMIN, UserRole.PLATFORM_ADMIN] as const;

export function registerBookingRoutes(
  app: FastifyInstance,
  guards: AuthGuards,
  bookingService: BookingService,
) {
  /** Public: bookable slots for a service at a branch on one local date. Browsing needs no account. */
  app.get('/branches/:branchId/availability', async (request) => {
    const { branchId } = parseInput(branchParamsSchema, request.params);
    const query = parseInput(availabilityQuerySchema, request.query);
    const response: AvailabilityResponse = await bookingService.getAvailability(branchId, query);
    return response;
  });

  app.post(
    '/bookings',
    { preHandler: guards.requireRoles(UserRole.CUSTOMER) },
    async (request, reply) => {
      const { userId } = requireAuthContext(request);
      const input = parseInput(createBookingSchema, request.body);
      const response: BookingResponse = {
        booking: await bookingService.createCustomerBooking(userId, input),
      };
      return reply.status(201).send(response);
    },
  );

  app.post(
    '/bookings/:bookingId/cancel',
    { preHandler: guards.requireRoles(UserRole.CUSTOMER) },
    async (request) => {
      const { userId } = requireAuthContext(request);
      const { bookingId } = parseInput(bookingParamsSchema, request.params);
      const { reason } = parseInput(cancelBookingSchema, request.body);
      const response: BookingResponse = {
        booking: await bookingService.cancelAsCustomer(userId, bookingId, reason),
      };
      return response;
    },
  );

  app.post(
    '/branches/:branchId/walk-ins',
    { preHandler: guards.requireRoles(...STAFF_ROLES) },
    async (request, reply) => {
      const auth = requireAuthContext(request);
      const { branchId } = parseInput(branchParamsSchema, request.params);
      const input = parseInput(createWalkInSchema, request.body);
      const response: BookingResponse = {
        booking: await bookingService.createWalkIn(auth, branchId, input),
      };
      return reply.status(201).send(response);
    },
  );

  app.post(
    '/branches/:branchId/bookings/:bookingId/status',
    { preHandler: guards.requireRoles(...STAFF_ROLES) },
    async (request) => {
      const auth = requireAuthContext(request);
      const { branchId, bookingId } = parseInput(branchBookingParamsSchema, request.params);
      const input = parseInput(changeStatusSchema, request.body);
      const response: BookingResponse = {
        booking: await bookingService.changeStatusAsStaff(auth, branchId, bookingId, input),
      };
      return response;
    },
  );

  app.post(
    '/branches/:branchId/availability-blocks',
    { preHandler: guards.requireRoles(...STAFF_ROLES) },
    async (request, reply) => {
      const auth = requireAuthContext(request);
      const { branchId } = parseInput(branchParamsSchema, request.params);
      const input = parseInput(createBlockSchema, request.body);
      const response: CreateAvailabilityBlockResponse = await bookingService.createBlock(
        auth,
        branchId,
        input,
      );
      return reply.status(201).send(response);
    },
  );
}
