import { databaseEnvSchema, parseEnv, type EnvSource } from '@ghassalny/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export type DatabaseClient = PrismaClient;

/**
 * Creates a Prisma client backed by the node-postgres driver adapter.
 * Create one client per process and share it; each client owns a connection pool.
 */
export function createDatabaseClient(source: EnvSource = process.env): DatabaseClient {
  const { DATABASE_URL } = parseEnv('database', databaseEnvSchema, source);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
}
