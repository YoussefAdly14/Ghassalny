import type { RoleAssignment, UserRole } from '@ghassalny/contracts';

/** A branch the user is assigned to operate, with its owning organization. */
export type BranchAssignment = {
  branchId: string;
  organizationId: string;
};

/**
 * Who is making the request. Built fresh from the database on every authenticated request,
 * so role changes and revoked sessions take effect immediately (ADR 0003).
 */
export type AuthContext = {
  userId: string;
  sessionId: string;
  roles: RoleAssignment[];
  assignedBranches: BranchAssignment[];
};

/** Resolves a bearer access token to an AuthContext, or null when it is invalid or revoked. */
export interface AccessTokenResolver {
  resolveAccessToken(token: string): Promise<AuthContext | null>;
}

export function hasRole(context: AuthContext, role: UserRole, organizationId?: string): boolean {
  return context.roles.some(
    (assignment) =>
      assignment.role === role &&
      (organizationId === undefined || assignment.organizationId === organizationId),
  );
}

export function hasAnyRole(context: AuthContext, roles: readonly UserRole[]): boolean {
  return roles.some((role) => hasRole(context, role));
}
