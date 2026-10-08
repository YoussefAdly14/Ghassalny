import {
  ApiErrorCode,
  type AuthSessionResponse,
  type CurrentUser,
  type SupportedLocaleCode,
} from '@ghassalny/contracts';
import { AppError, notFound } from '../../common/errors';
import type { AccessTokenResolver, AuthContext } from '../access/auth-context';
import {
  DuplicateUserError,
  type AuthRepository,
  type SessionRecord,
  type UserProfile,
} from './auth.repository';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from './password';
import {
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_DAYS,
  type AccessTokenSigner,
} from './tokens';

export type ClientInfo = { userAgent: string | null };

const invalidCredentials = () =>
  new AppError(401, ApiErrorCode.INVALID_CREDENTIALS, 'Email or password is incorrect.');

const invalidRefreshToken = () =>
  new AppError(401, ApiErrorCode.INVALID_REFRESH_TOKEN, 'Your session has ended. Sign in again.');

/** Registration, login, session refresh and logout, and access-token resolution (ADR 0003). */
export class AuthService implements AccessTokenResolver {
  constructor(
    private readonly repository: AuthRepository,
    private readonly signer: AccessTokenSigner,
    private readonly now: () => Date,
  ) {}

  async registerCustomer(
    input: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
      preferredLocale?: SupportedLocaleCode | undefined;
    },
    client: ClientInfo,
  ): Promise<AuthSessionResponse> {
    let created: { id: string };
    try {
      created = await this.repository.createCustomer({
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        preferredLocale: input.preferredLocale ?? 'en',
      });
    } catch (error) {
      if (error instanceof DuplicateUserError) {
        throw error.field === 'email'
          ? new AppError(
              409,
              ApiErrorCode.EMAIL_TAKEN,
              'An account with this email already exists.',
            )
          : new AppError(
              409,
              ApiErrorCode.PHONE_TAKEN,
              'An account with this phone number already exists.',
            );
      }
      throw error;
    }
    return this.startSession(created.id, client);
  }

  async login(input: { email: string; password: string }, client: ClientInfo) {
    const credentials = await this.repository.findCredentialsByEmail(input.email);
    if (!credentials?.passwordHash || credentials.status !== 'ACTIVE') {
      await verifyAgainstDummyHash(input.password);
      throw invalidCredentials();
    }
    if (!(await verifyPassword(input.password, credentials.passwordHash))) {
      throw invalidCredentials();
    }
    await this.repository.recordLogin(credentials.id, this.now());
    return this.startSession(credentials.id, client);
  }

  async refresh(refreshToken: string): Promise<AuthSessionResponse> {
    const currentHash = hashRefreshToken(refreshToken);
    const session = await this.repository.findSessionByRefreshTokenHash(currentHash);
    if (!session || !this.isLive(session)) throw invalidRefreshToken();

    const profile = await this.repository.findUserProfile(session.userId);
    if (!profile || profile.status !== 'ACTIVE') throw invalidRefreshToken();

    const now = this.now();
    const nextToken = generateRefreshToken();
    const refreshExpiresAt = addDays(now, REFRESH_TOKEN_TTL_DAYS);
    const rotated = await this.repository.rotateSession(session.id, {
      currentHash,
      nextHash: hashRefreshToken(nextToken),
      expiresAt: refreshExpiresAt,
      at: now,
    });
    if (!rotated) throw invalidRefreshToken();

    const access = await this.signer.sign({ userId: profile.id, sessionId: session.id }, now);
    return {
      user: toCurrentUser(profile),
      tokens: {
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshToken: nextToken,
        refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      },
    };
  }

  /** Idempotent: unknown or already-revoked tokens succeed silently. */
  async logout(refreshToken: string): Promise<void> {
    const session = await this.repository.findSessionByRefreshTokenHash(
      hashRefreshToken(refreshToken),
    );
    if (session && !session.revokedAt) await this.repository.revokeSession(session.id, this.now());
  }

  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const profile = await this.repository.findUserProfile(userId);
    if (!profile || profile.status !== 'ACTIVE') throw notFound('User not found.');
    return toCurrentUser(profile);
  }

  async resolveAccessToken(token: string): Promise<AuthContext | null> {
    const claims = await this.signer.verify(token, this.now());
    if (!claims) return null;

    const session = await this.repository.findSessionById(claims.sessionId);
    if (!session || session.userId !== claims.userId || !this.isLive(session)) return null;

    const profile = await this.repository.findUserProfile(claims.userId);
    if (!profile || profile.status !== 'ACTIVE') return null;

    return {
      userId: profile.id,
      sessionId: session.id,
      roles: profile.roles,
      assignedBranches: profile.assignedBranches,
    };
  }

  private isLive(session: SessionRecord): boolean {
    return !session.revokedAt && session.expiresAt > this.now();
  }

  private async startSession(userId: string, client: ClientInfo): Promise<AuthSessionResponse> {
    const now = this.now();
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = addDays(now, REFRESH_TOKEN_TTL_DAYS);
    const session = await this.repository.createSession({
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
      userAgent: client.userAgent?.slice(0, 255) ?? null,
    });
    const access = await this.signer.sign({ userId, sessionId: session.id }, now);
    return {
      user: await this.getCurrentUser(userId),
      tokens: {
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshToken,
        refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      },
    };
  }
}

/** Maps the internal profile to the public contract. Never includes hashes or session data. */
export function toCurrentUser(profile: UserProfile): CurrentUser {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phone,
    preferredLocale: profile.preferredLocale,
    roles: profile.roles.map(({ role, organizationId }) => ({ role, organizationId })),
    assignedBranchIds: profile.assignedBranches.map((assignment) => assignment.branchId),
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
