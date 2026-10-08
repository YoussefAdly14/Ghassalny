import { ApiErrorCode, type ApiErrorBody, type ApiFieldError } from '@ghassalny/shared';

/** An expected failure with a stable code. The error handler turns it into an ApiErrorBody. */
export class AppError extends Error {
  override readonly name = 'AppError';

  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ApiFieldError[],
  ) {
    super(message);
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export const validationFailed = (details: ApiFieldError[]) =>
  new AppError(400, ApiErrorCode.VALIDATION_FAILED, 'The request is invalid.', details);

export const unauthenticated = (message = 'Sign in to continue.') =>
  new AppError(401, ApiErrorCode.UNAUTHENTICATED, message);

export const forbidden = (message = 'You do not have access to this resource.') =>
  new AppError(403, ApiErrorCode.FORBIDDEN, message);

export const notFound = (message = 'Not found.') =>
  new AppError(404, ApiErrorCode.NOT_FOUND, message);

export const rateLimited = () =>
  new AppError(429, ApiErrorCode.RATE_LIMITED, 'Too many requests. Try again in a minute.');
