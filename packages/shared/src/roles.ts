import { createEnumGuard, type EnumValue } from './enum';

/**
 * Access roles from docs/product/personas-and-roles.md.
 * WORKER and BUSINESS_ADMIN are always granted within an organization (tenant);
 * CUSTOMER and PLATFORM_ADMIN are global.
 */
export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  WORKER: 'WORKER',
  BUSINESS_ADMIN: 'BUSINESS_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
} as const;
export type UserRole = EnumValue<typeof UserRole>;

export const USER_ROLES = Object.values(UserRole);
export const isUserRole = createEnumGuard(UserRole);

/** Roles that only make sense together with an organization assignment. */
export const TENANT_SCOPED_ROLES: readonly UserRole[] = [UserRole.WORKER, UserRole.BUSINESS_ADMIN];
