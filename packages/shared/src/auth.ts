import type { SupportedLocaleCode } from './locale';
import type { UserRole } from './roles';

// Auth contracts for POST /auth/register, /auth/login, /auth/refresh, /auth/logout and GET /me.
// See docs/adr/0003-free-first-authentication.md.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type RegisterCustomerRequest = {
  fullName: string;
  email: string;
  /** Egyptian mobile number, local (01XXXXXXXXX) or international (+201XXXXXXXXX). */
  phone: string;
  password: string;
  preferredLocale?: SupportedLocaleCode;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RefreshSessionRequest = {
  refreshToken: string;
};

export type LogoutRequest = {
  refreshToken: string;
};

/** Store both tokens in the iOS Keychain (expo-secure-store), never in AsyncStorage. */
export type AuthTokens = {
  accessToken: string;
  /** ISO 8601 instant when the access token expires. Refresh shortly before. */
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export type RoleAssignment = {
  role: UserRole;
  /** Set for tenant-scoped roles (WORKER, BUSINESS_ADMIN); null for global roles. */
  organizationId: string | null;
};

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  preferredLocale: SupportedLocaleCode;
  roles: RoleAssignment[];
  /** Branches this user is assigned to operate (workers and admins). */
  assignedBranchIds: string[];
};

export type AuthSessionResponse = {
  user: CurrentUser;
  tokens: AuthTokens;
};

export type CurrentUserResponse = {
  user: CurrentUser;
};
