import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type LoginRequest,
  type LogoutRequest,
  type RefreshSessionRequest,
  type RegisterCustomerRequest,
} from '@ghassalny/shared';
import { z } from 'zod';
import { normalizeEgyptianMobile } from './phone';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`);

const egyptianMobile = z.string().transform((value, context) => {
  const normalized = normalizeEgyptianMobile(value);
  if (!normalized) {
    context.addIssue({ code: 'custom', message: 'Enter an Egyptian mobile number (01XXXXXXXXX).' });
    return z.NEVER;
  }
  return normalized;
});

export const registerCustomerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(100),
  email,
  phone: egyptianMobile,
  password,
  preferredLocale: z.enum(['en', 'ar']).optional(),
});

// Login checks only that a password is present, so a policy change never locks out old accounts.
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(PASSWORD_MAX_LENGTH),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(200),
});

// Compile-time checks: the shared request contracts are accepted by these schemas.
type Accepts<TSchema extends z.ZodType, TContract> = [TContract] extends [z.input<TSchema>]
  ? true
  : false;
type Assert<T extends true> = T;
export type ContractChecks = [
  Assert<Accepts<typeof registerCustomerSchema, RegisterCustomerRequest>>,
  Assert<Accepts<typeof loginSchema, LoginRequest>>,
  Assert<Accepts<typeof refreshTokenSchema, RefreshSessionRequest>>,
  Assert<Accepts<typeof refreshTokenSchema, LogoutRequest>>,
];
