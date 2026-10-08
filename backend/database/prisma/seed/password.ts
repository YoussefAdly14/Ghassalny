import { randomBytes, scryptSync } from 'node:crypto';

// Seed-only password hashing using Node's built-in scrypt (no native dependencies).
// Format: scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>.
// The auth module (GHA-41, GHA-42) must verify this format or the seed must be updated with it.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}
