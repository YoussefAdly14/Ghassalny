import { randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the original password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('correct horse batterY', hash)).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    const [first, second] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(first).not.toBe(second);
  });

  it('verifies hashes produced by the database seed format', async () => {
    const salt = randomBytes(16);
    const key = scryptSync('Ghassalny123!', salt, 64, { N: 16384, r: 8, p: 1 });
    const seedHash = ['scrypt', 16384, 8, 1, salt.toString('base64'), key.toString('base64')].join(
      '$',
    );
    await expect(verifyPassword('Ghassalny123!', seedHash)).resolves.toBe(true);
  });

  it('returns false for malformed hashes instead of throwing', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'bcrypt$10$abc')).resolves.toBe(false);
  });

  it('dummy verification always fails', async () => {
    await expect(verifyAgainstDummyHash('anything')).resolves.toBe(false);
  });
});
