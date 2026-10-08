import type { ApiErrorBody, AuthSessionResponse, CurrentUserResponse } from '@ghassalny/contracts';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../testing/test-app';
import type { InMemoryAuthRepository } from '../../testing/in-memory-auth-repository';
import { hashPassword } from './password';

const customer = {
  fullName: 'Omar Customer',
  email: 'Omar@Example.com',
  phone: '010 1234 5678',
  password: 'super-secret-1',
};

describe('auth routes', () => {
  let app: FastifyInstance;
  let repository: InMemoryAuthRepository;
  let clock: Date;

  beforeEach(async () => {
    clock = new Date('2027-01-10T08:00:00Z');
    ({ app, authRepository: repository } = await createTestApp({ now: () => clock }));
  });
  afterEach(() => app.close());

  const register = (body: object = customer) =>
    app.inject({ method: 'POST', url: '/auth/register', payload: body });
  const login = (email: string, password: string) =>
    app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
  const me = (accessToken?: string) =>
    app.inject({
      method: 'GET',
      url: '/me',
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    });

  describe('POST /auth/register', () => {
    it('creates a customer, normalizes email and phone, and starts a session', async () => {
      const response = await register();
      expect(response.statusCode).toBe(201);
      const body = response.json<AuthSessionResponse>();
      expect(body.user).toMatchObject({
        email: 'omar@example.com',
        phone: '+201012345678',
        fullName: 'Omar Customer',
        preferredLocale: 'en',
        roles: [{ role: 'CUSTOMER', organizationId: null }],
        assignedBranchIds: [],
      });
      expect(body.tokens.accessToken).toBeTruthy();
      expect(body.tokens.refreshToken).toBeTruthy();

      const stored = [...repository.users.values()][0]!;
      expect(stored.passwordHash).toMatch(/^scrypt\$/);
      expect(stored.passwordHash).not.toContain(customer.password);
    });

    it('rejects duplicate email and phone with specific codes', async () => {
      await register();
      const sameEmail = await register({ ...customer, phone: '01198765432' });
      expect(sameEmail.statusCode).toBe(409);
      expect(sameEmail.json<ApiErrorBody>().error.code).toBe('EMAIL_TAKEN');

      const samePhone = await register({ ...customer, email: 'other@example.com' });
      expect(samePhone.statusCode).toBe(409);
      expect(samePhone.json<ApiErrorBody>().error.code).toBe('PHONE_TAKEN');
    });

    it('returns field-level validation errors', async () => {
      const response = await register({
        fullName: '',
        email: 'nope',
        phone: '123',
        password: 'short',
      });
      expect(response.statusCode).toBe(400);
      const body = response.json<ApiErrorBody>();
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details?.map((detail) => detail.path).sort()).toEqual([
        'email',
        'fullName',
        'password',
        'phone',
      ]);
    });
  });

  describe('POST /auth/login', () => {
    it('signs in with correct credentials, case-insensitively by email', async () => {
      await register();
      const response = await login('OMAR@example.com', customer.password);
      expect(response.statusCode).toBe(200);
      expect(response.json<AuthSessionResponse>().user.email).toBe('omar@example.com');
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      await register();
      const wrongPassword = await login(customer.email, 'wrong-password');
      const unknownEmail = await login('nobody@example.com', 'wrong-password');
      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownEmail.statusCode).toBe(401);
      expect(wrongPassword.json()).toEqual(unknownEmail.json());
      expect(wrongPassword.json<ApiErrorBody>().error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects disabled accounts with the same generic error', async () => {
      repository.addUser({
        email: 'disabled@example.com',
        status: 'DISABLED',
        passwordHash: await hashPassword('super-secret-1'),
      });
      const response = await login('disabled@example.com', 'super-secret-1');
      expect(response.json<ApiErrorBody>().error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rate limits repeated attempts', async () => {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 11; attempt += 1) {
        statuses.push((await login('nobody@example.com', 'wrong-password')).statusCode);
      }
      expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
      const limited = await login('nobody@example.com', 'wrong-password');
      expect(limited.statusCode).toBe(429);
      expect(limited.json<ApiErrorBody>().error.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /me', () => {
    it('returns the current user without secrets', async () => {
      const { tokens } = (await register()).json<AuthSessionResponse>();
      const response = await me(tokens.accessToken);
      expect(response.statusCode).toBe(200);
      const body = response.json<CurrentUserResponse>();
      expect(body.user.email).toBe('omar@example.com');
      expect(JSON.stringify(body)).not.toMatch(/password|hash|refresh/i);
    });

    it('requires a valid access token', async () => {
      expect((await me()).json<ApiErrorBody>().error.code).toBe('UNAUTHENTICATED');
      expect((await me('not-a-token')).statusCode).toBe(401);
    });

    it('rejects access tokens after they expire', async () => {
      const { tokens } = (await register()).json<AuthSessionResponse>();
      clock = new Date(clock.getTime() + 16 * 60_000);
      expect((await me(tokens.accessToken)).statusCode).toBe(401);
    });
  });

  describe('session refresh and logout', () => {
    it('rotates the refresh token and rejects the old one', async () => {
      const { tokens } = (await register()).json<AuthSessionResponse>();
      const refreshed = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: tokens.refreshToken },
      });
      expect(refreshed.statusCode).toBe(200);
      const next = refreshed.json<AuthSessionResponse>().tokens;
      expect(next.refreshToken).not.toBe(tokens.refreshToken);
      expect((await me(next.accessToken)).statusCode).toBe(200);

      const replay = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: tokens.refreshToken },
      });
      expect(replay.statusCode).toBe(401);
      expect(replay.json<ApiErrorBody>().error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('logout revokes the session for both refresh and access tokens', async () => {
      const { tokens } = (await register()).json<AuthSessionResponse>();
      const logout = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        payload: { refreshToken: tokens.refreshToken },
      });
      expect(logout.statusCode).toBe(204);
      expect((await me(tokens.accessToken)).statusCode).toBe(401);
      const refresh = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: tokens.refreshToken },
      });
      expect(refresh.statusCode).toBe(401);
    });
  });

  it('answers unknown routes with the standard error shape', async () => {
    const response = await app.inject({ method: 'GET', url: '/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json<ApiErrorBody>().error.code).toBe('NOT_FOUND');
  });
});
