import 'dotenv/config';
import { createDatabaseClient } from '@ghassalny/database';
import { buildApp } from './app';
import { loadConfig } from './config';
import { PrismaAuthRepository } from './modules/auth/auth.repository';

const config = loadConfig(process.env);
const db = createDatabaseClient(process.env);

const app = await buildApp({
  config,
  authRepository: new PrismaAuthRepository(db),
  checkDatabase: async () => {
    await db.$queryRaw`SELECT 1`;
  },
});

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await db.$disconnect();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

// 0.0.0.0 so a physical iPhone on the same Wi-Fi can reach the API during development.
await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
