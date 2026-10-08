import { z } from 'zod';

const nodeEnv = z.enum(['development', 'test', 'production']).default('development');

const httpUrl = z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' });

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// connection string');

const commaSeparatedUrls = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  .pipe(z.array(httpUrl));

const DEV_SECRET_MARKER = 'dev-only';

/** Variables needed by Prisma tooling and anything that opens a database connection. */
export const databaseEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
});
export type DatabaseEnv = z.output<typeof databaseEnvSchema>;

/** Backend API runtime configuration. Secrets live only here, never in client apps. */
export const apiEnvSchema = z
  .object({
    NODE_ENV: nodeEnv,
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: postgresUrl,
    AUTH_SECRET: z.string().min(32, 'must be at least 32 characters'),
    CORS_ALLOWED_ORIGINS: commaSeparatedUrls,
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.AUTH_SECRET.includes(DEV_SECRET_MARKER), {
    message: 'the development placeholder secret must be replaced in production',
    path: ['AUTH_SECRET'],
  });
export type ApiEnv = z.output<typeof apiEnvSchema>;

/** Admin web configuration. Only NEXT_PUBLIC_* values reach the browser. */
export const adminWebEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: httpUrl,
});
export type AdminWebEnv = z.output<typeof adminWebEnvSchema>;

/**
 * Customer iOS app configuration. Every EXPO_PUBLIC_* value is compiled into the app binary,
 * so nothing here may be secret.
 */
export const mobileEnvSchema = z
  .object({
    EXPO_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
    EXPO_PUBLIC_API_URL: httpUrl,
  })
  .refine(
    (env) =>
      env.EXPO_PUBLIC_APP_ENV !== 'production' || env.EXPO_PUBLIC_API_URL.startsWith('https://'),
    {
      message: 'must use https:// for production builds (iOS App Transport Security)',
      path: ['EXPO_PUBLIC_API_URL'],
    },
  );
export type MobileEnv = z.output<typeof mobileEnvSchema>;
