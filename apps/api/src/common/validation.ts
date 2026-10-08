import type { z } from 'zod';
import { validationFailed } from './errors';

/** Validates untrusted input (body, query, params). Throws a 400 VALIDATION_FAILED AppError. */
export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    throw validationFailed(
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}
