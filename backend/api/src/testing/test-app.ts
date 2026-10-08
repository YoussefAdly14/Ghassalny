import { buildApp } from '../app';
import type { ApiConfig } from '../config';
import { InMemoryAuthRepository } from './in-memory-auth-repository';

export const TEST_CONFIG: ApiConfig = {
  NODE_ENV: 'test',
  API_PORT: 0,
  DATABASE_URL: 'postgresql://unused',
  AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  CORS_ALLOWED_ORIGINS: [],
};

/** A fully wired app backed by in-memory fakes, with a controllable clock. */
export async function createTestApp(options: { now?: () => Date } = {}) {
  const authRepository = new InMemoryAuthRepository();
  const app = await buildApp({
    config: TEST_CONFIG,
    authRepository,
    checkDatabase: async () => {},
    now: options.now ?? (() => new Date()),
    logger: false,
  });
  return { app, authRepository };
}
