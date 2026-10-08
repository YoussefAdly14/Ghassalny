import { randomUUID } from 'node:crypto';
import {
  DuplicateUserError,
  type AuthRepository,
  type NewCustomer,
  type SessionRecord,
  type UserProfile,
} from '../modules/auth/auth.repository';

type StoredUser = UserProfile & { passwordHash: string | null; lastLoginAt: Date | null };
type StoredSession = SessionRecord & { refreshTokenHash: string; userAgent: string | null };

/** Test double for AuthRepository with the same uniqueness and rotation semantics as Prisma. */
export class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, StoredUser>();
  readonly sessions = new Map<string, StoredSession>();

  /** Seeds a user directly, e.g. a worker or admin that cannot self-register. */
  addUser(user: Partial<StoredUser> & Pick<StoredUser, 'email'>): StoredUser {
    const stored: StoredUser = {
      id: randomUUID(),
      fullName: 'Test User',
      phone: null,
      preferredLocale: 'en',
      status: 'ACTIVE',
      roles: [],
      assignedBranches: [],
      passwordHash: null,
      lastLoginAt: null,
      ...user,
    };
    this.users.set(stored.id, stored);
    return stored;
  }

  async findCredentialsByEmail(email: string) {
    const user = [...this.users.values()].find((candidate) => candidate.email === email);
    return user ? { id: user.id, passwordHash: user.passwordHash, status: user.status } : null;
  }

  async createCustomer(customer: NewCustomer) {
    for (const user of this.users.values()) {
      if (user.email === customer.email) throw new DuplicateUserError('email');
      if (user.phone === customer.phone) throw new DuplicateUserError('phone');
    }
    const user = this.addUser({
      ...customer,
      roles: [{ role: 'CUSTOMER', organizationId: null }],
    });
    return { id: user.id };
  }

  async findUserProfile(userId: string): Promise<UserProfile | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const { passwordHash: _hash, lastLoginAt: _lastLogin, ...profile } = user;
    return profile;
  }

  async recordLogin(userId: string, at: Date) {
    const user = this.users.get(userId);
    if (user) user.lastLoginAt = at;
  }

  async createSession(session: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
  }) {
    const stored: StoredSession = { id: randomUUID(), revokedAt: null, ...session };
    this.sessions.set(stored.id, stored);
    return toRecord(stored);
  }

  async findSessionById(sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session ? toRecord(session) : null;
  }

  async findSessionByRefreshTokenHash(refreshTokenHash: string) {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === refreshTokenHash,
    );
    return session ? toRecord(session) : null;
  }

  async rotateSession(
    sessionId: string,
    rotation: { currentHash: string; nextHash: string; expiresAt: Date; at: Date },
  ) {
    const session = this.sessions.get(sessionId);
    if (!session || session.revokedAt || session.refreshTokenHash !== rotation.currentHash) {
      return false;
    }
    session.refreshTokenHash = rotation.nextHash;
    session.expiresAt = rotation.expiresAt;
    return true;
  }

  async revokeSession(sessionId: string, at: Date) {
    const session = this.sessions.get(sessionId);
    if (session && !session.revokedAt) session.revokedAt = at;
  }
}

function toRecord(session: StoredSession): SessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
  };
}
