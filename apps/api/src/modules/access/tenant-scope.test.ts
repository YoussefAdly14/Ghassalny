import { UserRole } from '@ghassalny/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../common/errors';
import type { AuthContext } from './auth-context';
import {
  assertCanManageOrganization,
  assertCanOperateBranch,
  canManageOrganization,
  canOperateBranch,
  managedOrganizationIds,
} from './tenant-scope';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const BRANCH_A1 = { branchId: 'branch-a1', organizationId: ORG_A };
const BRANCH_A2 = { branchId: 'branch-a2', organizationId: ORG_A };
const BRANCH_B1 = { branchId: 'branch-b1', organizationId: ORG_B };

function context(partial: Partial<AuthContext>): AuthContext {
  return { userId: 'u', sessionId: 's', roles: [], assignedBranches: [], ...partial };
}

const adminA = context({ roles: [{ role: UserRole.BUSINESS_ADMIN, organizationId: ORG_A }] });
const workerA1 = context({
  roles: [{ role: UserRole.WORKER, organizationId: ORG_A }],
  assignedBranches: [BRANCH_A1],
});
const platform = context({ roles: [{ role: UserRole.PLATFORM_ADMIN, organizationId: null }] });
const customer = context({ roles: [{ role: UserRole.CUSTOMER, organizationId: null }] });

describe('tenant scope', () => {
  it('business admins manage only their own organization', () => {
    expect(canManageOrganization(adminA, ORG_A)).toBe(true);
    expect(canManageOrganization(adminA, ORG_B)).toBe(false);
    expect(canOperateBranch(adminA, BRANCH_A2)).toBe(true);
    expect(canOperateBranch(adminA, BRANCH_B1)).toBe(false);
  });

  it('workers operate only their assigned branches', () => {
    expect(canOperateBranch(workerA1, BRANCH_A1)).toBe(true);
    expect(canOperateBranch(workerA1, BRANCH_A2)).toBe(false);
    expect(canOperateBranch(workerA1, BRANCH_B1)).toBe(false);
    expect(canManageOrganization(workerA1, ORG_A)).toBe(false);
  });

  it('a stale branch assignment without the WORKER role in that organization grants nothing', () => {
    const exWorker = context({ assignedBranches: [BRANCH_A1] });
    expect(canOperateBranch(exWorker, BRANCH_A1)).toBe(false);
  });

  it('rejects a branch target that claims the wrong organization', () => {
    expect(
      canOperateBranch(workerA1, { branchId: BRANCH_A1.branchId, organizationId: ORG_B }),
    ).toBe(false);
  });

  it('platform admins can access every tenant; customers none', () => {
    expect(canManageOrganization(platform, ORG_B)).toBe(true);
    expect(canOperateBranch(platform, BRANCH_B1)).toBe(true);
    expect(canManageOrganization(customer, ORG_A)).toBe(false);
    expect(canOperateBranch(customer, BRANCH_A1)).toBe(false);
  });

  it('assert helpers throw a 403 AppError', () => {
    expect(() => assertCanManageOrganization(adminA, ORG_A)).not.toThrow();
    expect(() => assertCanOperateBranch(workerA1, BRANCH_A1)).not.toThrow();
    for (const attempt of [
      () => assertCanManageOrganization(adminA, ORG_B),
      () => assertCanOperateBranch(workerA1, BRANCH_B1),
    ]) {
      expect(attempt).toThrow(AppError);
      try {
        attempt();
      } catch (error) {
        expect((error as AppError).statusCode).toBe(403);
      }
    }
  });

  it('lists managed organizations for query scoping', () => {
    expect(managedOrganizationIds(platform)).toBe('ALL');
    expect(managedOrganizationIds(adminA)).toEqual([ORG_A]);
    expect(managedOrganizationIds(workerA1)).toEqual([]);
    expect(managedOrganizationIds(customer)).toEqual([]);
  });
});
