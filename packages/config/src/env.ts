import type { z } from 'zod';

/**
 * A flat map of environment variables. Callers pass the source explicitly so this package
 * stays platform-neutral: the API passes `process.env`, while the Expo app must pass an object
 * literal because Expo only inlines `process.env.EXPO_PUBLIC_*` when it is accessed statically.
 */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export class EnvValidationError extends Error {
  override readonly name = 'EnvValidationError';

  constructor(
    readonly scope: string,
    readonly issues: readonly z.core.$ZodIssue[],
  ) {
    const details = issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    super(`Invalid ${scope} environment configuration:\n${details}`);
  }
}

/**
 * Validates an environment source against a schema and returns the typed result.
 * Empty strings are treated as unset so that schema defaults apply to blank `.env` entries.
 */
export function parseEnv<TSchema extends z.ZodType>(
  scope: string,
  schema: TSchema,
  source: EnvSource,
): z.output<TSchema> {
  const normalized = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === '' ? undefined : value]),
  );
  const result = schema.safeParse(normalized);
  if (!result.success) {
    throw new EnvValidationError(scope, result.error.issues);
  }
  return result.data;
}
