import { UserRole, type ApiErrorBody } from '@ghassalny/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerErrorHandling } from '../../common/error-handler';
import type { AuthContext } from './auth-context';
import { registerAuthGuards, requireAuthContext } from './guards';

const ORG = 'org-1';

const contexts: Record<string, AuthContext> = {
  customer: {
    userId: 'u-customer',
    sessionId: 's',
    roles: [{ role: UserRole.CUSTOMER, organizationId: null }],
    assignedBranches: [],
  },
  worker: {
    userId: 'u-worker',
    sessionId: 's',
    roles: [{ role: UserRole.WORKER, organizationId: ORG }],
    assignedBranches: [{ branchId: 'b-1', organizationId: ORG }],
  },
  admin: {
    userId: 'u-admin',
    sessionId: 's',
    roles: [{ role: UserRole.BUSINESS_ADMIN, organizationId: ORG }],
    assignedBranches: [],
  },
  platform: {
    userId: 'u-platform',
    sessionId: 's',
    roles: [{ role: UserRole.PLATFORM_ADMIN, organizationId: null }],
    assignedBranches: [],
  },
};

describe('auth guards', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandling(app);
    // Tokens in this test are simply the context key, e.g. "Bearer admin".
    const guards = registerAuthGuards(app, {
      resolveAccessToken: async (token) => contexts[token] ?? null,
    });
    app.get('/signed-in', { preHandler: guards.authenticate }, async (request) => ({
      userId: requireAuthContext(request).userId,
    }));
    app.get(
      '/staff',
      { preHandler: guards.requireRoles(UserRole.WORKER, UserRole.BUSINESS_ADMIN) },
      async () => ({ ok: true }),
    );
    app.get(
      '/admin',
      { preHandler: guards.requireRoles(UserRole.BUSINESS_ADMIN, UserRole.PLATFORM_ADMIN) },
      async () => ({ ok: true }),
    );
    app.get(
      '/platform',
      { preHandler: guards.requireRoles(UserRole.PLATFORM_ADMIN) },
      async () => ({
        ok: true,
      }),
    );
    await app.ready();
  });
  afterEach(() => app.close());

  const call = (url: string, token?: string) =>
    app.inject({
      method: 'GET',
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  it('rejects missing, malformed, and unknown tokens with a consistent 401', async () => {
    const responses = [
      await call('/signed-in'),
      await call('/signed-in', 'unknown'),
      await app.inject({ method: 'GET', url: '/signed-in', headers: { authorization: 'Basic x' } }),
    ];
    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(response.json<ApiErrorBody>().error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('exposes the auth context to handlers', async () => {
    expect((await call('/signed-in', 'customer')).json()).toEqual({ userId: 'u-customer' });
  });

  it.each([
    ['/staff', 'worker', 200],
    ['/staff', 'admin', 200],
    ['/staff', 'customer', 403],
    ['/staff', 'platform', 403],
    ['/admin', 'admin', 200],
    ['/admin', 'platform', 200],
    ['/admin', 'worker', 403],
    ['/admin', 'customer', 403],
    ['/platform', 'platform', 200],
    ['/platform', 'admin', 403],
  ])('%s as %s -> %i', async (url, who, status) => {
    const response = await call(url, who);
    expect(response.statusCode).toBe(status);
    if (status === 403) expect(response.json<ApiErrorBody>().error.code).toBe('FORBIDDEN');
  });

  it('checks authentication before roles', async () => {
    expect((await call('/admin')).statusCode).toBe(401);
  });
});
