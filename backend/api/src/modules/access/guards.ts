import type { UserRole } from '@ghassalny/contracts';
import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { forbidden, unauthenticated } from '../../common/errors';
import { hasAnyRole, type AccessTokenResolver, type AuthContext } from './auth-context';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the `authenticate` guard. Null on public routes. */
    auth: AuthContext | null;
  }
}

/** Adds `request.auth` and the guard factories to an app. */
export function registerAuthGuards(app: FastifyInstance, resolver: AccessTokenResolver) {
  app.decorateRequest('auth', null);

  const authenticate: preHandlerAsyncHookHandler = async (request) => {
    const token = readBearerToken(request);
    if (!token) throw unauthenticated();
    const context = await resolver.resolveAccessToken(token);
    if (!context) throw unauthenticated('Your session has expired. Sign in again.');
    request.auth = context;
  };

  return {
    /** Requires a valid access token. */
    authenticate,
    /** Requires a valid access token and at least one of `roles` (in any organization). */
    requireRoles(...roles: UserRole[]): preHandlerAsyncHookHandler[] {
      const checkRoles: preHandlerAsyncHookHandler = async (request) => {
        if (!request.auth || !hasAnyRole(request.auth, roles)) throw forbidden();
      };
      return [authenticate, checkRoles];
    },
  };
}

export type AuthGuards = ReturnType<typeof registerAuthGuards>;

function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** For handlers behind `authenticate`: returns the context or fails loudly if misconfigured. */
export function requireAuthContext(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthenticated();
  return request.auth;
}
