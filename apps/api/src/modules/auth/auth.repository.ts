import type { DatabaseClient } from '@ghassalny/database';
import type { RoleAssignment, SupportedLocaleCode } from '@ghassalny/shared';
import type { BranchAssignment } from '../access/auth-context';

export type UserStatus = 'ACTIVE' | 'DISABLED' | 'DELETED';

export type UserCredentials = {
  id: string;
  passwordHash: string | null;
  status: UserStatus;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  preferredLocale: SupportedLocaleCode;
  status: UserStatus;
  roles: RoleAssignment[];
  assignedBranches: BranchAssignment[];
};

export type NewCustomer = {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  preferredLocale: SupportedLocaleCode;
};

export type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export class DuplicateUserError extends Error {
  override readonly name = 'DuplicateUserError';

  constructor(readonly field: 'email' | 'phone') {
    super(`A user with this ${field} already exists.`);
  }
}

/** Persistence boundary for the auth module. */
export interface AuthRepository {
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  /** Creates the user and their CUSTOMER role atomically. Throws DuplicateUserError. */
  createCustomer(customer: NewCustomer): Promise<{ id: string }>;
  findUserProfile(userId: string): Promise<UserProfile | null>;
  recordLogin(userId: string, at: Date): Promise<void>;

  createSession(session: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<SessionRecord>;
  findSessionById(sessionId: string): Promise<SessionRecord | null>;
  findSessionByRefreshTokenHash(refreshTokenHash: string): Promise<SessionRecord | null>;
  /**
   * Replaces the refresh token only if `currentHash` is still current and the session is not
   * revoked, so two concurrent refreshes cannot both succeed. Returns false if it lost the race.
   */
  rotateSession(
    sessionId: string,
    rotation: { currentHash: string; nextHash: string; expiresAt: Date; at: Date },
  ): Promise<boolean>;
  revokeSession(sessionId: string, at: Date): Promise<void>;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly db: DatabaseClient) {}

  findCredentialsByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, status: true },
    });
  }

  async createCustomer(customer: NewCustomer) {
    // Friendly pre-check; the unique indexes still guard against races (mapped below).
    const existing = await this.db.user.findFirst({
      where: { OR: [{ email: customer.email }, { phone: customer.phone }] },
      select: { email: true },
    });
    if (existing)
      throw new DuplicateUserError(existing.email === customer.email ? 'email' : 'phone');

    try {
      return await this.db.user.create({
        data: { ...customer, roleAssignments: { create: { role: 'CUSTOMER' } } },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateUserError(JSON.stringify(error).includes('phone') ? 'phone' : 'email');
      }
      throw error;
    }
  }

  async findUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        preferredLocale: true,
        status: true,
        roleAssignments: { select: { role: true, organizationId: true } },
        staffAssignments: { select: { branchId: true, organizationId: true } },
      },
    });
    if (!user) return null;
    const { roleAssignments, staffAssignments, ...profile } = user;
    return { ...profile, roles: roleAssignments, assignedBranches: staffAssignments };
  }

  async recordLogin(userId: string, at: Date) {
    await this.db.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
  }

  createSession(session: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
  }) {
    return this.db.authSession.create({ data: session, select: sessionSelect });
  }

  findSessionById(sessionId: string) {
    return this.db.authSession.findUnique({ where: { id: sessionId }, select: sessionSelect });
  }

  findSessionByRefreshTokenHash(refreshTokenHash: string) {
    return this.db.authSession.findUnique({ where: { refreshTokenHash }, select: sessionSelect });
  }

  async rotateSession(
    sessionId: string,
    rotation: { currentHash: string; nextHash: string; expiresAt: Date; at: Date },
  ) {
    const { count } = await this.db.authSession.updateMany({
      where: { id: sessionId, refreshTokenHash: rotation.currentHash, revokedAt: null },
      data: {
        refreshTokenHash: rotation.nextHash,
        expiresAt: rotation.expiresAt,
        lastUsedAt: rotation.at,
      },
    });
    return count === 1;
  }

  async revokeSession(sessionId: string, at: Date) {
    await this.db.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}

const sessionSelect = { id: true, userId: true, expiresAt: true, revokedAt: true } as const;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
