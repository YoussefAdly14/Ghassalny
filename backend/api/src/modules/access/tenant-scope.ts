import { UserRole } from '@ghassalny/contracts';
import { forbidden } from '../../common/errors';
import { hasRole, type AuthContext } from './auth-context';

// Tenant scope rules (docs/product/personas-and-roles.md):
// - PLATFORM_ADMIN: every organization and branch.
// - BUSINESS_ADMIN: every branch of the organizations they administer.
// - WORKER: only branches they are assigned to, in an organization where they hold WORKER.
// - CUSTOMER: no business data.
// Every admin and worker endpoint must call one of the assert helpers before touching data.

export type BranchTarget = {
  branchId: string;
  organizationId: string;
};

/** Organization-level management: branches, services, staff, reports. */
export function canManageOrganization(context: AuthContext, organizationId: string): boolean {
  return (
    hasRole(context, UserRole.PLATFORM_ADMIN) ||
    hasRole(context, UserRole.BUSINESS_ADMIN, organizationId)
  );
}

/** Day-to-day branch operations: schedule, walk-ins, status changes, time blocks. */
export function canOperateBranch(context: AuthContext, target: BranchTarget): boolean {
  if (canManageOrganization(context, target.organizationId)) return true;
  return (
    hasRole(context, UserRole.WORKER, target.organizationId) &&
    context.assignedBranches.some(
      (assignment) =>
        assignment.branchId === target.branchId &&
        assignment.organizationId === target.organizationId,
    )
  );
}

export function assertCanManageOrganization(context: AuthContext, organizationId: string): void {
  if (!canManageOrganization(context, organizationId)) throw forbidden();
}

export function assertCanOperateBranch(context: AuthContext, target: BranchTarget): void {
  if (!canOperateBranch(context, target)) throw forbidden();
}

/**
 * The organizations a user may manage, for scoping list queries.
 * `'ALL'` for platform admins; an empty list means no business data at all.
 */
export function managedOrganizationIds(context: AuthContext): 'ALL' | string[] {
  if (hasRole(context, UserRole.PLATFORM_ADMIN)) return 'ALL';
  return context.roles
    .filter((assignment) => assignment.role === UserRole.BUSINESS_ADMIN)
    .flatMap((assignment) => (assignment.organizationId ? [assignment.organizationId] : []));
}
