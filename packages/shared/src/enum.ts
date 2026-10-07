/**
 * Domain enums are plain `as const` objects instead of TypeScript `enum`s so they have no
 * runtime emit quirks, work in every bundler (Metro, Next.js, Node), and their string values
 * line up one-to-one with the Prisma enums in packages/database.
 */
export type EnumValue<T extends Readonly<Record<string, string>>> = T[keyof T];

/** Builds a type guard for validating untrusted strings (query params, storage) against an enum. */
export function createEnumGuard<T extends Readonly<Record<string, string>>>(enumObject: T) {
  const values = new Set<string>(Object.values(enumObject));
  return (value: unknown): value is EnumValue<T> => typeof value === 'string' && values.has(value);
}
