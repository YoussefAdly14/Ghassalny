import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read leniently so `prisma generate` (run by typecheck and CI) works without a database.
    // Commands that connect (migrate, studio) fail with a clear error when it is missing.
    url: process.env.DATABASE_URL,
  },
});
