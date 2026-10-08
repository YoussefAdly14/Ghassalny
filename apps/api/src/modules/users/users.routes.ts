import type { CurrentUserResponse } from '@ghassalny/shared';
import type { FastifyInstance } from 'fastify';
import type { AuthGuards } from '../access/guards';
import { requireAuthContext } from '../access/guards';
import type { AuthService } from '../auth/auth.service';

export function registerUserRoutes(
  app: FastifyInstance,
  guards: AuthGuards,
  authService: AuthService,
) {
  /** The signed-in user's profile, roles, and assigned branches. Never returns secrets. */
  app.get('/me', { preHandler: guards.authenticate }, async (request) => {
    const { userId } = requireAuthContext(request);
    const response: CurrentUserResponse = { user: await authService.getCurrentUser(userId) };
    return response;
  });
}
