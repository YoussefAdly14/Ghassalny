import type { FastifyInstance } from 'fastify';

/** Liveness and database readiness, for local checks and future hosting health probes. */
export function registerHealthRoutes(app: FastifyInstance, checkDatabase: () => Promise<void>) {
  app.get('/health', async (request, reply) => {
    try {
      await checkDatabase();
      return { status: 'ok', database: 'ok' };
    } catch (error) {
      request.log.error({ err: error }, 'Database health check failed');
      return reply.status(503).send({ status: 'degraded', database: 'unreachable' });
    }
  });
}
