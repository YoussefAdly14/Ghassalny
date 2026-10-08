import { createEnumGuard, type EnumValue } from './enum';

/**
 * Every API error response uses this body, whatever the status code:
 *
 *   { "error": { "code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect." } }
 *
 * Clients branch on `code` (stable) and may show `message` (human-readable, English for now).
 * `details` is present for VALIDATION_FAILED and lists each invalid field.
 */
export const ApiErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  PHONE_TAKEN: 'PHONE_TAKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
} as const;
export type ApiErrorCode = EnumValue<typeof ApiErrorCode>;
export const isApiErrorCode = createEnumGuard(ApiErrorCode);

export type ApiFieldError = {
  /** Dot path of the invalid field, e.g. "email" or "vehicle.plateNumber". */
  path: string;
  message: string;
};

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiFieldError[];
  };
};
