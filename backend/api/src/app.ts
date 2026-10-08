import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { registerErrorHandling } from './common/error-handler';
import { rateLimited } from './common/errors';
import type { ApiConfig } from './config';
import { registerAuthGuards } from './modules/access/guards';
import type { AuthRepository } from './modules/auth/auth.repository';
import { registerAuthRoutes } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { AccessTokenSigner } from './modules/auth/tokens';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerUserRoutes } from './modules/users/users.routes';

/** Everything the app needs from the outside world. Tests pass in-memory fakes. */
export type AppDependencies = {
  config: ApiConfig;
  authRepository: AuthRepository;
  checkDatabase: () => Promise<void>;
  now?: () => Date;
  logger?: FastifyServerOptions['logger'];
};

export async function buildApp(dependencies: AppDependencies) {
  const { config } = dependencies;
  const now = dependencies.now ?? (() => new Date());

  const app = Fastify({
    logger: dependencies.logger ?? {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      redact: ['req.headers.authorization'],
    },
    trustProxy: config.NODE_ENV === 'production',
  });

  registerErrorHandling(app);
  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ALLOWED_ORIGINS, credentials: true });
  // Only routes that opt in via `config.rateLimit` are limited.
  await app.register(rateLimit, { global: false, errorResponseBuilder: () => rateLimited() });

  const authService = new AuthService(
    dependencies.authRepository,
    new AccessTokenSigner(config.AUTH_SECRET),
    now,
  );
  const guards = registerAuthGuards(app, authService);

  registerHealthRoutes(app, dependencies.checkDatabase);
  registerAuthRoutes(app, authService);
  registerUserRoutes(app, guards, authService);

  return app;
}
