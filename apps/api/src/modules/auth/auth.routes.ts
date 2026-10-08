import type { AuthSessionResponse } from '@ghassalny/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseInput } from '../../common/validation';
import { loginSchema, refreshTokenSchema, registerCustomerSchema } from './auth.schemas';
import type { AuthService, ClientInfo } from './auth.service';

/** Brute-force protection for credential endpoints (in-memory, per IP; see ADR 0003). */
const CREDENTIAL_RATE_LIMIT = { rateLimit: { max: 10, timeWindow: '1 minute' } };

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService) {
  app.post('/auth/register', { config: CREDENTIAL_RATE_LIMIT }, async (request, reply) => {
    const input = parseInput(registerCustomerSchema, request.body);
    const session: AuthSessionResponse = await authService.registerCustomer(
      input,
      clientInfo(request),
    );
    return reply.status(201).send(session);
  });

  app.post('/auth/login', { config: CREDENTIAL_RATE_LIMIT }, async (request) => {
    const input = parseInput(loginSchema, request.body);
    return authService.login(input, clientInfo(request));
  });

  app.post('/auth/refresh', { config: CREDENTIAL_RATE_LIMIT }, async (request) => {
    const { refreshToken } = parseInput(refreshTokenSchema, request.body);
    return authService.refresh(refreshToken);
  });

  app.post('/auth/logout', async (request, reply) => {
    const { refreshToken } = parseInput(refreshTokenSchema, request.body);
    await authService.logout(refreshToken);
    return reply.status(204).send();
  });
}

function clientInfo(request: FastifyRequest): ClientInfo {
  return { userAgent: request.headers['user-agent'] ?? null };
}
