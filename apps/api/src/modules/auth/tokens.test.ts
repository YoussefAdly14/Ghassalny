import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_TTL_MINUTES,
  AccessTokenSigner,
  generateRefreshToken,
  hashRefreshToken,
} from './tokens';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const NOW = new Date('2027-01-10T08:00:00Z');

describe('AccessTokenSigner', () => {
  const signer = new AccessTokenSigner(SECRET);
  const claims = { userId: 'user-1', sessionId: 'session-1' };

  it('round-trips claims and reports the expiry', async () => {
    const { token, expiresAt } = await signer.sign(claims, NOW);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(ACCESS_TOKEN_TTL_MINUTES * 60_000);
    await expect(signer.verify(token, NOW)).resolves.toEqual(claims);
  });

  it('rejects expired tokens', async () => {
    const { token } = await signer.sign(claims, NOW);
    const later = new Date(NOW.getTime() + (ACCESS_TOKEN_TTL_MINUTES + 1) * 60_000);
    await expect(signer.verify(token, later)).resolves.toBeNull();
  });

  it('rejects tokens signed with another secret or tampered with', async () => {
    const { token } = await new AccessTokenSigner(`${SECRET}-other`).sign(claims, NOW);
    await expect(signer.verify(token, NOW)).resolves.toBeNull();

    const valid = (await signer.sign(claims, NOW)).token;
    const [header, , signature] = valid.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'admin', sid: 'x' })).toString(
      'base64url',
    );
    await expect(signer.verify(`${header}.${forgedPayload}.${signature}`, NOW)).resolves.toBeNull();
    await expect(signer.verify('garbage', NOW)).resolves.toBeNull();
  });
});

describe('refresh tokens', () => {
  it('are random and hashed deterministically', () => {
    const token = generateRefreshToken();
    expect(token).not.toBe(generateRefreshToken());
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toContain(token);
  });
});
