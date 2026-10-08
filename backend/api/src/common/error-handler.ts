import { ApiErrorCode, type ApiErrorBody } from '@ghassalny/contracts';
import type { FastifyError, FastifyInstance } from 'fastify';
import { AppError } from './errors';

/** Every error leaves the API as an ApiErrorBody, so clients only handle one shape. */
export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toBody());
    }

    // Fastify's own client errors, e.g. malformed JSON or an unsupported content type.
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 400 && statusCode < 500) {
      const body: ApiErrorBody = {
        error: { code: ApiErrorCode.VALIDATION_FAILED, message: error.message },
      };
      return reply.status(400).send(body);
    }

    request.log.error({ err: error }, 'Unhandled error');
    const body: ApiErrorBody = {
      error: { code: ApiErrorCode.INTERNAL_ERROR, message: 'Something went wrong.' },
    };
    return reply.status(500).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiErrorBody = {
      error: { code: ApiErrorCode.NOT_FOUND, message: 'Route not found.' },
    };
    return reply.status(404).send(body);
  });
}
